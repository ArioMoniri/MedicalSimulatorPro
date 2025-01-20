import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { setupWebSocket } from "./websocket";
import { db } from "@db";
import { rooms, roomMessages, roomParticipants } from "@db/schema";
import { eq, desc, and } from "drizzle-orm";
import { nanoid } from "nanoid";

export function registerRoutes(app: Express): Server {
  // Setup authentication first
  setupAuth(app);

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
      const participantCount = await db.select({ count: roomParticipants.id })
        .from(roomParticipants)
        .where(
          and(
            eq(roomParticipants.roomId, room.id),
            eq(roomParticipants.leftAt, null)
          )
        )
        .execute();

      if (participantCount >= room.maxParticipants) {
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