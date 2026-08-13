import { Router, type Request, type Response } from "express";
import type { Pool } from "pg";

export function createHealthRouter(pool: Pool): Router {
  const router = Router();

  router.get("/live", (_req: Request, res: Response) => {
    res.json({ status: "Healthy" });
  });

  router.get("/ready", async (_req: Request, res: Response) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "Healthy" });
    } catch {
      res.status(503).json({ status: "Unhealthy" });
    }
  });

  return router;
}
