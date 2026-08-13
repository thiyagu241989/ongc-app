import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { ZodError } from "zod";
import type { KafkaEventPublisher } from "../kafka-producer.js";
import {
  createWellboreDesignSchema,
  recordMilestoneSchema,
  formatValidationErrors,
  deriveStatus,
} from "../validation.js";

interface WellboreDesignCreatedV1 {
  wellboreDesignId: string;
  company: string;
  project: string;
  site: string;
  well: string;
  wellbore: string;
  design: string;
  ownerName: string;
  designType: string;
  milestones: Array<{ milestoneType: string; occurredAt: string }>;
  createdAtUtc: string;
}

interface MilestoneRecordedV1 {
  wellboreDesignId: string;
  milestoneType: string;
  occurredAt: string;
  recordedAtUtc: string;
}

export function createWellboreDesignsRouter(
  pool: Pool,
  publisher: KafkaEventPublisher,
): Router {
  const router = Router();

  // POST /api/v1/wellbore-designs
  router.post("/", async (req: Request, res: Response) => {
    const parseResult = createWellboreDesignSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        title: "One or more validation errors occurred.",
        status: 400,
        errors: formatValidationErrors(parseResult.error),
      });
      return;
    }

    const data = parseResult.data;
    const company = data.company.trim();
    const project = data.project.trim();
    const site = data.site.trim();
    const well = data.well.trim();
    const wellbore = data.wellbore.trim();
    const design = data.design.trim();
    const ownerName = data.ownerName.trim();
    const designType = data.designType.trim();
    const correlationId =
      (req.headers["x-correlation-id"] as string) ?? randomUUID();

    // Check duplicate (including deleted)
    const dupCheck = await pool.query(
      `SELECT 1 FROM wellbore_designs
       WHERE company = $1 AND project = $2 AND site = $3
         AND well = $4 AND wellbore = $5 AND design = $6
         AND owner_name = $7`,
      [company, project, site, well, wellbore, design, ownerName],
    );
    if (dupCheck.rowCount! > 0) {
      res.status(409).json({
        status: 409,
        title: "Wellbore design already exists",
        detail: `A wellbore design already exists for Company=${company}, Project=${project}, Site=${site}, Well=${well}, Wellbore=${wellbore}, Design=${design}.`,
      });
      return;
    }

    const now = new Date().toISOString();
    const id = randomUUID();
    const milestones = (data.milestones ?? []).map((m) => ({
      milestoneType: m.milestoneType,
      occurredAt: m.occurredAt,
    }));

    const eventData: WellboreDesignCreatedV1 = {
      wellboreDesignId: id,
      company,
      project,
      site,
      well,
      wellbore,
      design,
      ownerName,
      designType,
      milestones,
      createdAtUtc: now,
    };

    try {
      await publisher.publish(id, 1, "WellboreDesignCreated", eventData, correlationId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown Kafka error";
      res.status(503).json({
        status: 503,
        title: "Event broker unavailable",
        detail: message,
      });
      return;
    }

    const milestoneTypes = milestones.map((m) => m.milestoneType);
    const status = deriveStatus(milestoneTypes, designType);

    res.status(202).json({
      id,
      company,
      project,
      site,
      well,
      wellbore,
      design,
      ownerName,
      designType,
      status,
      version: 1,
      createdAtUtc: now,
      updatedAtUtc: now,
      milestones: milestones.map((m) => ({
        milestoneType: m.milestoneType,
        occurredAt: m.occurredAt,
      })),
    });
  });

  // POST /api/v1/wellbore-designs/:id/milestones
  router.post("/:id/milestones", async (req: Request, res: Response) => {
    const designId = req.params.id as string;

    const parseResult = recordMilestoneSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        title: "One or more validation errors occurred.",
        status: 400,
        errors: formatValidationErrors(parseResult.error),
      });
      return;
    }

    const data = parseResult.data;
    const correlationId =
      (req.headers["x-correlation-id"] as string) ?? randomUUID();

    // Look up the design
    const designRow = await pool.query(
      `SELECT id, company, project, site, well, wellbore, design,
              owner_name, design_type, status, aggregate_version,
              created_at, updated_at
       FROM wellbore_designs
       WHERE id = $1 AND NOT is_deleted`,
      [designId],
    );
    if (designRow.rowCount === 0) {
      res.status(404).json({ status: 404, title: "Not Found" });
      return;
    }

    const designModel = designRow.rows[0];
    const now = new Date().toISOString();
    const newVersion = Number(designModel.aggregate_version) + 1;

    const eventData: MilestoneRecordedV1 = {
      wellboreDesignId: designId,
      milestoneType: data.milestoneType,
      occurredAt: data.occurredAt,
      recordedAtUtc: now,
    };

    try {
      await publisher.publish(
        designId,
        newVersion,
        "MilestoneRecorded",
        eventData,
        correlationId,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown Kafka error";
      res.status(503).json({
        status: 503,
        title: "Event broker unavailable",
        detail: message,
      });
      return;
    }

    // Fetch existing milestones to build response
    const existingMilestones = await pool.query(
      `SELECT milestone_type, occurred_at FROM milestones
       WHERE wellbore_design_id = $1 ORDER BY occurred_at`,
      [designId],
    );

    const allMilestoneResponses = [
      ...existingMilestones.rows.map((m) => ({
        milestoneType: m.milestone_type as string,
        occurredAt: (m.occurred_at as Date).toISOString(),
      })),
      { milestoneType: data.milestoneType, occurredAt: data.occurredAt },
    ];

    const allTypes = allMilestoneResponses.map((m) => m.milestoneType);
    const uniqueTypes = [...new Set(allTypes)];
    const status = deriveStatus(uniqueTypes, designModel.design_type as string);

    res.status(202).json({
      id: designModel.id,
      company: designModel.company,
      project: designModel.project,
      site: designModel.site,
      well: designModel.well,
      wellbore: designModel.wellbore,
      design: designModel.design,
      ownerName: designModel.owner_name,
      designType: designModel.design_type,
      status,
      version: newVersion,
      createdAtUtc: (designModel.created_at as Date).toISOString(),
      updatedAtUtc: now,
      milestones: allMilestoneResponses,
    });
  });

  // GET /api/v1/wellbore-designs/:id
  router.get("/:id", async (req: Request, res: Response) => {
    const designId = req.params.id;

    const designRow = await pool.query(
      `SELECT id, company, project, site, well, wellbore, design,
              owner_name, design_type, status, aggregate_version,
              created_at, updated_at
       FROM wellbore_designs
       WHERE id = $1 AND NOT is_deleted`,
      [designId],
    );
    if (designRow.rowCount === 0) {
      res.status(404).json({ status: 404, title: "Not Found" });
      return;
    }

    const d = designRow.rows[0];
    const milestones = await pool.query(
      `SELECT milestone_type, occurred_at FROM milestones
       WHERE wellbore_design_id = $1 ORDER BY occurred_at`,
      [designId],
    );

    res.json({
      id: d.id,
      company: d.company,
      project: d.project,
      site: d.site,
      well: d.well,
      wellbore: d.wellbore,
      design: d.design,
      ownerName: d.owner_name,
      designType: d.design_type,
      status: d.status,
      version: Number(d.aggregate_version),
      createdAtUtc: (d.created_at as Date).toISOString(),
      updatedAtUtc: (d.updated_at as Date).toISOString(),
      milestones: milestones.rows.map((m) => ({
        milestoneType: m.milestone_type as string,
        occurredAt: (m.occurred_at as Date).toISOString(),
      })),
    });
  });

  // GET /api/v1/wellbore-designs
  router.get("/", async (req: Request, res: Response) => {
    const company = (req.query.company as string)?.trim() || null;
    const well = (req.query.well as string)?.trim() || null;
    const status = (req.query.status as string)?.trim() || null;
    const owner = (req.query.owner as string)?.trim() || null;
    let page = Math.max(1, parseInt(req.query.page as string) || 1);
    let pageSize = parseInt(req.query.pageSize as string) || 25;
    if (pageSize < 1) pageSize = 1;
    if (pageSize > 100) pageSize = 100;

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
    const offset = (page - 1) * pageSize;

    const designs = await pool.query(
      `SELECT id, company, project, site, well, wellbore, design,
              owner_name, design_type, status, aggregate_version,
              created_at, updated_at
       FROM wellbore_designs
       WHERE ${whereClause}
       ORDER BY updated_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, pageSize, offset],
    );

    if (designs.rowCount === 0) {
      res.json([]);
      return;
    }

    const designIds = designs.rows.map((d) => d.id as string);
    const milestones = await pool.query(
      `SELECT wellbore_design_id, milestone_type, occurred_at
       FROM milestones
       WHERE wellbore_design_id = ANY($1)
       ORDER BY occurred_at`,
      [designIds],
    );

    const milestonesByDesign = new Map<
      string,
      Array<{ milestoneType: string; occurredAt: string }>
    >();
    for (const m of milestones.rows) {
      const key = m.wellbore_design_id as string;
      if (!milestonesByDesign.has(key)) milestonesByDesign.set(key, []);
      milestonesByDesign.get(key)!.push({
        milestoneType: m.milestone_type as string,
        occurredAt: (m.occurred_at as Date).toISOString(),
      });
    }

    const result = designs.rows.map((d) => ({
      id: d.id,
      company: d.company,
      project: d.project,
      site: d.site,
      well: d.well,
      wellbore: d.wellbore,
      design: d.design,
      ownerName: d.owner_name,
      designType: d.design_type,
      status: d.status,
      version: Number(d.aggregate_version),
      createdAtUtc: (d.created_at as Date).toISOString(),
      updatedAtUtc: (d.updated_at as Date).toISOString(),
      milestones: milestonesByDesign.get(d.id as string) ?? [],
    }));

    res.json(result);
  });

  return router;
}
