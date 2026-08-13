import { Pool } from "pg";
import pino from "pino";
import { config } from "./config.js";
import { createApp } from "./app.js";
import { createKafka, KafkaEventPublisher } from "./kafka-producer.js";

const logger = pino({ level: config.logLevel });
const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });
const kafka = createKafka(config.kafkaBrokers, config.kafkaClientId);
const publisher = new KafkaEventPublisher(kafka, config.kafkaTopic, logger);

pool.on("error", (error) => {
  logger.error({ error }, "PostgreSQL pool emitted an unexpected error");
});

async function start(): Promise<void> {
  await pool.query("SELECT 1");
  logger.info("PostgreSQL connection verified");

  await publisher.connect();
  logger.info("Kafka producer connected");

  const app = createApp(pool, publisher, logger);

  app.listen(config.port, () => {
    logger.info({ port: config.port }, "Node.js API server started");
  });
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "API server shutting down");
  const results = await Promise.allSettled([publisher.disconnect(), pool.end()]);
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
  logger.fatal({ error }, "Uncaught exception in API process");
  void shutdown("uncaughtException").finally(() => process.exit(1));
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "Unhandled promise rejection in API process");
  void shutdown("unhandledRejection").finally(() => process.exit(1));
});

start().catch((error: unknown) => {
  logger.fatal({ error }, "API server failed to start");
  process.exitCode = 1;
});
