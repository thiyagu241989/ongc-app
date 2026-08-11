import type { EachMessagePayload } from "kafkajs";
import type { Logger } from "pino";
import { ZodError } from "zod";
import { parseProjectEvent } from "../contracts.js";
import { ProjectRepository } from "../repositories/projectRepository.js";
import { executeWithRetry } from "../retry.js";
import { DeadLetterQueuePublisher } from "../services/DeadLetterQueuePublisher.js";

export class ProjectEventConsumerHandler {
  public constructor(
    private readonly repository: ProjectRepository,
    private readonly dlqPublisher: DeadLetterQueuePublisher,
    private readonly logger: Logger
  ) {}

  public async handle(payload: EachMessagePayload): Promise<void> {
    const messageValue = payload.message.value?.toString("utf8");
    if (messageValue === undefined) {
      await this.publishToDlq(payload, "Message value is missing", 1);
      return;
    }

    try {
      const event = parseProjectEvent(messageValue);
      const result = await executeWithRetry(
        () =>
          this.repository.apply(event, {
            topic: payload.topic,
            partition: payload.partition,
            offset: payload.message.offset,
            key: payload.message.key?.toString("utf8") ?? null
          }),
        5,
        [250, 1000, 5000, 15000],
        (error, attempt, delayMs) => {
          this.logger.warn(
            {
              error,
              attempt,
              delayMs,
              eventId: event.eventId,
              projectId: event.aggregateId
            },
            "Project event processing failed; retrying"
          );
        }
      );

      this.logger.info(
        {
          eventId: event.eventId,
          projectId: event.aggregateId,
          aggregateVersion: event.aggregateVersion,
          result
        },
        "Project event handled"
      );
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof ZodError) {
        await this.publishToDlq(payload, error.message, 1);
        return;
      }

      await this.publishToDlq(payload, this.toErrorMessage(error), 5);
    }
  }

  private async publishToDlq(
    payload: EachMessagePayload,
    reason: string,
    attemptCount: number
  ): Promise<void> {
    try {
      await this.dlqPublisher.publish(payload, reason, attemptCount);
    } catch (error) {
      this.logger.error(
        {
          error,
          topic: payload.topic,
          partition: payload.partition,
          offset: payload.message.offset,
          reason,
          attemptCount
        },
        "Unable to route failed project event to DLQ"
      );
    }
  }

  private toErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Unknown project event processing error";
  }
}
