import dotenv from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

function loadEnvironmentFiles(): void {
  const candidatePaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env"),
  ];
  for (const candidatePath of candidatePaths) {
    if (existsSync(candidatePath)) {
      dotenv.config({ path: candidatePath, override: false });
    }
  }
}

loadEnvironmentFiles();

const environmentSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5080),
  KAFKA_BROKERS: z.string().min(1),
  KAFKA_CLIENT_ID: z.string().min(1).default("well-information-api"),
  KAFKA_WELLBORE_DESIGN_TOPIC: z
    .string()
    .min(1)
    .default("wellbore-designs.events.v1"),
  DATABASE_URL: z.string().min(1),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
});

const environment = environmentSchema.parse(process.env);

export const config = {
  port: environment.PORT,
  kafkaBrokers: environment.KAFKA_BROKERS.split(",").map((b) => b.trim()),
  kafkaClientId: environment.KAFKA_CLIENT_ID,
  kafkaWellboreDesignTopic: environment.KAFKA_WELLBORE_DESIGN_TOPIC,
  databaseUrl: environment.DATABASE_URL,
  logLevel: environment.LOG_LEVEL,
} as const;
