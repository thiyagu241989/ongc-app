import { Router } from "express";
import type { Pool } from "pg";
import type { KafkaEventPublisher, ProjectCreatedV1, ProjectDeletedV1, ProjectUpdatedV1 } from "../kafka-producer.js";
import { parseAndValidateProjectRequest } from "../validation.js";

function normalize(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function parseIfMatch(header: string | undefined): number | null {
  if (!header) return null;
  const match = /^(?:W\/)?"(\d+)"$/.exec(header);
  if (!match?.[1]) return null;
  const version = parseInt(match[1], 10);
  return Number.isFinite(version) ? version : null;
}

function problemDetails(status: number, title: string, detail?: string) {
  return { status, title, ...(detail ? { detail } : {}) };
}

interface ProjectRow {
  project_id: string;
  project_code: string;
  project_name: string;
  well_name: string;
  operator_name: string | null;
  field_name: string | null;
  basin: string | null;
  location: string | null;
  status: string;
  description: string | null;
  planned_start_date: string | null;
  planned_end_date: string | null;
  latitude: string | null;
  longitude: string | null;
  aggregate_version: string;
  created_at: string;
  updated_at: string;
}

function toProjectResponse(row: ProjectRow) {
  return {
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
    createdAtUtc: row.created_at,
    updatedAtUtc: row.updated_at
  };
}

export function createProjectsRouter(pool: Pool, publisher: KafkaEventPublisher): Router {
  const router = Router();

  router.post("/", async (req, res) => {
    const result = parseAndValidateProjectRequest(req.body);
    if (!result.valid) {
      res.status(400).json({ title: "One or more validation errors occurred.", status: 400, errors: result.errors });
      return;
    }

    const request = result.value;
    const correlationId = (req.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    const actor = "anonymous";

    const projectCode = request.projectCode.trim().toUpperCase();
    const duplicate = await pool.query(
      "SELECT 1 FROM projects WHERE project_code = $1",
      [projectCode]
    );
    if ((duplicate.rowCount ?? 0) > 0) {
      res.status(409).json(
        problemDetails(409, "Project code already exists", `A project with code '${projectCode}' already exists.`)
      );
      return;
    }

    const now = new Date().toISOString();
    const projectId = crypto.randomUUID();

    const data: ProjectCreatedV1 = {
      projectId,
      projectCode,
      projectName: request.projectName.trim(),
      wellName: request.wellName.trim(),
      operatorName: normalize(request.operatorName),
      fieldName: normalize(request.fieldName),
      basin: normalize(request.basin),
      location: normalize(request.location),
      status: request.status.trim(),
      description: normalize(request.description),
      plannedStartDate: request.plannedStartDate,
      plannedEndDate: request.plannedEndDate,
      latitude: request.latitude,
      longitude: request.longitude,
      createdAtUtc: now,
      createdBy: actor
    };

    try {
      await publisher.publish(projectId, 1, "ProjectCreated", data, correlationId);
    } catch {
      res.status(503).json(
        problemDetails(503, "Event broker unavailable", "Failed to publish event to Kafka after retries.")
      );
      return;
    }

    const response = {
      projectId,
      projectCode,
      projectName: data.projectName,
      wellName: data.wellName,
      operatorName: data.operatorName,
      fieldName: data.fieldName,
      basin: data.basin,
      location: data.location,
      status: data.status,
      description: data.description,
      plannedStartDate: data.plannedStartDate,
      plannedEndDate: data.plannedEndDate,
      latitude: data.latitude,
      longitude: data.longitude,
      version: 1,
      createdAtUtc: now,
      updatedAtUtc: now
    };

    res.setHeader("ETag", `"1"`);
    res.setHeader("Location", `${req.baseUrl}/${projectId}`);
    res.status(202).json(response);
  });

  router.get("/:projectId", async (req, res) => {
    const { projectId } = req.params;

    const result = await pool.query(
      `
      SELECT project_id, project_code, project_name, well_name, operator_name,
             field_name, basin, location, status, description, planned_start_date,
             planned_end_date, latitude, longitude, aggregate_version,
             created_at, updated_at
      FROM projects
      WHERE project_id = $1 AND NOT is_deleted
      `,
      [projectId]
    );

    if (result.rowCount === 0) {
      res.status(404).json(problemDetails(404, "Not Found"));
      return;
    }

    const project = toProjectResponse(result.rows[0] as ProjectRow);
    res.setHeader("ETag", `"${project.version}"`);
    res.json(project);
  });

  router.put("/:projectId", async (req, res) => {
    const result = parseAndValidateProjectRequest(req.body);
    if (!result.valid) {
      res.status(400).json({ title: "One or more validation errors occurred.", status: 400, errors: result.errors });
      return;
    }

    const expectedVersion = parseIfMatch(req.headers["if-match"] as string | undefined);
    if (expectedVersion === null) {
      res.status(428).json(
        problemDetails(428, "A valid If-Match version is required")
      );
      return;
    }

    const { projectId } = req.params;
    const request = result.value;
    const correlationId = (req.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    const actor = "anonymous";

    const projectResult = await pool.query(
      `
      SELECT project_id, project_code, aggregate_version, created_at
      FROM projects
      WHERE project_id = $1 AND NOT is_deleted
      `,
      [projectId]
    );

    if (projectResult.rowCount === 0) {
      res.status(404).json(problemDetails(404, "Not Found"));
      return;
    }

    const existing = projectResult.rows[0] as {
      project_id: string;
      project_code: string;
      aggregate_version: string;
      created_at: string;
    };

    if (parseInt(existing.aggregate_version, 10) !== expectedVersion) {
      res.status(412).json(
        problemDetails(
          412,
          "Project version conflict",
          `Project '${projectId}' no longer has expected version ${expectedVersion}.`
        )
      );
      return;
    }

    const projectCode = request.projectCode.trim().toUpperCase();
    const duplicate = await pool.query(
      "SELECT 1 FROM projects WHERE project_code = $1 AND project_id != $2",
      [projectCode, projectId]
    );
    if ((duplicate.rowCount ?? 0) > 0) {
      res.status(409).json(
        problemDetails(409, "Project code already exists", `A project with code '${projectCode}' already exists.`)
      );
      return;
    }

    const now = new Date().toISOString();
    const newVersion = expectedVersion + 1;

    const data: ProjectUpdatedV1 = {
      projectId,
      projectCode,
      projectName: request.projectName.trim(),
      wellName: request.wellName.trim(),
      operatorName: normalize(request.operatorName),
      fieldName: normalize(request.fieldName),
      basin: normalize(request.basin),
      location: normalize(request.location),
      status: request.status.trim(),
      description: normalize(request.description),
      plannedStartDate: request.plannedStartDate,
      plannedEndDate: request.plannedEndDate,
      latitude: request.latitude,
      longitude: request.longitude,
      createdAtUtc: new Date(existing.created_at).toISOString(),
      createdBy: "node-consumer",
      updatedAtUtc: now,
      updatedBy: actor
    };

    try {
      await publisher.publish(projectId, newVersion, "ProjectUpdated", data, correlationId);
    } catch {
      res.status(503).json(
        problemDetails(503, "Event broker unavailable", "Failed to publish event to Kafka after retries.")
      );
      return;
    }

    const response = {
      projectId,
      projectCode,
      projectName: data.projectName,
      wellName: data.wellName,
      operatorName: data.operatorName,
      fieldName: data.fieldName,
      basin: data.basin,
      location: data.location,
      status: data.status,
      description: data.description,
      plannedStartDate: data.plannedStartDate,
      plannedEndDate: data.plannedEndDate,
      latitude: data.latitude,
      longitude: data.longitude,
      version: newVersion,
      createdAtUtc: data.createdAtUtc,
      updatedAtUtc: now
    };

    res.setHeader("ETag", `"${newVersion}"`);
    res.json(response);
  });

  router.delete("/:projectId", async (req, res) => {
    const expectedVersion = parseIfMatch(req.headers["if-match"] as string | undefined);
    if (expectedVersion === null) {
      res.status(428).json(
        problemDetails(428, "A valid If-Match version is required")
      );
      return;
    }

    const { projectId } = req.params;
    const correlationId = (req.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
    const actor = "anonymous";

    const projectResult = await pool.query(
      `
      SELECT project_id, project_code, aggregate_version
      FROM projects
      WHERE project_id = $1 AND NOT is_deleted
      `,
      [projectId]
    );

    if (projectResult.rowCount === 0) {
      res.status(404).json(problemDetails(404, "Not Found"));
      return;
    }

    const existing = projectResult.rows[0] as {
      project_id: string;
      project_code: string;
      aggregate_version: string;
    };

    if (parseInt(existing.aggregate_version, 10) !== expectedVersion) {
      res.status(412).json(
        problemDetails(
          412,
          "Project version conflict",
          `Project '${projectId}' no longer has expected version ${expectedVersion}.`
        )
      );
      return;
    }

    const now = new Date().toISOString();
    const data: ProjectDeletedV1 = {
      projectId,
      projectCode: existing.project_code,
      deletedAtUtc: now,
      deletedBy: actor
    };

    try {
      await publisher.publish(projectId, expectedVersion + 1, "ProjectDeleted", data, correlationId);
    } catch {
      res.status(503).json(
        problemDetails(503, "Event broker unavailable", "Failed to publish event to Kafka after retries.")
      );
      return;
    }

    res.status(204).end();
  });

  return router;
}
