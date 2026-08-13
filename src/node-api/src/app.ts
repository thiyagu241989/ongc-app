import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";
import pinoHttp from "pino-http";
import type { Logger } from "pino";
import type { IncomingMessage } from "node:http";
import type { KafkaEventPublisher } from "./kafka-producer.js";
import { createDashboardRouter } from "./routes/dashboard.js";
import { createHealthRouter } from "./routes/health.js";
import { createProjectsRouter } from "./routes/projects.js";

// Resolve project root (works from both src/ via tsx and dist/src/ via node)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const publicDir = existsSync(path.join(projectRoot, "public"))
  ? path.join(projectRoot, "public")
  : path.resolve(__dirname, "..", "..", "public");

export function createApp(pool: Pool, publisher: KafkaEventPublisher, logger: Logger): express.Express {
  const app = express();

  const httpLogger = (pinoHttp as unknown as typeof pinoHttp.default)({
    logger,
    autoLogging: { ignore: (req: IncomingMessage) => (req.url ?? "").startsWith("/health/") }
  });
  app.use(httpLogger);
  app.use(express.json());

  app.use(createHealthRouter(pool));
  app.use("/api/v1/projects", createProjectsRouter(pool, publisher));
  app.use("/api/v1/dashboard/projects", createDashboardRouter(pool));

  app.use(express.static(publicDir));

  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      if ("type" in err && (err as Record<string, unknown>)["type"] === "entity.parse.failed") {
        res.status(400).json({
          status: 400,
          title: "Invalid JSON",
          detail: "The request body contains invalid JSON."
        });
        return;
      }

      logger.error({ err }, "Unhandled error");
      res.status(500).json({
        status: 500,
        title: "Internal Server Error"
      });
    }
  );

  return app;
}
