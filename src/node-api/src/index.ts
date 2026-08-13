import { Kafka, logLevel } from "kafkajs";
import { Pool } from "pg";
import pino from "pino";
import { config } from "./config.js";
import { KafkaEventPublisher } from "./kafka-producer.js";
import { buildApp } from "./app.js";

const logger = pino({ level: config.logLevel });

const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });
pool.on("error", (err) => {
  logger.error({ err }, "PostgreSQL pool emitted an unexpected error");
});

const kafka = new Kafka({
  clientId: config.kafkaClientId,
  brokers: config.kafkaBrokers,
  logLevel: logLevel.NOTHING,
});

const publisher = new KafkaEventPublisher(
  kafka,
  config.kafkaWellboreDesignTopic,
  logger,
);

const app = buildApp(pool, publisher, config.logLevel);

async function start(): Promise<void> {
  await pool.query("SELECT 1");
  logger.info("PostgreSQL connection verified");

  await publisher.connect();
  logger.info("Kafka producer connected");

  app.listen(config.port, () => {
    logger.info({ port: config.port }, "API server started");
  });
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "API server shutting down");
  const results = await Promise.allSettled([
    publisher.disconnect(),
    pool.end(),
  ]);
  for (const result of results) {
    if (result.status === "rejected") {
      logger.error({ error: result.reason }, "Shutdown step failed");
    }
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void shutdown(signal).finally(() => process.exit(0));
  });
}

process.on("uncaughtException", (error) => {
  logger.fatal({ error }, "Uncaught exception");
  void shutdown("uncaughtException").finally(() => process.exit(1));
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "Unhandled rejection");
  void shutdown("unhandledRejection").finally(() => process.exit(1));
});

start().catch((error: unknown) => {
  logger.fatal({ error }, "API server failed to start");
  process.exitCode = 1;
});
