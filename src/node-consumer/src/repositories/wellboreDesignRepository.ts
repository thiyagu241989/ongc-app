import type { Pool, PoolClient } from "pg";
import type {
  WellboreDesignCreatedEnvelope,
  WellboreDesignEventEnvelope,
  MilestoneRecordedEnvelope
} from "../wellboreDesignContracts.js";
import { deriveStatus } from "../wellboreDesignContracts.js";

export interface KafkaPosition {
  topic: string;
  partition: number;
  offset: string;
  key: string | null;
}

export type ProjectionResult = "Processed" | "Duplicate" | "IgnoredStale";

export class WellboreDesignRepository {
  public constructor(
    private readonly pool: Pool,
    private readonly consumerName: string,
    private readonly consumerGroup: string
  ) {}

  public async apply(
    event: WellboreDesignEventEnvelope,
    position: KafkaPosition
  ): Promise<ProjectionResult> {
    return event.eventType === "WellboreDesignCreated"
      ? this.applyCreated(event, position)
      : this.applyMilestoneRecorded(event, position);
  }

  private async applyCreated(
    event: WellboreDesignCreatedEnvelope,
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

      const milestoneTypes = event.data.milestones.map((m) => m.milestoneType);
      const status = deriveStatus(milestoneTypes, event.data.designType);

      const projection = await client.query(
        `
        INSERT INTO wellbore_designs (
          id, company, project, site, well, wellbore, design, owner_name,
          design_type, status, aggregate_version, source_event_id,
          is_deleted, created_at, updated_at, event_occurred_at, stored_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
          false, $13, $13, $14, clock_timestamp()
        )
        ON CONFLICT (company, project, site, well, wellbore, design, owner_name) DO UPDATE SET
          owner_name = EXCLUDED.owner_name,
          design_type = EXCLUDED.design_type,
          status = EXCLUDED.status,
          aggregate_version = EXCLUDED.aggregate_version,
          source_event_id = EXCLUDED.source_event_id,
          updated_at = EXCLUDED.updated_at,
          event_occurred_at = EXCLUDED.event_occurred_at,
          stored_at = clock_timestamp()
        WHERE wellbore_designs.aggregate_version < EXCLUDED.aggregate_version
        RETURNING id
        `,
        [
          event.data.wellboreDesignId,
          event.data.company,
          event.data.project,
          event.data.site,
          event.data.well,
          event.data.wellbore,
          event.data.design,
          event.data.ownerName,
          event.data.designType,
          status,
          event.aggregateVersion,
          event.eventId,
          event.data.createdAtUtc,
          event.occurredAtUtc
        ]
      );

      // Insert milestones
      for (const milestone of event.data.milestones) {
        await client.query(
          `
          INSERT INTO milestones (wellbore_design_id, milestone_type, occurred_at, source_event_id)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (wellbore_design_id, milestone_type) DO UPDATE SET
            occurred_at = EXCLUDED.occurred_at,
            source_event_id = EXCLUDED.source_event_id
          `,
          [event.data.wellboreDesignId, milestone.milestoneType, milestone.occurredAt, event.eventId]
        );
      }

      const result: ProjectionResult = projection.rowCount === 1 ? "Processed" : "IgnoredStale";
      await this.markLogStatus(client, event.eventId, result);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async applyMilestoneRecorded(
    event: MilestoneRecordedEnvelope,
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

      // Insert the milestone
      await client.query(
        `
        INSERT INTO milestones (wellbore_design_id, milestone_type, occurred_at, source_event_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (wellbore_design_id, milestone_type) DO UPDATE SET
          occurred_at = EXCLUDED.occurred_at,
          source_event_id = EXCLUDED.source_event_id
        `,
        [event.data.wellboreDesignId, event.data.milestoneType, event.data.occurredAt, event.eventId]
      );

      // Fetch all milestone types for this design to derive status
      const existingMilestones = await client.query<{ milestone_type: string }>(
        `SELECT milestone_type FROM milestones WHERE wellbore_design_id = $1`,
        [event.data.wellboreDesignId]
      );
      const designRow = await client.query<{ design_type: string }>(
        `SELECT design_type FROM wellbore_designs WHERE id = $1`,
        [event.data.wellboreDesignId]
      );

      const allTypes = existingMilestones.rows.map((r) => r.milestone_type);
      const designType = designRow.rows[0]?.design_type ?? "Standard";
      const newStatus = deriveStatus(allTypes, designType);

      // Update design status and version
      const projection = await client.query(
        `
        UPDATE wellbore_designs
        SET status = $1,
            aggregate_version = $2,
            source_event_id = $3,
            updated_at = $4,
            event_occurred_at = $5,
            stored_at = clock_timestamp()
        WHERE id = $6 AND aggregate_version < $2
        RETURNING id
        `,
        [
          newStatus,
          event.aggregateVersion,
          event.eventId,
          event.data.recordedAtUtc,
          event.occurredAtUtc,
          event.data.wellboreDesignId
        ]
      );

      const result: ProjectionResult = projection.rowCount === 1 ? "Processed" : "IgnoredStale";
      await this.markLogStatus(client, event.eventId, result);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async insertProcessingLog(
    client: PoolClient,
    event: WellboreDesignEventEnvelope,
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
    return (result.rowCount ?? 0) === 1;
  }

  private async markLogStatus(
    client: PoolClient,
    eventId: string,
    status: ProjectionResult
  ): Promise<void> {
    await client.query(
      `
      UPDATE kafka_consumer_logs
      SET status = $1, processed_at = clock_timestamp()
      WHERE consumer_name = $2 AND event_id = $3
      `,
      [status, this.consumerName, eventId]
    );
  }
}
