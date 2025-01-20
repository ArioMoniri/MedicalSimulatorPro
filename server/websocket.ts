import { WebSocket, WebSocketServer } from "ws";
import type { Server } from "http";
import { db } from "@db";
import { rooms, roomMessages, roomParticipants } from "@db/schema";
import { eq, and } from "drizzle-orm";

interface RoomConnection {
  ws: WebSocket;
  userId: number;
  roomId: number;
  username: string;
}

const rooms = new Map<number, Set<RoomConnection>>();

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/api/ws" });

  wss.on("connection", async (ws) => {
    let connection: RoomConnection | null = null;

    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case "join": {
            // Join room
            const { userId, roomId, username } = message;
            
            // Verify room exists and user is a participant
            const [roomParticipant] = await db
              .select()
              .from(roomParticipants)
              .where(
                and(
                  eq(roomParticipants.userId, userId),
                  eq(roomParticipants.roomId, roomId)
                )
              )
              .limit(1);

            if (!roomParticipant) {
              ws.send(JSON.stringify({ type: "error", message: "Not authorized to join room" }));
              return;
            }

            // Add to room connections
            connection = { ws, userId, roomId, username };
            if (!rooms.has(roomId)) {
              rooms.set(roomId, new Set());
            }
            rooms.get(roomId)!.add(connection);

            // Notify others
            broadcastToRoom(roomId, {
              type: "user_joined",
              userId,
              username
            }, connection);

            break;
          }

          case "chat": {
            if (!connection) {
              ws.send(JSON.stringify({ type: "error", message: "Not connected to room" }));
              return;
            }

            const { content } = message;

            // Store message in database
            await db.insert(roomMessages).values({
              roomId: connection.roomId,
              userId: connection.userId,
              content
            });

            // Broadcast to room
            broadcastToRoom(connection.roomId, {
              type: "chat",
              userId: connection.userId,
              username: connection.username,
              content
            });

            break;
          }
        }
      } catch (error) {
        console.error("WebSocket error:", error);
        ws.send(JSON.stringify({ type: "error", message: "Internal server error" }));
      }
    });

    ws.on("close", () => {
      if (connection) {
        const { roomId, userId, username } = connection;
        rooms.get(roomId)?.delete(connection);
        
        // Notify others
        broadcastToRoom(roomId, {
          type: "user_left",
          userId,
          username
        });

        if (rooms.get(roomId)?.size === 0) {
          rooms.delete(roomId);
        }
      }
    });
  });
}

function broadcastToRoom(roomId: number, message: any, exclude?: RoomConnection) {
  const connections = rooms.get(roomId);
  if (!connections) return;

  const messageStr = JSON.stringify(message);
  for (const connection of connections) {
    if (connection !== exclude) {
      connection.ws.send(messageStr);
    }
  }
}
