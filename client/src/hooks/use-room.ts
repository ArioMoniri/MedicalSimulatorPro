import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Room, RoomMessage } from "@db/schema";

interface WebSocketMessage {
  type: "chat" | "user_joined" | "user_left" | "error";
  userId?: number;
  username?: string;
  content?: string;
  message?: string;
}

export function useRoom() {
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState<WebSocket | null>(null);

  // Create a new room
  const createRoom = useMutation({
    mutationFn: async ({ scenarioId, maxParticipants }: { scenarioId: number, maxParticipants?: number }) => {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId, maxParticipants }),
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
  const connectToRoom = useCallback((roomId: number, userId: number, username: string) => {
    if (socket) {
      socket.close();
    }

    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/ws`);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: "join",
        roomId,
        userId,
        username,
      }));
    };

    ws.onmessage = (event) => {
      const message: WebSocketMessage = JSON.parse(event.data);

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

    setSocket(ws);

    return () => {
      ws.close();
      setSocket(null);
    };
  }, [socket, queryClient]);

  // Send message to room
  const sendMessage = useCallback((content: string) => {
    if (!socket) return;

    socket.send(JSON.stringify({
      type: "chat",
      content,
    }));
  }, [socket]);

  return {
    createRoom: createRoom.mutateAsync,
    joinRoom: joinRoom.mutateAsync,
    getRoomMessages,
    connectToRoom,
    sendMessage,
    isConnected: socket?.readyState === WebSocket.OPEN,
  };
}
