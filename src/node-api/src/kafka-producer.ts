import { Kafka, type Producer } from "kafkajs";
import { randomUUID } from "node:crypto";
import type pino from "pino";

interface EventEnvelope<TData> {
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

export class KafkaEventPublisher {
  private producer: Producer;
  private connected = false;

  constructor(
    private readonly kafka: Kafka,
    private readonly topic: string,
    private readonly logger: pino.Logger,
  ) {
    this.producer = kafka.producer({
      allowAutoTopicCreation: false,
      idempotent: true,
      maxInFlightRequests: 5,
    });
  }

  async connect(): Promise<void> {
    if (!this.connected) {
      await this.producer.connect();
      this.connected = true;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.producer.disconnect();
      this.connected = false;
    }
  }

  async publish<TData>(
    aggregateId: string,
    aggregateVersion: number,
    eventType: string,
    data: TData,
    correlationId: string,
  ): Promise<void> {
    const envelope: EventEnvelope<TData> = {
      eventId: randomUUID(),
      eventType,
      eventVersion: 1,
      aggregateType: "WellboreDesign",
      aggregateId,
      aggregateVersion,
      occurredAtUtc: new Date().toISOString(),
      correlationId,
      causationId: null,
      producer: "well-information-api",
      data,
    };

    const result = await this.producer.send({
      topic: this.topic,
      acks: -1,
      messages: [
        {
          key: aggregateId,
          value: JSON.stringify(envelope),
          headers: {
            "content-type": "application/json",
            "event-type": eventType,
            "event-version": "1",
            "correlation-id": correlationId,
          },
        },
      ],
    });

    this.logger.debug(
      {
        eventType,
        topic: result[0].topicName,
        partition: result[0].partition,
        offset: result[0].baseOffset,
      },
      "Published event to Kafka",
    );
  }
}
