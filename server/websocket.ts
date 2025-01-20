import { WebSocket, WebSocketServer } from "ws";
import type { Server } from "http";

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/api/ws" });

  wss.on("connection", async (ws) => {
    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log("WebSocket message received:", message);

        // For now, just echo back the message
        ws.send(JSON.stringify({
          type: "echo",
          data: message
        }));
      } catch (error) {
        console.error("WebSocket error:", error);
        ws.send(JSON.stringify({ 
          type: "error", 
          message: "Failed to process message" 
        }));
      }
    });

    ws.on("close", () => {
      console.log("Client disconnected");
    });
  });
}