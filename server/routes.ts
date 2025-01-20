import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { setupWebSocket } from "./websocket";
import { db } from "@db";
import { rooms, roomMessages, roomParticipants, scenarios, userProgress } from "@db/schema";
import { eq, desc, and } from "drizzle-orm";
import { nanoid } from "nanoid";

export function registerRoutes(app: Express): Server {
  // Setup authentication first
  setupAuth(app);

  // Scenarios API
  app.get("/api/scenarios", async (_req: Request, res: Response) => {
    try {
      const allScenarios = await db.select().from(scenarios);

      if (!allScenarios.length) {
        // Add initial scenarios if none exist
        const initialScenarios = [
          {
            title: "Cardiac Arrest Management",
            description: "Handle a case of sudden cardiac arrest in the emergency department",
            type: "emergency",
            content: {
              initialState: "Patient presents with sudden collapse",
              objectives: ["Assess vital signs", "Initiate CPR protocol", "Manage cardiac rhythm"],
              vitalSigns: { bp: "0/0", pulse: "0", resp: "0", o2sat: "85%" }
            }
          },
          {
            title: "Respiratory Distress",
            description: "Manage acute respiratory distress in an adult patient",
            type: "emergency",
            content: {
              initialState: "Patient presents with severe shortness of breath",
              objectives: ["Assess airway", "Check oxygen saturation", "Initiate appropriate oxygen therapy"],
              vitalSigns: { bp: "140/90", pulse: "120", resp: "28", o2sat: "88%" }
            }
          },
          {
            title: "Diabetes Initial Consultation",
            description: "Conduct initial consultation for newly diagnosed type 2 diabetes",
            type: "clinical",
            content: {
              initialState: "Patient referred for diabetes management",
              objectives: ["Review medical history", "Assess current symptoms", "Develop management plan"],
              labResults: { hba1c: "8.2%", fastingGlucose: "180" }
            }
          },
          {
            title: "Hypertension Follow-up",
            description: "Conduct follow-up consultation for hypertension management",
            type: "clinical",
            content: {
              initialState: "Regular follow-up for hypertension",
              objectives: ["Review blood pressure logs", "Assess medication compliance", "Adjust treatment if needed"],
              vitalSigns: { bp: "150/95", pulse: "76" }
            }
          }
        ];

        await db.insert(scenarios).values(initialScenarios);
        return res.json(initialScenarios);
      }

      res.json(allScenarios);
    } catch (error) {
      console.error("Get scenarios error:", error);
      res.status(500).json({ message: "Failed to get scenarios" });
    }
  });

  // User Progress API
  app.get("/api/progress", async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const progress = await db.select()
        .from(userProgress)
        .where(eq(userProgress.userId, req.user.id))
        .orderBy(desc(userProgress.completedAt));

      res.json(progress);
    } catch (error) {
      console.error("Get progress error:", error);
      res.status(500).json({ message: "Failed to get progress" });
    }
  });

  // Room Management API
  app.post("/api/rooms", async (req: Request, res: Response) => {
    try {
      const { scenarioId, maxParticipants = 4 } = req.body;

      if (!scenarioId) {
        return res.status(400).json({ message: "Scenario ID is required" });
      }

      // Generate a unique 6-character room code
      const code = nanoid(6).toUpperCase();

      const [room] = await db.insert(rooms)
        .values({
          code,
          scenarioId,
          maxParticipants,
          createdAt: new Date(),
        })
        .returning();

      res.json(room);
    } catch (error) {
      console.error("Create room error:", error);
      res.status(500).json({ message: "Failed to create room" });
    }
  });

  app.post("/api/rooms/join", async (req: Request, res: Response) => {
    try {
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({ message: "Room code is required" });
      }

      const [room] = await db.select()
        .from(rooms)
        .where(eq(rooms.code, code.toUpperCase()))
        .limit(1);

      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      if (room.endedAt) {
        return res.status(400).json({ message: "Room has ended" });
      }

      // Check participant count
      const [{ count }] = await db.select({ 
        count: db.fn.count(roomParticipants.id).mapWith(Number)
      })
      .from(roomParticipants)
      .where(
        and(
          eq(roomParticipants.roomId, room.id),
          eq(roomParticipants.leftAt, null)
        )
      );

      if (count >= (room.maxParticipants ?? 4)) {
        return res.status(400).json({ message: "Room is full" });
      }

      res.json(room);
    } catch (error) {
      console.error("Join room error:", error);
      res.status(500).json({ message: "Failed to join room" });
    }
  });

  app.get("/api/rooms/:roomId/messages", async (req: Request, res: Response) => {
    try {
      const { roomId } = req.params;

      const messages = await db.select()
        .from(roomMessages)
        .where(eq(roomMessages.roomId, parseInt(roomId)))
        .orderBy(desc(roomMessages.createdAt))
        .limit(100);

      res.json(messages);
    } catch (error) {
      console.error("Get room messages error:", error);
      res.status(500).json({ message: "Failed to get room messages" });
    }
  });

  const httpServer = createServer(app);
  setupWebSocket(httpServer);

  return httpServer;
}