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
  threadId?: string;
}

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
              .where(eq(dbRooms.id, message.roomId));

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
            }
            connectedRooms.get(message.roomId)!.add(ws);

            // Store thread ID if provided
            if (message.threadId) {
              ws.threadId = message.threadId;
            }

            // Send join message
            await db.insert(roomMessages)
              .values({
                roomId: message.roomId,
                userId: 0, // System message
                content: `${ws.username} joined the room`,
                createdAt: new Date(),
                isAssistant: true,
              });

            broadcastToRoom(message.roomId, {
              type: "chat",
              content: `${ws.username} joined the room`,
              userId: 0,
              username: "System",
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
              .where(eq(dbRooms.id, ws.roomId));

            if (!activeRoom || activeRoom.endedAt) {
              ws.send(JSON.stringify({
                type: "error",
                message: "Room has ended or does not exist"
              }));
              return;
            }

            // Send user message
            await db.insert(roomMessages)
              .values({
                roomId: ws.roomId,
                userId: ws.userId,
                content: message.content,
                createdAt: new Date(),
                isAssistant: false,
              });

            broadcastToRoom(ws.roomId, {
              type: "chat",
              content: message.content,
              userId: ws.userId,
              username: ws.username,
              isAssistant: false
            });

            // Process AI response if thread exists
            if (ws.threadId) {
              try {
                const assistantResponse = await sendMessage(
                  message.content, 
                  ws.threadId,
                  "emergency"
                );

                await db.insert(roomMessages)
                  .values({
                    roomId: ws.roomId,
                    userId: 0,
                    content: assistantResponse.content,
                    createdAt: new Date(),
                    isAssistant: true,
                  });

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
      const [room] = await db.select()
        .from(dbRooms)
        .where(eq(dbRooms.id, ws.roomId));

      const roomClients = connectedRooms.get(ws.roomId);
      if (roomClients) {
        roomClients.delete(ws);
        if (roomClients.size === 0) {
          connectedRooms.delete(ws.roomId);
        }
      }

      // Only send leave message if room hasn't ended
      if (!room?.endedAt) {
        await db.insert(roomMessages)
          .values({
            roomId: ws.roomId,
            userId: 0,
            content: `${ws.username} left the room`,
            createdAt: new Date(),
            isAssistant: true,
          });

        broadcastToRoom(ws.roomId, {
          type: "chat",
          content: `${ws.username} left the room`,
          userId: 0,
          username: "System",
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