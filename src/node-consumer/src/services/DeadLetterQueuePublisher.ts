import type { EachMessagePayload, Producer } from "kafkajs";
import type { Logger } from "pino";

export class DeadLetterQueuePublisher {
  public constructor(
    private readonly producer: Producer,
    private readonly dlqTopic: string,
    private readonly consumerGroupId: string,
    private readonly consumerName: string,
    private readonly logger: Logger
  ) {}

  public async connect(): Promise<void> {
    await this.producer.connect();
  }

  public async disconnect(): Promise<void> {
    await this.producer.disconnect();
  }

  public async publish(
    payload: EachMessagePayload,
    reason: string,
    attemptCount: number
  ): Promise<void> {
    const messageKey = payload.message.key?.toString("utf8") ?? null;
    const dlqEnvelope = JSON.stringify({
      originalTopic: payload.topic,
      originalPartition: payload.partition,
      originalOffset: payload.message.offset,
      originalKey: messageKey,
      originalPayload: payload.message.value?.toString("utf8") ?? null,
      consumerGroup: this.consumerGroupId,
      consumerName: this.consumerName,
      attemptCount,
      reason: reason.slice(0, 2000),
      failedAtUtc: new Date().toISOString()
    });

    try {
      await this.producer.send({
        topic: this.dlqTopic,
        acks: -1,
        messages: [{ key: messageKey, value: dlqEnvelope }]
      });
      this.logger.error(
        {
          topic: payload.topic,
          partition: payload.partition,
          offset: payload.message.offset,
          reason
        },
        "Project event sent to DLQ"
      );
    } catch (error) {
      this.logger.error(
        {
          error,
          topic: payload.topic,
          partition: payload.partition,
          offset: payload.message.offset,
          reason
        },
        "Failed to publish project event to DLQ"
      );
      throw error;
    }
  }
}
