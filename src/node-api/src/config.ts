import dotenv from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

function loadEnvironmentFiles(): void {
  const candidatePaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env")
  ];

  for (const candidatePath of candidatePaths) {
    if (existsSync(candidatePath)) {
      dotenv.config({ path: candidatePath, override: false });
    }
  }
}

loadEnvironmentFiles();

const environmentSchema = z.object({
  PORT: z.string().default("5080"),
  KAFKA_BROKERS: z.string().min(1),
  KAFKA_CLIENT_ID: z.string().min(1).default("well-information-api"),
  KAFKA_TOPIC: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info")
});

const environment = environmentSchema.parse(process.env);

export const config = {
  port: parseInt(environment.PORT, 10),
  kafkaBrokers: environment.KAFKA_BROKERS.split(",").map((broker) => broker.trim()),
  kafkaClientId: environment.KAFKA_CLIENT_ID,
  kafkaTopic: environment.KAFKA_TOPIC,
  databaseUrl: environment.DATABASE_URL,
  logLevel: environment.LOG_LEVEL
} as const;
