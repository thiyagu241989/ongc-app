import { Router } from "express";
import type { Pool } from "pg";

export function createDashboardRouter(pool: Pool): Router {
  const router = Router();

  router.get("/", async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const page = parseInt(String(req.query.page ?? "1"), 10);
    const pageSize = parseInt(String(req.query.pageSize ?? "25"), 10);

    if (page < 1 || pageSize < 1 || pageSize > 100) {
      res.status(400).json({
        errors: {
          page: ["Page must be at least 1."],
          pageSize: ["Page size must be between 1 and 100."]
        }
      });
      return;
    }

    const conditions: string[] = ["NOT is_deleted"];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (search && search.trim().length > 0) {
      const pattern = `%${search.trim()}%`;
      conditions.push(
        `(project_code ILIKE $${paramIndex} OR project_name ILIKE $${paramIndex} OR well_name ILIKE $${paramIndex})`
      );
      params.push(pattern);
      paramIndex++;
    }

    if (status && status.trim().length > 0) {
      conditions.push(`status = $${paramIndex}`);
      params.push(status.trim());
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const offset = (page - 1) * pageSize;

    params.push(pageSize);
    const limitParam = paramIndex++;
    params.push(offset);
    const offsetParam = paramIndex;

    const result = await pool.query(
      `
      SELECT project_id, project_code, project_name, well_name, operator_name,
             field_name, basin, location, status, description, planned_start_date,
             planned_end_date, latitude, longitude, aggregate_version,
             source_event_id, created_at, updated_at, event_occurred_at, stored_at
      FROM projects
      ${whereClause}
      ORDER BY updated_at DESC
      LIMIT $${limitParam} OFFSET $${offsetParam}
      `,
      params
    );

    const projects = result.rows.map((row) => ({
      projectId: row.project_id,
      projectCode: row.project_code,
      projectName: row.project_name,
      wellName: row.well_name,
      operatorName: row.operator_name,
      fieldName: row.field_name,
      basin: row.basin,
      location: row.location,
      status: row.status,
      description: row.description,
      plannedStartDate: row.planned_start_date,
      plannedEndDate: row.planned_end_date,
      latitude: row.latitude != null ? parseFloat(row.latitude) : null,
      longitude: row.longitude != null ? parseFloat(row.longitude) : null,
      version: parseInt(row.aggregate_version, 10),
      sourceEventId: row.source_event_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      eventOccurredAt: row.event_occurred_at,
      storedAt: row.stored_at
    }));

    res.json(projects);
  });

  router.get("/:projectId", async (req, res) => {
    const { projectId } = req.params;

    const result = await pool.query(
      `
      SELECT project_id, project_code, project_name, well_name, operator_name,
             field_name, basin, location, status, description, planned_start_date,
             planned_end_date, latitude, longitude, aggregate_version,
             source_event_id, created_at, updated_at, event_occurred_at, stored_at
      FROM projects
      WHERE project_id = $1 AND NOT is_deleted
      `,
      [projectId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ status: 404, title: "Not Found" });
      return;
    }

    const row = result.rows[0]!;
    res.json({
      projectId: row.project_id,
      projectCode: row.project_code,
      projectName: row.project_name,
      wellName: row.well_name,
      operatorName: row.operator_name,
      fieldName: row.field_name,
      basin: row.basin,
      location: row.location,
      status: row.status,
      description: row.description,
      plannedStartDate: row.planned_start_date,
      plannedEndDate: row.planned_end_date,
      latitude: row.latitude != null ? parseFloat(row.latitude) : null,
      longitude: row.longitude != null ? parseFloat(row.longitude) : null,
      version: parseInt(row.aggregate_version, 10),
      sourceEventId: row.source_event_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      eventOccurredAt: row.event_occurred_at,
      storedAt: row.stored_at
    });
  });

  return router;
}
