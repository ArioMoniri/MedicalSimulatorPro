import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { scenarios, userProgress } from "@db/schema";
import { eq } from "drizzle-orm";

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Get available scenarios
  app.get("/api/scenarios", async (req, res) => {
    const allScenarios = await db.select().from(scenarios);
    res.json(allScenarios);
  });

  // Get specific scenario
  app.get("/api/scenarios/:id", async (req, res) => {
    const [scenario] = await db
      .select()
      .from(scenarios)
      .where(eq(scenarios.id, parseInt(req.params.id)))
      .limit(1);
    
    if (!scenario) {
      return res.status(404).send("Scenario not found");
    }
    
    res.json(scenario);
  });

  // Get user progress
  app.get("/api/progress", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const progress = await db
      .select()
      .from(userProgress)
      .where(eq(userProgress.userId, req.user.id));
    
    res.json(progress);
  });

  // Update user progress
  app.post("/api/progress/:scenarioId", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const { score, feedback } = req.body;
    const scenarioId = parseInt(req.params.scenarioId);

    const [updated] = await db
      .insert(userProgress)
      .values({
        userId: req.user.id,
        scenarioId,
        score,
        feedback,
        completed: true,
        completedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [userProgress.userId, userProgress.scenarioId],
        set: { score, feedback, completed: true, completedAt: new Date() },
      })
      .returning();

    res.json(updated);
  });

  const httpServer = createServer(app);
  return httpServer;
}
