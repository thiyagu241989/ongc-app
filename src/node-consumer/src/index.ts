import { Kafka, logLevel } from "kafkajs";
import { Pool } from "pg";
import pino from "pino";
import { config } from "./config.js";
import { WellboreDesignEventConsumerHandler } from "./handlers/WellboreDesignEventConsumerHandler.js";
import { WellboreDesignRepository } from "./repositories/wellboreDesignRepository.js";
import { DeadLetterQueuePublisher } from "./services/DeadLetterQueuePublisher.js";

const logger = pino({ level: config.logLevel });
const kafka = new Kafka({
  clientId: config.kafkaClientId,
  brokers: config.kafkaBrokers,
  logLevel: logLevel.NOTHING
});
const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });
const consumer = kafka.consumer({ groupId: config.kafkaGroupId });
const deadLetterProducer = kafka.producer({ allowAutoTopicCreation: false, idempotent: true });
const dlqPublisher = new DeadLetterQueuePublisher(
  deadLetterProducer,
  config.kafkaWellboreDesignDlqTopic,
  config.kafkaGroupId,
  config.kafkaClientId,
  logger
);
const wellboreDesignRepository = new WellboreDesignRepository(pool, config.kafkaClientId, config.kafkaGroupId);
const wellboreDesignHandler = new WellboreDesignEventConsumerHandler(
  wellboreDesignRepository, dlqPublisher, logger
);

let isShuttingDown = false;

pool.on("error", (error) => {
  logger.error({ error }, "PostgreSQL pool emitted an unexpected error");
});

async function start(): Promise<void> {
  await pool.query("SELECT 1");
  await dlqPublisher.connect();
  await consumer.connect();
  await consumer.subscribe({ topics: [config.kafkaWellboreDesignTopic], fromBeginning: false });
  await consumer.run({
    autoCommit: false,
    eachMessage: async (payload) => {
      try {
        await wellboreDesignHandler.handle(payload);
      } catch (error) {
        logger.error(
          {
            error,
            topic: payload.topic,
            partition: payload.partition,
            offset: payload.message.offset
          },
          "Unexpected error while handling event"
        );
      }

      try {
        await consumer.commitOffsets([
          {
            topic: payload.topic,
            partition: payload.partition,
            offset: (BigInt(payload.message.offset) + 1n).toString()
          }
        ]);
      } catch (error) {
        logger.error(
          {
            error,
            topic: payload.topic,
            partition: payload.partition,
            offset: payload.message.offset
          },
          "Failed to commit consumer offset"
        );
      }
    }
  });

  logger.info(
    { topics: [config.kafkaWellboreDesignTopic], groupId: config.kafkaGroupId },
    "Consumer started"
  );
}

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  logger.info({ signal }, "Consumer shutting down");
  const shutdownResults = await Promise.allSettled([
    consumer.disconnect(),
    dlqPublisher.disconnect(),
    pool.end()
  ]);

  for (const result of shutdownResults) {
    if (result.status === "rejected") {
      logger.error({ error: result.reason }, "Shutdown step failed");
    }
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void shutdown(signal)
      .finally(() => process.exit(0));
  });
}

process.on("uncaughtException", (error) => {
  logger.fatal({ error }, "Uncaught exception in consumer process");
  void shutdown("uncaughtException").finally(() => process.exit(1));
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "Unhandled promise rejection in consumer process");
  void shutdown("unhandledRejection").finally(() => process.exit(1));
});

start().catch((error: unknown) => {
  logger.fatal({ error }, "Consumer failed to start");
  process.exitCode = 1;
});