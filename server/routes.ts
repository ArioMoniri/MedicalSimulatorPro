import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { setupWebSocket } from "./websocket";

export function registerRoutes(app: Express): Server {
  // Setup authentication first
  setupAuth(app);

  const httpServer = createServer(app);
  setupWebSocket(httpServer);

  return httpServer;
}