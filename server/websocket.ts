import { WebSocket, WebSocketServer } from "ws";
import type { Server } from "http";
import { db } from "@db";
import { rooms as dbRooms, roomMessages, roomParticipants } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { authenticateWebSocket } from "./auth";
import { sendMessage, createThread } from "./services/assistant-service";

interface WebSocketMessage {
  type: "join" | "chat" | "leave";
  roomId?: number;
  userId?: number;
  username?: string;
  content?: string;
  isAssistant?: boolean;
  threadId?: string;
}

interface ConnectedClient extends WebSocket {
  roomId?: number;
  userId?: number;
  username?: string;
  isAuthenticated?: boolean;
}

// Store room threads globally
const roomThreads = new Map<number, string>();

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({
    server,
    path: "/api/ws",
    verifyClient: async (info, cb) => {
      try {
        // Skip auth for Vite HMR
        if (info.req.headers['sec-websocket-protocol'] === 'vite-hmr') {
          return cb(true);
        }

        const cookies = info.req.headers.cookie;
        if (!cookies) {
          console.error("WebSocket auth failed: No cookies");
          return cb(false, 401, 'Unauthorized');
        }

        const user = await authenticateWebSocket(cookies);
        if (!user) {
          console.error("WebSocket auth failed: Invalid session");
          return cb(false, 401, 'Unauthorized');
        }

        (info.req as any).user = user;
        return cb(true);
      } catch (error) {
        console.error("WebSocket authentication error:", error);
        return cb(false, 401, 'Unauthorized');
      }
    }
  });

  // Store connected clients for each room
  const connectedRooms = new Map<number, Set<ConnectedClient>>();

  wss.on("connection", async (ws: ConnectedClient, req) => {
    const user = (req as any).user;
    if (!user) {
      ws.close(1008, 'Unauthorized');
      return;
    }

    // Set user info on socket
    ws.isAuthenticated = true;
    ws.userId = user.id;
    ws.username = user.username;

    const handleMessageError = (error: any, ws: ConnectedClient) => {
      console.error("WebSocket error:", error);
      ws.send(JSON.stringify({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to process message"
      }));
    };

    ws.on("message", async (data) => {
      if (!ws.isAuthenticated) {
        ws.send(JSON.stringify({
          type: "error",
          message: "Unauthorized"
        }));
        return;
      }

      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        console.log("WebSocket message received:", message);

        switch (message.type) {
          case "join":
            if (!message.roomId || !ws.userId || !ws.username) {
              throw new Error("Missing required fields for join");
            }

            // Check if room exists and is not ended
            const [room] = await db.select()
              .from(dbRooms)
              .where(eq(dbRooms.id, message.roomId))
              .limit(1);

            if (!room || room.endedAt) {
              ws.send(JSON.stringify({
                type: "error",
                message: room?.endedAt ? "Room has ended" : "Room not found"
              }));
              return;
            }

            ws.roomId = message.roomId;

            // Add client to room
            if (!connectedRooms.has(message.roomId)) {
              connectedRooms.set(message.roomId, new Set());

              // Create thread for room if it doesn't exist
              if (!roomThreads.has(message.roomId)) {
                try {
                  const thread = await createThread();
                  roomThreads.set(message.roomId, thread.id);
                } catch (error) {
                  console.error("Failed to create thread for room:", error);
                }
              }
            }
            connectedRooms.get(message.roomId)!.add(ws);

            // Send join message
            const [joinMessage] = await db.insert(roomMessages)
              .values({
                roomId: message.roomId,
                userId: ws.userId,
                content: `${ws.username} joined the room`,
                createdAt: new Date(),
                isAssistant: true,
              })
              .returning();

            broadcastToRoom(message.roomId, {
              type: "chat",
              content: `${ws.username} joined the room`,
              userId: ws.userId,
              username: ws.username,
              isAssistant: true
            });
            break;

          case "chat":
            if (!ws.roomId || !ws.userId || !message.content) {
              throw new Error("Missing required fields for chat");
            }

            // Check if room still exists and is not ended
            const [activeRoom] = await db.select()
              .from(dbRooms)
              .where(eq(dbRooms.id, ws.roomId))
              .limit(1);

            if (!activeRoom || activeRoom.endedAt) {
              ws.send(JSON.stringify({
                type: "error",
                message: "Room has ended or does not exist"
              }));
              return;
            }

            // Send user message
            const [newMessage] = await db.insert(roomMessages)
              .values({
                roomId: ws.roomId,
                userId: ws.userId,
                content: message.content,
                createdAt: new Date(),
                isAssistant: false,
              })
              .returning();

            // Broadcast user message to room
            broadcastToRoom(ws.roomId, {
              type: "chat",
              content: message.content,
              userId: ws.userId,
              username: ws.username,
              isAssistant: false
            });

            // Get room thread ID
            const roomThreadId = roomThreads.get(ws.roomId);
            if (roomThreadId) {
              try {
                // Send typing indicator
                broadcastToRoom(ws.roomId, {
                  type: "chat",
                  content: "Medical Assistant is typing...",
                  userId: 0,
                  username: "System",
                  isAssistant: true
                });

                const assistantResponse = await sendMessage(
                  `${ws.username}: ${message.content}`,
                  roomThreadId,
                  "emergency"
                );

                // Parse vital signs from response
                const vitals = parseVitalSigns(assistantResponse.content);
                if (vitals) {
                  console.log("Parsed vital signs in group chat:", vitals);
                }

                // Store and broadcast AI response
                const [aiMessage] = await db.insert(roomMessages)
                  .values({
                    roomId: ws.roomId,
                    userId: 0,
                    content: assistantResponse.content,
                    createdAt: new Date(),
                    isAssistant: true,
                  })
                  .returning();

                broadcastToRoom(ws.roomId, {
                  type: "chat",
                  content: assistantResponse.content,
                  userId: 0,
                  username: "Medical Assistant",
                  isAssistant: true
                });
              } catch (error) {
                console.error("Failed to get AI response:", error);
                handleMessageError(error, ws);
              }
            }
            break;

          case "leave":
            handleClientLeave(ws);
            break;
        }
      } catch (error) {
        handleMessageError(error, ws);
      }
    });

    ws.on("close", () => {
      handleClientLeave(ws);
    });
  });

  function broadcastToRoom(roomId: number, message: WebSocketMessage) {
    const roomClients = connectedRooms.get(roomId);
    if (!roomClients) return;

    const messageStr = JSON.stringify(message);
    roomClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  async function handleClientLeave(ws: ConnectedClient) {
    if (!ws.roomId || !ws.userId) return;

    try {
      // Check if room has ended
      const [room] = await db
        .select()
        .from(dbRooms)
        .where(eq(dbRooms.id, ws.roomId))
        .limit(1);

      const roomClients = connectedRooms.get(ws.roomId);
      if (roomClients) {
        roomClients.delete(ws);
        if (roomClients.size === 0) {
          connectedRooms.delete(ws.roomId);
          // Clean up room thread when everyone leaves
          roomThreads.delete(ws.roomId);
        }
      }

      // Only send leave message if room hasn't ended
      if (!room?.endedAt) {
        const [leaveMessage] = await db.insert(roomMessages)
          .values({
            roomId: ws.roomId,
            userId: ws.userId,
            content: `${ws.username} left the room`,
            createdAt: new Date(),
            isAssistant: true,
          })
          .returning();

        broadcastToRoom(ws.roomId, {
          type: "chat",
          content: `${ws.username} left the room`,
          userId: ws.userId,
          username: ws.username,
          isAssistant: true
        });

        // Update participant status
        await db.update(roomParticipants)
          .set({ leftAt: new Date() })
          .where(
            and(
              eq(roomParticipants.roomId, ws.roomId),
              eq(roomParticipants.userId, ws.userId)
            )
          );
      }
    } catch (error) {
      console.error("Error handling client leave:", error);
    }
  }
}

// Implement vital signs parsing function
function parseVitalSigns(text: string): object | null {
  console.log("Attempting to parse vital signs from:", text);

  const findValue = (text: string, patterns: string[]): string | null => {
    for (const pattern of patterns) {
      const regex = new RegExp(pattern, 'i');
      const match = text.match(regex);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  };

  const lines = text.split(/[\n,]/)
    .map(line => line.trim())
    .filter(Boolean);

  const vitals: any = {};

  lines.forEach(line => {
    // Heart Rate patterns
    const hrPatterns = [
      'HR:?\\s*(\\d+)(?:\\s*(?:bpm|beats per minute|beats/min|/min))?',
      'Heart Rate:?\\s*(\\d+)(?:\\s*(?:bpm|beats per minute|beats/min|/min))?',
      'Pulse:?\\s*(\\d+)(?:\\s*(?:bpm|beats per minute|beats/min|/min))?'
    ];
    const hrValue = findValue(line, hrPatterns);
    if (hrValue) {
      vitals.hr = parseInt(hrValue);
    }

    // Blood Pressure patterns
    const bpPatterns = [
      'BP:?\\s*(\\d+)\\s*/\\s*(\\d+)(?:\\s*(?:mmHg|mm Hg))?',
      'Blood Pressure:?\\s*(\\d+)\\s*/\\s*(\\d+)(?:\\s*(?:mmHg|mm Hg))?'
    ];
    for (const pattern of bpPatterns) {
      const match = line.match(new RegExp(pattern, 'i'));
      if (match && match[1] && match[2]) {
        vitals.bp = {
          systolic: parseInt(match[1]),
          diastolic: parseInt(match[2])
        };
        break;
      }
    }

    // SpO2 patterns
    const spo2Patterns = [
      'SpO2:?\\s*(\\d+)\\s*%?',
      'O2 Sat:?\\s*(\\d+)\\s*%?',
      'Oxygen Saturation:?\\s*(\\d+)\\s*%?',
      'SaO2:?\\s*(\\d+)\\s*%?'
    ];
    const spo2Value = findValue(line, spo2Patterns);
    if (spo2Value) {
      vitals.spo2 = parseInt(spo2Value);
    }

    // Temperature patterns
    const tempPatterns = [
      'Temp:?\\s*(\\d+\\.?\\d*)\\s*[°]?C',
      'Temperature:?\\s*(\\d+\\.?\\d*)\\s*[°]?C'
    ];
    const tempValue = findValue(line, tempPatterns);
    if (tempValue) {
      vitals.temp = parseFloat(tempValue);
    }

    // Respiratory Rate patterns
    const rrPatterns = [
      'RR:?\\s*(\\d+)(?:\\s*(?:breaths/min|/min|bpm))?',
      'Respiratory Rate:?\\s*(\\d+)(?:\\s*(?:breaths/min|/min|bpm))?',
      'Resp:?\\s*(\\d+)(?:\\s*(?:breaths/min|/min|bpm))?'
    ];
    const rrValue = findValue(line, rrPatterns);
    if (rrValue) {
      vitals.rr = parseInt(rrValue);
    }
  });

  return Object.keys(vitals).length > 0 ? vitals : null;
}