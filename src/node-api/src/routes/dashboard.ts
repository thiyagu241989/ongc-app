import { Router, type Request, type Response } from "express";
import type { Pool } from "pg";

export function createDashboardRouter(pool: Pool): Router {
  const router = Router();

  async function queryDesigns(
    company: string | null,
    well: string | null,
    status: string | null,
    owner: string | null,
  ) {
    const conditions: string[] = ["NOT is_deleted"];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (company) {
      conditions.push(`company = $${paramIdx++}`);
      params.push(company);
    }
    if (well) {
      conditions.push(
        `(well ILIKE $${paramIdx} OR wellbore ILIKE $${paramIdx})`,
      );
      params.push(`%${well}%`);
      paramIdx++;
    }
    if (status) {
      conditions.push(`status = $${paramIdx++}`);
      params.push(status);
    }
    if (owner) {
      conditions.push(`owner_name = $${paramIdx++}`);
      params.push(owner);
    }

    const whereClause = conditions.join(" AND ");
    return pool.query(
      `SELECT id, company, project, site, well, wellbore, design,
              owner_name, design_type, status, aggregate_version,
              created_at, updated_at
       FROM wellbore_designs
       WHERE ${whereClause}
       ORDER BY updated_at DESC`,
      params,
    );
  }

  function extractFilters(req: Request) {
    return {
      company: (req.query.company as string)?.trim() || null,
      well: (req.query.well as string)?.trim() || null,
      status: (req.query.status as string)?.trim() || null,
      owner: (req.query.owner as string)?.trim() || null,
    };
  }

  async function fetchMilestonesByDesignIds(designIds: string[]) {
    if (designIds.length === 0) return new Map<string, any[]>();

    const result = await pool.query(
      `SELECT wellbore_design_id, milestone_type, occurred_at
       FROM milestones
       WHERE wellbore_design_id = ANY($1)
       ORDER BY occurred_at`,
      [designIds],
    );

    const map = new Map<string, any[]>();
    for (const row of result.rows) {
      const key = row.wellbore_design_id as string;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({
        milestoneType: row.milestone_type as string,
        occurredAt: new Date(row.occurred_at as string),
      });
    }
    return map;
  }

  // GET /api/v1/dashboard/insight/progress-timeline
  router.get("/progress-timeline", async (req: Request, res: Response) => {
    const { company, well, status, owner } = extractFilters(req);
    const sort = (req.query.sort as string)?.toLowerCase() || null;
    const limit = parseInt(req.query.limit as string) || 10;

    const designsResult = await queryDesigns(company, well, status, owner);
    const designs = designsResult.rows;
    const designIds = designs.map((d) => d.id as string);
    const milestonesByDesign = await fetchMilestonesByDesignIds(designIds);

    let results = designs.map((d) => {
      const ms = milestonesByDesign.get(d.id as string) ?? [];
      const firstDate = ms.length > 0 ? ms[0].occurredAt : null;
      const lastDate = ms.length > 0 ? ms[ms.length - 1].occurredAt : null;
      const totalDays =
        firstDate && lastDate
          ? Math.round(
              ((lastDate.getTime() - firstDate.getTime()) / 86400000) * 100,
            ) / 100
          : 0;

      const segments: Array<{ from: string; to: string; days: number }> = [];
      for (let i = 1; i < ms.length; i++) {
        segments.push({
          from: ms[i - 1].milestoneType,
          to: ms[i].milestoneType,
          days:
            Math.round(
              ((ms[i].occurredAt.getTime() - ms[i - 1].occurredAt.getTime()) /
                86400000) *
                100,
            ) / 100,
        });
      }

      return {
        id: d.id,
        well: d.well,
        wellbore: d.wellbore,
        design: d.design,
        ownerName: d.owner_name,
        status: d.status,
        totalDays,
        milestoneCount: ms.length,
        segments,
      };
    });

    if (sort === "alpha") {
      results.sort((a, b) =>
        a.well.localeCompare(b.well) || a.wellbore.localeCompare(b.wellbore),
      );
    } else if (sort === "recent") {
      results.sort((a, b) => {
        const aMs = milestonesByDesign.get(a.id) ?? [];
        const bMs = milestonesByDesign.get(b.id) ?? [];
        const aLast = aMs.length > 0 ? aMs[aMs.length - 1].occurredAt.getTime() : 0;
        const bLast = bMs.length > 0 ? bMs[bMs.length - 1].occurredAt.getTime() : 0;
        return bLast - aLast;
      });
    } else {
      results.sort((a, b) => b.totalDays - a.totalDays);
    }

    res.json({
      total: results.length,
      items: limit > 0 ? results.slice(0, limit) : results,
    });
  });

  // GET /api/v1/dashboard/insight/well-register
  router.get("/well-register", async (req: Request, res: Response) => {
    const { company, well, status, owner } = extractFilters(req);
    const sort = (req.query.sort as string)?.toLowerCase() || null;

    const designsResult = await queryDesigns(company, well, status, owner);
    const designs = designsResult.rows;
    const designIds = designs.map((d) => d.id as string);
    const milestonesByDesign = await fetchMilestonesByDesignIds(designIds);

    let results = designs.map((d) => {
      const ms = milestonesByDesign.get(d.id as string) ?? [];
      const currentMs = ms.length > 0 ? ms[ms.length - 1] : null;
      const firstDate = ms.length > 0 ? ms[0].occurredAt : null;
      const lastDate = currentMs?.occurredAt ?? null;
      const totalDays =
        firstDate && lastDate
          ? Math.round((lastDate.getTime() - firstDate.getTime()) / 86400000)
          : 0;

      const totalRequired = d.design_type === "Montage" ? 10 : 11;
      const percentComplete =
        totalRequired > 0 ? Math.round((ms.length / totalRequired) * 100) : 0;

      const milestoneTypeSet = new Set(ms.map((m: any) => m.milestoneType));
      let approvalLevel: string;
      if (milestoneTypeSet.has("Approvals Level 3")) approvalLevel = "Completed";
      else if (milestoneTypeSet.has("Approvals Level 2")) approvalLevel = "Level 2";
      else if (milestoneTypeSet.has("Approvals Level 1")) approvalLevel = "Level 1";
      else if (milestoneTypeSet.has("Approvals initiated"))
        approvalLevel = "Initiated";
      else approvalLevel = "Not started";

      return {
        asset: d.site,
        wellWellbore: `${d.well}/${d.wellbore}`,
        user: d.owner_name,
        currentMilestone: currentMs?.milestoneType ?? "Not started",
        dateTime: currentMs?.occurredAt?.toISOString() ?? null,
        approvalLevel,
        status: d.status,
        days: totalDays,
        percentComplete,
      };
    });

    if (sort === "alpha") {
      results.sort((a, b) => a.wellWellbore.localeCompare(b.wellWellbore));
    } else if (sort === "recent") {
      results.sort((a, b) => {
        const at = a.dateTime ? new Date(a.dateTime).getTime() : 0;
        const bt = b.dateTime ? new Date(b.dateTime).getTime() : 0;
        return bt - at;
      });
    } else {
      results.sort((a, b) => b.days - a.days);
    }

    res.json(results);
  });

  // GET /api/v1/dashboard/insight/approval-tracking
  router.get("/approval-tracking", async (req: Request, res: Response) => {
    const { company, well, status, owner } = extractFilters(req);

    const designsResult = await queryDesigns(company, well, status, owner);
    const designs = designsResult.rows;
    const designIds = designs.map((d) => d.id as string);
    const milestonesByDesign = await fetchMilestonesByDesignIds(designIds);

    const results = designs
      .filter((d) => milestonesByDesign.has(d.id as string))
      .map((d) => {
        const ms = milestonesByDesign.get(d.id as string) ?? [];
        const msMap = new Map<string, Date>();
        for (const m of ms) {
          msMap.set(m.milestoneType, m.occurredAt);
        }

        const initiated = msMap.get("Approvals initiated") ?? null;
        const l1 = msMap.get("Approvals Level 1") ?? null;
        const l2 = msMap.get("Approvals Level 2") ?? null;
        const l3 = msMap.get("Approvals Level 3") ?? null;

        const daysLevel1 =
          initiated && l1
            ? Math.round(
                ((l1.getTime() - initiated.getTime()) / 86400000) * 100,
              ) / 100
            : null;
        const daysLevel2 =
          l1 && l2
            ? Math.round(((l2.getTime() - l1.getTime()) / 86400000) * 100) /
              100
            : null;
        const daysLevel3 =
          l2 && l3
            ? Math.round(((l3.getTime() - l2.getTime()) / 86400000) * 100) /
              100
            : null;

        const latestApproval = l3 ?? l2 ?? l1 ?? initiated;
        const totalApprovalDays =
          initiated && latestApproval
            ? Math.round(
                ((latestApproval.getTime() - initiated.getTime()) / 86400000) *
                  100,
              ) / 100
            : null;

        return {
          wellWellbore: `${d.well}/${d.wellbore}`,
          ownerName: d.owner_name,
          status: d.status,
          initiatedAt: initiated?.toISOString() ?? null,
          daysLevel1,
          daysLevel2,
          daysLevel3,
          totalApprovalDays,
        };
      })
      .sort(
        (a, b) => (b.totalApprovalDays ?? 0) - (a.totalApprovalDays ?? 0),
      );

    res.json(results);
  });

  // GET /api/v1/dashboard/insight/summary
  router.get("/summary", async (req: Request, res: Response) => {
    const { company, well, status, owner } = extractFilters(req);

    const designsResult = await queryDesigns(company, well, status, owner);
    const designs = designsResult.rows;
    const designIds = designs.map((d) => d.id as string);
    const milestonesByDesign = await fetchMilestonesByDesignIds(designIds);

    const completedDesigns = designs.filter(
      (d) => d.status === "Completed",
    );
    const completedDays = completedDesigns
      .map((d) => {
        const ms = milestonesByDesign.get(d.id as string) ?? [];
        if (ms.length < 2) return 0;
        return (
          (ms[ms.length - 1].occurredAt.getTime() -
            ms[0].occurredAt.getTime()) /
          86400000
        );
      })
      .filter((d) => d > 0);

    const avg =
      completedDays.length > 0
        ? Math.round(
            (completedDays.reduce((a, b) => a + b, 0) /
              completedDays.length) *
              10,
          ) / 10
        : 0;
    const min =
      completedDays.length > 0
        ? Math.round(Math.min(...completedDays) * 10) / 10
        : 0;
    const max =
      completedDays.length > 0
        ? Math.round(Math.max(...completedDays) * 10) / 10
        : 0;

    res.json({
      totalDesigns: designs.length,
      completed: designs.filter((d) => d.status === "Completed").length,
      inProgress: designs.filter((d) => d.status === "In progress").length,
      dataReceived: designs.filter((d) => d.status === "Data received").length,
      notStarted: designs.filter((d) => d.status === "Not started").length,
      avgDaysToComplete: avg,
      minDaysToComplete: min,
      maxDaysToComplete: max,
    });
  });

  return router;
}
