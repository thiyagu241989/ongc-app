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
  KAFKA_BROKERS: z.string().min(1),
  KAFKA_CLIENT_ID: z.string().min(1),
  KAFKA_GROUP_ID: z.string().min(1),
  KAFKA_TOPIC: z.string().min(1),
  KAFKA_DLQ_TOPIC: z.string().min(1),
  KAFKA_WELLBORE_DESIGN_TOPIC: z.string().min(1).default("wellbore-designs.events.v1"),
  KAFKA_WELLBORE_DESIGN_DLQ_TOPIC: z.string().min(1).default("wellbore-designs.events.v1.dlq"),
  DATABASE_URL: z.string().min(1),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
});

const environment = environmentSchema.parse(process.env);

export const config = {
  kafkaBrokers: environment.KAFKA_BROKERS.split(",").map((broker) => broker.trim()),
  kafkaClientId: environment.KAFKA_CLIENT_ID,
  kafkaGroupId: environment.KAFKA_GROUP_ID,
  kafkaTopic: environment.KAFKA_TOPIC,
  kafkaDlqTopic: environment.KAFKA_DLQ_TOPIC,
  kafkaWellboreDesignTopic: environment.KAFKA_WELLBORE_DESIGN_TOPIC,
  kafkaWellboreDesignDlqTopic: environment.KAFKA_WELLBORE_DESIGN_DLQ_TOPIC,
  databaseUrl: environment.DATABASE_URL,
  logLevel: environment.LOG_LEVEL
} as const;