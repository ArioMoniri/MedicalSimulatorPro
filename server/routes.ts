import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { setupWebSocket } from "./websocket";
import { db } from "@db";
import { rooms, roomMessages, roomParticipants, scenarios, userProgress, vitalSigns } from "@db/schema";
import { eq, desc, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { translateMedicalTerm, getATLSGuidelines } from "./services/openai";
import { createThread, sendMessage } from "./services/assistant-service";
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';

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
            description: "Conduct initial consultation",
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

  app.post("/api/progress", async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { scenarioId, score, threadId, feedback } = req.body;

      // Validate required fields
      if (!scenarioId || typeof score !== 'number' || !threadId) {
        return res.status(400).json({
          message: "Missing required fields: scenarioId, score, and threadId are required"
        });
      }

      // Insert progress
      const [progress] = await db.insert(userProgress)
        .values({
          userId: req.user.id,
          scenarioId,
          score,
          threadId,
          feedback: feedback || null,
          completedAt: new Date(),
        })
        .returning();

      res.json(progress);
    } catch (error: any) {
      console.error("Update progress error:", error);
      res.status(500).json({ message: `Failed to update progress: ${error.message}` });
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

      // Count active participants
      const [{ count }] = await db
        .select({
          count: db.sql<number>`count(*)`
        })
        .from(roomParticipants)
        .where(
          and(
            eq(roomParticipants.roomId, room.id),
            eq(roomParticipants.leftAt, null as unknown as Date)
          )
        );

      if (Number(count) >= (room.maxParticipants ?? 4)) {
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