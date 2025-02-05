import { WebSocket, WebSocketServer } from "ws";
import type { Server } from "http";
import { db } from "@db";
import { rooms, roomMessages, roomParticipants } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { authenticateWebSocket } from "./auth";
import { sendMessage } from "./services/assistant-service";

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
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ 
    server,
    path: "/api/ws",
    verifyClient: async (info, cb) => {
      // Skip verification for Vite HMR
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

            ws.roomId = message.roomId;

            if (!rooms.has(message.roomId)) {
              rooms.set(message.roomId, new Set());
            }
            rooms.get(message.roomId)!.add(ws);

            // Save participant to database
            await db.insert(roomParticipants).values({
              roomId: message.roomId,
              userId: ws.userId,
              joinedAt: new Date(),
            });

            broadcastToRoom(message.roomId, {
              type: "chat",
              content: `${ws.username} joined the room`,
              userId: ws.userId,
              username: ws.username,
            });
            break;

          case "chat":
            if (!ws.roomId || !ws.userId || !message.content) {
              throw new Error("Missing required fields for chat");
            }

            // Save message to database
            await db.insert(roomMessages).values({
              roomId: ws.roomId,
              userId: ws.userId,
              content: message.content,
            });

            // Broadcast user message
            broadcastToRoom(ws.roomId, {
              type: "chat",
              content: message.content,
              userId: ws.userId,
              username: ws.username,
            });

            // Get AI response
            const assistantResponse = await sendMessage(message.content, "thread_" + ws.roomId.toString());

            // Save AI response to database
            await db.insert(roomMessages).values({
              roomId: ws.roomId,
              userId: 0, // Special ID for assistant
              content: assistantResponse.content,
            });

            // Broadcast AI response
            broadcastToRoom(ws.roomId, {
              type: "chat",
              content: assistantResponse.content,
              userId: 0,
              username: "Medical Assistant",
              isAssistant: true,
            });
            break;

          case "leave":
            handleClientLeave(ws);
            break;
        }
      } catch (error) {
        console.error("WebSocket error:", error);
        ws.send(JSON.stringify({ 
          type: "error", 
          message: error instanceof Error ? error.message : "Failed to process message"
        }));
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

    const roomClients = rooms.get(ws.roomId);
    if (roomClients) {
      roomClients.delete(ws);
      if (roomClients.size === 0) {
        rooms.delete(ws.roomId);
      }
    }

    try {
      // Update participant record in database
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
          userId: ws.userId,
          username: ws.username,
        });
      }
    } catch (error) {
      console.error("Error updating participant record:", error);
    }
  }
}