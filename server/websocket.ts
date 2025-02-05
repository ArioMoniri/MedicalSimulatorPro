import { WebSocket, WebSocketServer } from "ws";
import type { Server } from "http";
import { db } from "@db";
import { rooms, roomMessages, roomParticipants } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { authenticateWebSocket } from "./auth";
import { sendMessage, createThread } from "./services/assistant-service"; // Added createThread import

interface WebSocketMessage {
  type: "join" | "chat" | "leave";
  roomId?: number;
  userId?: number;
  username?: string;
  content?: string;
  isAssistant?: boolean;
}

interface ConnectedClient extends WebSocket {
  roomId?: number;
  userId?: number;
  username?: string;
  isAuthenticated?: boolean;
  threadId?: string; // Added threadId property
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ 
    server,
    path: "/api/ws",
    verifyClient: async (info, cb) => {
      if (info.req.headers['sec-websocket-protocol'] === 'vite-hmr') {
        return cb(true);
      }

      try {
        const cookies = info.req.headers.cookie;
        if (!cookies) {
          return cb(false, 401, 'Unauthorized - No cookies');
        }

        const user = await authenticateWebSocket(cookies);
        if (!user) {
          return cb(false, 401, 'Unauthorized - Invalid session');
        }

        (info.req as any).user = user;
        return cb(true);
      } catch (error) {
        console.error("WebSocket authentication error:", error);
        return cb(false, 401, 'Unauthorized');
      }
    }
  });

  const rooms = new Map<number, Set<ConnectedClient>>();

  wss.on("connection", async (ws: ConnectedClient, req) => {
    ws.isAuthenticated = true;
    const user = (req as any).user;
    if (user) {
      ws.userId = user.id;
      ws.username = user.username;
    }

    const handleMessageError = (error: any, ws: ConnectedClient) => {
      console.error("WebSocket error:", error);
      ws.send(JSON.stringify({ 
        type: "error", 
        message: error instanceof Error ? error.message : "Failed to process message"
      }));
    };

    ws.on("message", async (data) => {
      try {
        if (!ws.isAuthenticated) {
          ws.send(JSON.stringify({ 
            type: "error", 
            message: "Unauthorized" 
          }));
          return;
        }

        const message: WebSocketMessage = JSON.parse(data.toString());
        console.log("WebSocket message received:", message);

        switch (message.type) {
          case "join":
            if (!message.roomId || !ws.userId || !ws.username) {
              throw new Error("Missing required fields for join");
            }

            // Check if room exists and is not ended
            const [room] = await db.select()
              .from(rooms)
              .where(eq(rooms.id, message.roomId));

            if (!room || room.endedAt) {
              ws.send(JSON.stringify({
                type: "error",
                message: room?.endedAt ? "Room has ended" : "Room not found"
              }));
              return;
            }

            ws.roomId = message.roomId;

            if (!rooms.has(message.roomId)) {
              rooms.set(message.roomId, new Set());
            }
            rooms.get(message.roomId)!.add(ws);

            // Create thread for the room if it doesn't exist
            try {
              const thread = await createThread();
              // Store threadId with room ID prefix
              ws.threadId = thread.id;
            } catch (error) {
              console.error("Failed to create thread:", error);
            }

            broadcastToRoom(message.roomId, {
              type: "chat",
              content: `${ws.username} joined the room`,
              userId: ws.userId,
              username: "Medical Assistant",
              isAssistant: true
            });
            break;

          case "chat":
            if (!ws.roomId || !ws.userId || !message.content) {
              throw new Error("Missing required fields for chat");
            }

            // Check if room still exists and is not ended
            const [activeRoom] = await db.select()
              .from(rooms)
              .where(eq(rooms.id, ws.roomId));

            if (!activeRoom || activeRoom.endedAt) {
              ws.send(JSON.stringify({
                type: "error",
                message: "Room has ended or does not exist"
              }));
              return;
            }

            const newMessage = await db.insert(roomMessages)
              .values({
                roomId: ws.roomId,
                userId: ws.userId,
                content: message.content,
                createdAt: new Date(),
                isAssistant: false,
              })
              .returning();

            broadcastToRoom(ws.roomId, {
              type: "chat",
              content: message.content,
              userId: ws.userId,
              username: ws.username,
              isAssistant: false,
            });

            // Only attempt AI response if we have a valid thread
            try {
              if (ws.threadId) {
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
                  isAssistant: true,
                });
              }
            } catch (error) {
              console.error("Failed to get AI response:", error);
              handleMessageError(error, ws);
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

  function broadcastToRoom(roomId: number, message: WebSocketMessage & { isAssistant?: boolean }) {
    const roomClients = rooms.get(roomId);
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
        .from(rooms)
        .where(eq(rooms.id, ws.roomId));

      const roomClients = rooms.get(ws.roomId);
      if (roomClients) {
        roomClients.delete(ws);
        if (roomClients.size === 0) {
          rooms.delete(ws.roomId);
        }
      }

      // Only update participant status if room hasn't ended
      if (!room?.endedAt) {
        await db.update(roomParticipants)
          .set({ leftAt: new Date() })
          .where(
            and(
              eq(roomParticipants.roomId, ws.roomId),
              eq(roomParticipants.userId, ws.userId)
            )
          );

        if (ws.username) {
          broadcastToRoom(ws.roomId, {
            type: "chat",
            content: `${ws.username} left the room`,
            userId: 0,
            username: "Medical Assistant",
            isAssistant: true
          });
        }
      }
    } catch (error) {
      console.error("Error handling client leave:", error);
    }
  }
}