import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { setupWebSocket } from "./websocket";
import { db } from "@db";
import { rooms, roomMessages, roomParticipants, scenarios, userProgress, vitalSigns } from "@db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { translateMedicalTerm, getATLSGuidelines } from "./services/openai";
import { createThread, sendMessage } from "./services/assistant-service";
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from "path";
import fs from "fs/promises";

const ASSISTANT_USER_ID = 0; // Special ID for assistant messages

export function registerRoutes(app: Express): Server {
  // Setup authentication first
  setupAuth(app);

  // Scenarios API
  app.get("/api/scenarios", async (_req: Request, res: Response) => {
    try {
      const allScenarios = await db.select().from(scenarios);
      res.json(allScenarios);
    } catch (error) {
      console.error("Get scenarios error:", error);
      res.status(500).json({ message: "Failed to get scenarios" });
    }
  });

  // Room Management API
  app.post("/api/rooms", async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { scenarioId, maxParticipants = 4 } = req.body;

      if (!scenarioId) {
        return res.status(400).json({ message: "Scenario ID is required" });
      }

      // Generate a unique 6-character room code
      const code = nanoid(6).toUpperCase();

      // Create OpenAI thread first
      const thread = await createThread();
      const threadId = thread.id;

      const [room] = await db.insert(rooms)
        .values({
          code,
          scenarioId,
          creatorId: req.user.id,
          maxParticipants,
          createdAt: new Date(),
        })
        .returning();

      // Create initial room message
      await db.insert(roomMessages)
        .values({
          roomId: room.id,
          userId: 0,
          content: "Welcome to the simulation room! You can start your discussion.",
          createdAt: new Date(),
          isAssistant: true
        });

      // Store threadId in a new table or modify the existing one
      // For now we'll use room.id as thread_{room.id}

      res.json({ ...room, threadId });
    } catch (error) {
      console.error("Create room error:", error);
      res.status(500).json({ message: "Failed to create room" });
    }
  });

  // Join room endpoint
  app.post("/api/rooms/join", async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { code } = req.body;

      if (!code) {
        return res.status(400).json({ message: "Room code is required" });
      }

      const [room] = await db.select()
        .from(rooms)
        .where(eq(rooms.code, code.toUpperCase()));

      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      if (room.endedAt) {
        return res.status(400).json({ message: "Room has ended" });
      }

      // Count active participants
      const participants = await db.select()
        .from(roomParticipants)
        .where(
          and(
            eq(roomParticipants.roomId, room.id),
            sql`${roomParticipants.leftAt} IS NULL`
          )
        );

      if (participants.length >= (room.maxParticipants ?? 4)) {
        return res.status(400).json({ message: "Room is full" });
      }

      // Add participant to room if not already joined
      const existingParticipant = participants.find(p => p.userId === req.user!.id);
      if (!existingParticipant) {
        await db.insert(roomParticipants)
          .values({
            roomId: room.id,
            userId: req.user.id,
            joinedAt: new Date(),
          });

        // Add system message about user joining
        await db.insert(roomMessages)
          .values({
            roomId: room.id,
            userId: ASSISTANT_USER_ID,
            content: `${req.user.username} has joined the room.`,
            createdAt: new Date(),
            isAssistant: true
          });
      }

      res.json(room);
    } catch (error) {
      console.error("Join room error:", error);
      res.status(500).json({ message: "Failed to join room" });
    }
  });

  // Get room messages endpoint
  app.get("/api/rooms/:roomId/messages", async (req: Request, res: Response) => {
    try {
      const { roomId } = req.params;

      const messages = await db.select({
        id: roomMessages.id,
        content: roomMessages.content,
        createdAt: roomMessages.createdAt,
        userId: roomMessages.userId,
        isAssistant: roomMessages.isAssistant,
        username: sql<string>`CASE WHEN ${roomMessages.userId} = 0 THEN 'Medical Assistant' ELSE (SELECT username FROM users WHERE id = ${roomMessages.userId}) END`
      })
        .from(roomMessages)
        .where(eq(roomMessages.roomId, parseInt(roomId)))
        .orderBy(desc(roomMessages.createdAt));

      res.json(messages);
    } catch (error) {
      console.error("Get room messages error:", error);
      res.status(500).json({ message: "Failed to get room messages" });
    }
  });

  // End room endpoint
  app.post("/api/rooms/:roomId/end", async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { roomId } = req.params;
      const parsedRoomId = parseInt(roomId);

      // Get room and verify creator
      const [room] = await db.select()
        .from(rooms)
        .where(eq(rooms.id, parsedRoomId));

      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      // Convert IDs to numbers for comparison
      if (Number(room.creatorId) !== Number(req.user.id)) {
        return res.status(403).json({ message: "Only room creator can end the room" });
      }

      // Update room end time
      await db.update(rooms)
        .set({ endedAt: new Date() })
        .where(eq(rooms.id, parsedRoomId));

      // Update all active participants as left
      await db.update(roomParticipants)
        .set({ leftAt: new Date() })
        .where(
          and(
            eq(roomParticipants.roomId, parsedRoomId),
            sql`${roomParticipants.leftAt} IS NULL`
          )
        );

      res.json({ message: "Room ended successfully" });
    } catch (error) {
      console.error("End room error:", error);
      res.status(500).json({ message: "Failed to end room" });
    }
  });

  // Medical Translation API
  app.post("/api/medical/translate", async (req: Request, res: Response) => {
    try {
      const { text, targetLanguage } = req.body;

      if (!text || !targetLanguage) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const translation = await translateMedicalTerm(text, targetLanguage);
      res.json({ translation });
    } catch (error) {
      console.error("Translation error:", error);
      res.status(500).json({ message: "Failed to translate text" });
    }
  });

  // ATLS Guidelines API
  app.post("/api/medical/guidelines", async (req: Request, res: Response) => {
    try {
      const { topic, context } = req.body;

      if (!topic) {
        return res.status(400).json({ message: "Topic is required" });
      }

      const guidelines = await getATLSGuidelines(topic, context);
      res.json({ guidelines });
    } catch (error) {
      console.error("Guidelines error:", error);
      res.status(500).json({ message: "Failed to fetch guidelines" });
    }
  });

  // Assistant API Routes
  app.post("/api/assistant/thread", async (_req: Request, res: Response) => {
    try {
      const thread = await createThread();
      res.json(thread);
    } catch (error) {
      console.error("Create thread error:", error);
      res.status(500).json({ message: "Failed to create thread" });
    }
  });

  // Update the message endpoint to handle simulation type
  app.post("/api/assistant/message", async (req: Request, res: Response) => {
    try {
      const { content, threadId, simulationType = "emergency" } = req.body;

      if (!content || !threadId) {
        return res.status(400).json({ message: "Content and threadId are required" });
      }

      const response = await sendMessage(content, threadId, simulationType as "emergency" | "clinical");
      res.json(response);
    } catch (error) {
      console.error("Send message error:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // New Vital Signs API endpoints
  app.post("/api/vital-signs", async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { threadId, heartRate, systolicBP, diastolicBP, respiratoryRate, spo2, temperature } = req.body;

      const [vitalSign] = await db.insert(vitalSigns)
        .values({
          threadId,
          userId: req.user.id,
          heartRate,
          systolicBP,
          diastolicBP,
          respiratoryRate,
          spo2,
          temperature,
        })
        .returning();

      res.json(vitalSign);
    } catch (error) {
      console.error("Save vital signs error:", error);
      res.status(500).json({ message: "Failed to save vital signs" });
    }
  });

  app.get("/api/vital-signs/:threadId", async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { threadId } = req.params;

      const history = await db.select()
        .from(vitalSigns)
        .where(
          and(
            eq(vitalSigns.threadId, threadId),
            eq(vitalSigns.userId, req.user.id)
          )
        )
        .orderBy(desc(vitalSigns.timestamp));

      res.json(history);
    } catch (error) {
      console.error("Get vital signs error:", error);
      res.status(500).json({ message: "Failed to get vital signs history" });
    }
  });


  // Configure multer for image uploads
  const storage = multer.diskStorage({
    destination: './uploads',
    filename: function (req, file, cb) {
      cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
    }
  });

  const upload = multer({
    storage,
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.mimetype)) {
        cb(new Error('Invalid file type'));
        return;
      }
      cb(null, true);
    }
  });

  // Image upload endpoint needs to be updated too
  app.post("/api/assistant/upload-image", upload.single('image'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      if (!req.body.threadId) {
        return res.status(400).json({ message: "Thread ID is required" });
      }

      // Read the uploaded file
      const imageBuffer = await fs.readFile(req.file.path);
      const base64Image = imageBuffer.toString('base64');

      // Send image to OpenAI API with the correct simulation type
      const response = await sendMessage(
        [
          {
            type: "text",
            text: "Please analyze this medical image and provide your observations."
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${req.file.mimetype};base64,${base64Image}`
            }
          }
        ],
        req.body.threadId,
        req.body.simulationType || "emergency"
      );

      // Clean up the uploaded file
      await fs.unlink(req.file.path);

      res.json(response);
    } catch (error) {
      console.error("Image upload error:", error);
      res.status(500).json({ message: "Failed to process image" });
    }
  });

  const httpServer = createServer(app);
  setupWebSocket(httpServer);

  return httpServer;
}