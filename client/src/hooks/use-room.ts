import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Room, RoomMessage } from "@db/schema";

interface WebSocketMessage {
  type: "chat" | "user_joined" | "user_left" | "error";
  userId?: number;
  username?: string;
  content?: string;
  message?: string;
  isAssistant?: boolean;
}

export function useRoom() {
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Create a new room
  const createRoom = useMutation({
    mutationFn: async ({ scenarioId }: { scenarioId: number }) => {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId }),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json() as Promise<Room>;
    },
  });

  // Join a room
  const joinRoom = useMutation({
    mutationFn: async ({ code }: { code: string }) => {
      const res = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json() as Promise<Room>;
    },
  });

  // Get room messages
  const getRoomMessages = useCallback(async (roomId: number) => {
    const res = await fetch(`/api/rooms/${roomId}/messages`, {
      credentials: "include",
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    return res.json() as Promise<RoomMessage[]>;
  }, []);

  // Connect to room WebSocket
  const connectToRoom = useCallback((roomId: number, userId: number, username: string, threadId?: string) => {
    if (socket) {
      socket.close();
    }

    setIsConnecting(true);

    try {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/api/ws`;

      console.log("Connecting to WebSocket:", wsUrl);
      const ws = new WebSocket(wsUrl);

      // Connection event handlers
      ws.onopen = () => {
        console.log("WebSocket connection established");
        // Send join message with all necessary data
        ws.send(JSON.stringify({
          type: "join",
          roomId,
          userId,
          username,
          threadId,
        }));
        setIsConnecting(false);
      };

      ws.onmessage = (event) => {
        const message: WebSocketMessage = JSON.parse(event.data);
        console.log("WebSocket message received:", message);

        switch (message.type) {
          case "chat":
          case "user_joined":
          case "user_left":
            // Invalidate room messages query to trigger refetch
            queryClient.invalidateQueries({ queryKey: [`/api/rooms/${roomId}/messages`] });
            break;
          case "error":
            console.error("WebSocket error:", message.message);
            break;
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setIsConnecting(false);
      };

      ws.onclose = (event) => {
        console.log("WebSocket connection closed:", event.code, event.reason);
        setIsConnecting(false);
        setSocket(null);

        // Attempt to reconnect if the connection was closed unexpectedly
        if (event.code === 1006 || event.code === 1001) {
          setTimeout(() => {
            console.log("Attempting to reconnect...");
            connectToRoom(roomId, userId, username, threadId);
          }, 5000);
        }
      };

      setSocket(ws);

      // Cleanup function
      return () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "leave" }));
        }
        ws.close();
        setSocket(null);
      };
    } catch (error) {
      console.error("Failed to connect to WebSocket:", error);
      setIsConnecting(false);
      return () => {};
    }
  }, [socket, queryClient]);

  // Send message to room
  const sendMessage = useCallback(async (content: string) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.error("WebSocket is not connected");
      return;
    }

    socket.send(JSON.stringify({
      type: "chat",
      content,
    }));
  }, [socket]);

  // Leave room
  const leaveRoom = useCallback(() => {
    if (socket) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "leave" }));
      }
      socket.close();
      setSocket(null);
    }
  }, [socket]);

  return {
    createRoom: createRoom.mutateAsync,
    joinRoom: joinRoom.mutateAsync,
    getRoomMessages,
    connectToRoom,
    sendMessage,
    leaveRoom,
    isConnected: socket?.readyState === WebSocket.OPEN,
    isConnecting,
  };
}