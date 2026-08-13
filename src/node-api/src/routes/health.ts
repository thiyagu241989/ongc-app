import { Router } from "express";
import type { Pool } from "pg";

export function createHealthRouter(pool: Pool): Router {
  const router = Router();

  router.get("/health/live", (_req, res) => {
    res.json({ status: "Healthy" });
  });

  router.get("/health/ready", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "Healthy" });
    } catch {
      res.status(503).json({ status: "Unhealthy" });
    }
  });

  return router;
}
