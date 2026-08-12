import type { Pool, PoolClient } from "pg";
import type {
  ProjectDeletedEnvelope,
  ProjectEventEnvelope,
  ProjectUpsertEnvelope
} from "../projectContracts.js";

export interface KafkaPosition {
  topic: string;
  partition: number;
  offset: string;
  key: string | null;
}

export type ProjectionResult = "Processed" | "Duplicate" | "IgnoredStale";

export class ProjectRepository {
  public constructor(
    private readonly pool: Pool,
    private readonly consumerName: string,
    private readonly consumerGroup: string
  ) {}

  public async apply(
    event: ProjectEventEnvelope,
    position: KafkaPosition
  ): Promise<ProjectionResult> {
    return event.eventType === "ProjectDeleted"
      ? this.applyDeleted(event, position)
      : this.applyUpsert(event, position);
  }

  public async applyUpsert(
    event: ProjectUpsertEnvelope,
    position: KafkaPosition
  ): Promise<ProjectionResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const logInserted = await this.insertProcessingLog(client, event, position);
      if (!logInserted) {
        await client.query("ROLLBACK");
        return "Duplicate";
      }

      const projection = await client.query(
        `
        INSERT INTO projects (
          project_id, project_code, project_name, well_name, operator_name,
          field_name, basin, location, status, description, planned_start_date,
          planned_end_date, latitude, longitude, aggregate_version,
          source_event_id, is_deleted, created_at, updated_at, deleted_at,
          event_occurred_at, stored_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
          $15, $16, false, $17, $18, NULL, $19, clock_timestamp()
        )
        ON CONFLICT (project_id) DO UPDATE SET
          project_code = EXCLUDED.project_code,
          project_name = EXCLUDED.project_name,
          well_name = EXCLUDED.well_name,
          operator_name = EXCLUDED.operator_name,
          field_name = EXCLUDED.field_name,
          basin = EXCLUDED.basin,
          location = EXCLUDED.location,
          status = EXCLUDED.status,
          description = EXCLUDED.description,
          planned_start_date = EXCLUDED.planned_start_date,
          planned_end_date = EXCLUDED.planned_end_date,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          aggregate_version = EXCLUDED.aggregate_version,
          source_event_id = EXCLUDED.source_event_id,
          is_deleted = false,
          updated_at = EXCLUDED.updated_at,
          deleted_at = NULL,
          event_occurred_at = EXCLUDED.event_occurred_at,
          stored_at = clock_timestamp()
        WHERE projects.aggregate_version < EXCLUDED.aggregate_version
        RETURNING project_id
        `,
        [
          event.data.projectId,
          event.data.projectCode,
          event.data.projectName,
          event.data.wellName,
          event.data.operatorName,
          event.data.fieldName,
          event.data.basin,
          event.data.location,
          event.data.status,
          event.data.description,
          event.data.plannedStartDate,
          event.data.plannedEndDate,
          event.data.latitude,
          event.data.longitude,
          event.aggregateVersion,
          event.eventId,
          event.data.createdAtUtc,
          event.eventType === "ProjectUpdated" ? event.data.updatedAtUtc : event.data.createdAtUtc,
          event.occurredAtUtc
        ]
      );

      const status: ProjectionResult = projection.rowCount === 1 ? "Processed" : "IgnoredStale";
      await client.query(
        `
        UPDATE kafka_consumer_logs
        SET status = $1, processed_at = clock_timestamp()
        WHERE consumer_name = $2 AND event_id = $3
        `,
        [status, this.consumerName, event.eventId]
      );
      await client.query("COMMIT");
      return status;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async applyDeleted(
    event: ProjectDeletedEnvelope,
    position: KafkaPosition
  ): Promise<ProjectionResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const logInserted = await this.insertProcessingLog(client, event, position);
      if (!logInserted) {
        await client.query("ROLLBACK");
        return "Duplicate";
      }

      const projection = await client.query(
        `
        UPDATE projects
        SET aggregate_version = $1,
            source_event_id = $2,
            is_deleted = true,
            updated_at = $3,
            deleted_at = $3,
            event_occurred_at = $4,
            stored_at = clock_timestamp()
        WHERE project_id = $5 AND aggregate_version < $1
        RETURNING project_id
        `,
        [
          event.aggregateVersion,
          event.eventId,
          event.data.deletedAtUtc,
          event.occurredAtUtc,
          event.data.projectId
        ]
      );

      const status: ProjectionResult = projection.rowCount === 1 ? "Processed" : "IgnoredStale";
      await client.query(
        `
        UPDATE kafka_consumer_logs
        SET status = $1, processed_at = clock_timestamp()
        WHERE consumer_name = $2 AND event_id = $3
        `,
        [status, this.consumerName, event.eventId]
      );
      await client.query("COMMIT");
      return status;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async insertProcessingLog(
    client: PoolClient,
    event: ProjectEventEnvelope,
    position: KafkaPosition
  ): Promise<boolean> {
    const result = await client.query(
      `
      INSERT INTO kafka_consumer_logs (
        consumer_name, consumer_group, event_id, event_type, aggregate_id,
        aggregate_version, topic, partition_id, offset_value, message_key, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Processing')
      ON CONFLICT DO NOTHING
      RETURNING consumer_log_id
      `,
      [
        this.consumerName,
        this.consumerGroup,
        event.eventId,
        event.eventType,
        event.aggregateId,
        event.aggregateVersion,
        position.topic,
        position.partition,
        position.offset,
        position.key
      ]
    );
    return result.rowCount === 1;
  }
}