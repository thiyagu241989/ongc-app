import { Kafka, type Producer, logLevel } from "kafkajs";
import type { Logger } from "pino";

export interface EventEnvelope<TData> {
  eventId: string;
  eventType: string;
  eventVersion: number;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number;
  occurredAtUtc: string;
  correlationId: string;
  causationId: string | null;
  producer: string;
  data: TData;
}

export interface ProjectCreatedV1 {
  projectId: string;
  projectCode: string;
  projectName: string;
  wellName: string;
  operatorName: string | null;
  fieldName: string | null;
  basin: string | null;
  location: string | null;
  status: string;
  description: string | null;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAtUtc: string;
  createdBy: string;
}

export interface ProjectUpdatedV1 {
  projectId: string;
  projectCode: string;
  projectName: string;
  wellName: string;
  operatorName: string | null;
  fieldName: string | null;
  basin: string | null;
  location: string | null;
  status: string;
  description: string | null;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAtUtc: string;
  createdBy: string;
  updatedAtUtc: string;
  updatedBy: string;
}

export interface ProjectDeletedV1 {
  projectId: string;
  projectCode: string;
  deletedAtUtc: string;
  deletedBy: string;
}

export class KafkaEventPublisher {
  private producer: Producer;

  public constructor(
    private readonly kafka: Kafka,
    private readonly topic: string,
    private readonly logger: Logger
  ) {
    this.producer = this.kafka.producer({
      allowAutoTopicCreation: false,
      idempotent: true,
      maxInFlightRequests: 5
    });
  }

  public async connect(): Promise<void> {
    await this.producer.connect();
  }

  public async disconnect(): Promise<void> {
    await this.producer.disconnect();
  }

  public async publish<TData>(
    projectId: string,
    aggregateVersion: number,
    eventType: string,
    data: TData,
    correlationId: string
  ): Promise<void> {
    const envelope: EventEnvelope<TData> = {
      eventId: crypto.randomUUID(),
      eventType,
      eventVersion: 1,
      aggregateType: "Project",
      aggregateId: projectId,
      aggregateVersion,
      occurredAtUtc: new Date().toISOString(),
      correlationId,
      causationId: null,
      producer: "well-information-api",
      data
    };

    try {
      await this.producer.send({
        topic: this.topic,
        acks: -1,
        messages: [
          {
            key: projectId,
            value: JSON.stringify(envelope),
            headers: {
              "content-type": "application/json",
              "event-type": eventType,
              "event-version": "1",
              "correlation-id": correlationId
            }
          }
        ]
      });
    } catch (error) {
      this.logger.error(
        { error, projectId, aggregateVersion, eventType },
        "Kafka publish failed"
      );
      throw error;
    }
  }
}

export function createKafka(brokers: readonly string[], clientId: string): Kafka {
  return new Kafka({ clientId, brokers: [...brokers], logLevel: logLevel.NOTHING });
}
