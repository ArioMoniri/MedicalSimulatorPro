import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { setupWebSocket } from "./websocket";
import { db } from "@db";
import { scenarios, userProgress, rooms, roomParticipants, roomMessages } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

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

  // Create a new room
  app.post("/api/rooms", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const { scenarioId, maxParticipants } = req.body;

    // Generate a unique room code
    const code = nanoid(6).toUpperCase();

    const [room] = await db
      .insert(rooms)
      .values({
        code,
        scenarioId,
        creatorId: req.user.id,
        maxParticipants: maxParticipants || 5,
      })
      .returning();

    // Add creator as first participant
    await db.insert(roomParticipants).values({
      roomId: room.id,
      userId: req.user.id,
    });

    res.json(room);
  });

  // Join a room
  app.post("/api/rooms/join", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const { code } = req.body;

    // Find room by code
    const [room] = await db
      .select()
      .from(rooms)
      .where(and(eq(rooms.code, code), eq(rooms.active, true)))
      .limit(1);

    if (!room) {
      return res.status(404).send("Room not found or inactive");
    }

    // Check if user is already in room
    const [existing] = await db
      .select()
      .from(roomParticipants)
      .where(
        and(
          eq(roomParticipants.roomId, room.id),
          eq(roomParticipants.userId, req.user.id)
        )
      )
      .limit(1);

    if (existing) {
      return res.json(room);
    }

    // Check room capacity
    const participantCount = await db
      .select()
      .from(roomParticipants)
      .where(eq(roomParticipants.roomId, room.id))
      .execute();

    if (participantCount.length >= room.maxParticipants) {
      return res.status(400).send("Room is full");
    }

    // Add user to room
    await db.insert(roomParticipants).values({
      roomId: room.id,
      userId: req.user.id,
    });

    res.json(room);
  });

  // Get room messages
  app.get("/api/rooms/:roomId/messages", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const roomId = parseInt(req.params.roomId);

    // Verify user is in room
    const [participant] = await db
      .select()
      .from(roomParticipants)
      .where(
        and(
          eq(roomParticipants.roomId, roomId),
          eq(roomParticipants.userId, req.user.id)
        )
      )
      .limit(1);

    if (!participant) {
      return res.status(403).send("Not a room participant");
    }

    const messages = await db
      .select()
      .from(roomMessages)
      .where(eq(roomMessages.roomId, roomId))
      .orderBy(roomMessages.timestamp);

    res.json(messages);
  });

  const httpServer = createServer(app);
  setupWebSocket(httpServer);

  return httpServer;
}