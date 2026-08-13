import express, { type Request, type Response, type NextFunction } from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import pinoHttp from "pino-http";
import type { Pool } from "pg";
import type { KafkaEventPublisher } from "./kafka-producer.js";
import { createWellboreDesignsRouter } from "./routes/wellbore-designs.js";
import { createDashboardRouter } from "./routes/dashboard.js";
import { createHealthRouter } from "./routes/health.js";

export function buildApp(pool: Pool, publisher: KafkaEventPublisher, logLevel: string) {
  const app = express();

  const httpLogger = (pinoHttp as unknown as typeof pinoHttp.default)({
    level: logLevel,
    autoLogging: {
      ignore: (req) => {
        const url = (req as any).originalUrl ?? (req as any).url ?? "";
        return url.startsWith("/health");
      },
    },
  });
  app.use(httpLogger);

  app.use(express.json());

  // Static files
  const devPublic = path.resolve(import.meta.dirname, "..", "public");
  const distPublic = path.resolve(import.meta.dirname, "..", "..", "public");
  const publicDir = existsSync(devPublic) ? devPublic : distPublic;

  app.use(express.static(publicDir));

  // API routes
  app.use("/api/v1/wellbore-designs", createWellboreDesignsRouter(pool, publisher));
  app.use("/api/v1/dashboard/insight", createDashboardRouter(pool));
  app.use("/health", createHealthRouter(pool));

  // JSON parse error handler
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (err.type === "entity.parse.failed") {
      res.status(400).json({
        title: "One or more validation errors occurred.",
        status: 400,
        errors: { Request: ["Invalid JSON in request body."] },
      });
      return;
    }
    next(err);
  });

  return app;
}
