import { WebSocket, WebSocketServer } from "ws";
import type { Server } from "http";
import { db } from "@db";
import { rooms, roomMessages, roomParticipants } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

interface WebSocketMessage {
  type: "join" | "chat" | "leave";
  roomId?: number;
  userId?: number;
  username?: string;
  content?: string;
}

interface ConnectedClient extends WebSocket {
  roomId?: number;
  userId?: number;
  username?: string;
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/api/ws" });
  const rooms = new Map<number, Set<ConnectedClient>>();

  wss.on("connection", async (ws: ConnectedClient) => {
    ws.on("message", async (data) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        console.log("WebSocket message received:", message);

        switch (message.type) {
          case "join":
            if (!message.roomId || !message.userId || !message.username) {
              throw new Error("Missing required fields for join");
            }

            // Store client info
            ws.roomId = message.roomId;
            ws.userId = message.userId;
            ws.username = message.username;

            // Add client to room
            if (!rooms.has(message.roomId)) {
              rooms.set(message.roomId, new Set());
            }
            rooms.get(message.roomId)!.add(ws);

            // Add participant to database
            await db.insert(roomParticipants).values({
              roomId: message.roomId,
              userId: message.userId,
              joinedAt: new Date(),
            });

            // Broadcast join message to room
            broadcastToRoom(message.roomId, {
              type: "chat",
              content: `${message.username} joined the room`,
              userId: message.userId,
              username: message.username,
            });
            break;

          case "chat":
            if (!ws.roomId || !ws.userId || !message.content) {
              throw new Error("Missing required fields for chat");
            }

            // Store message in database
            await db.insert(roomMessages).values({
              roomId: ws.roomId,
              userId: ws.userId,
              content: message.content,
            });

            // Broadcast message to room
            broadcastToRoom(ws.roomId, {
              type: "chat",
              content: message.content,
              userId: ws.userId,
              username: ws.username,
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

  function broadcastToRoom(roomId: number, message: WebSocketMessage) {
    const roomClients = rooms.get(roomId);
    if (!roomClients) return;

    const messageStr = JSON.stringify(message);
    for (const client of roomClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    }
  }

  async function handleClientLeave(ws: ConnectedClient) {
    if (!ws.roomId || !ws.userId) return;

    // Remove from room
    const roomClients = rooms.get(ws.roomId);
    if (roomClients) {
      roomClients.delete(ws);
      if (roomClients.size === 0) {
        rooms.delete(ws.roomId);
      }
    }

    // Update participant record
    await db.update(roomParticipants)
      .set({ leftAt: new Date() })
      .where(
        and(
          eq(roomParticipants.roomId, ws.roomId),
          eq(roomParticipants.userId, ws.userId),
          eq(roomParticipants.leftAt, null)
        )
      );

    // Broadcast leave message
    if (ws.username) {
      broadcastToRoom(ws.roomId, {
        type: "chat",
        content: `${ws.username} left the room`,
        userId: ws.userId,
        username: ws.username,
      });
    }
  }
}