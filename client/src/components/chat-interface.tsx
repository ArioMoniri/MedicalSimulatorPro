import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import VoiceInput from "./voice-input";
import TypingIndicator from "./typing-indicator";
import VitalSignsMonitor, { VitalSigns } from "./vital-signs-monitor";
import { useRoom } from "@/hooks/use-room";
import { useUser } from "@/hooks/use-user";
import { Send, Upload, Users, Plus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

interface Message {
  id?: number;
  role: "user" | "assistant";
  content: string;
  username?: string;
  createdAt?: string | Date;
  isTyping?: boolean;
  isAssistant?: boolean;
}

interface Room {
  id: number;
  code: string;
  creatorId: number;
  endedAt?: Date;
}

interface ChatInterfaceProps {
  scenarioId: number;
}

export default function ChatInterface({ scenarioId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [roomId, setRoomId] = useState<number | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [latestVitals, setLatestVitals] = useState<VitalSigns>({});
  const [scenarios, setScenarios] = useState<any[] | null>(null);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchScenarios = async () => {
      try {
        const response = await fetch("/api/scenarios");
        if (response.ok) {
          const data = await response.json();
          setScenarios(data);
        } else {
          console.error("Failed to fetch scenarios");
        }
      } catch (error) {
        console.error("Error fetching scenarios:", error);
      }
    };

    fetchScenarios();
  }, []);

  const { user } = useUser();
  const { toast } = useToast();
  const {
    createRoom,
    joinRoom,
    getRoomMessages,
    connectToRoom,
    sendMessage: sendRoomMessage,
    isConnected,
    leaveRoom,
  } = useRoom();

  // Load chat history
  useEffect(() => {
    const loadHistory = () => {
      const history = localStorage.getItem(
        `chat_history_list_${user?.id}_${scenarioId}`,
      );
      if (history) {
        setChatHistory(JSON.parse(history));
      }

      // Load current chat if exists
      const currentId = localStorage.getItem(
        `current_chat_${user?.id}_${scenarioId}`,
      );
      if (currentId) {
        setCurrentChatId(currentId);
        const savedChat = localStorage.getItem(
          `chat_${user?.id}_${scenarioId}_${currentId}`,
        );
        if (savedChat) {
          const chatData = JSON.parse(savedChat);
          setMessages(chatData.messages);
          setThreadId(chatData.threadId);
        }
      }
    };

    if (user?.id) {
      loadHistory();
    }
  }, [user?.id, scenarioId]);

  // Save chat history
  useEffect(() => {
    if (user?.id && currentChatId && messages.length > 0) {
      // Save current chat with threadId
      const chatData = {
        messages,
        threadId,
      };
      localStorage.setItem(
        `chat_${user?.id}_${scenarioId}_${currentChatId}`,
        JSON.stringify(chatData),
      );

      // Update history list, preventing duplicates
      const firstMessage = messages[0].content;
      const lastMessage = messages[messages.length - 1].content;
      let updatedHistory = chatHistory.filter(
        (chat) => chat.id !== currentChatId,
      );

      const newChat: ChatHistory = {
        id: currentChatId,
        threadId: threadId || "",
        messages,
        createdAt: new Date(),
        firstMessage: firstMessage.substring(0, 100) + "...",
        lastMessage: lastMessage.substring(0, 100) + "...",
      };

      updatedHistory = [newChat, ...updatedHistory];

      setChatHistory(updatedHistory);
      localStorage.setItem(
        `chat_history_list_${user?.id}_${scenarioId}`,
        JSON.stringify(updatedHistory),
      );

      // Save current chat id
      localStorage.setItem(
        `current_chat_${user?.id}_${scenarioId}`,
        currentChatId,
      );
    }
  }, [messages, currentChatId, user?.id, scenarioId, threadId, chatHistory]);

  // Create thread mutation
  const createThreadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/assistant/thread", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to create thread");
      return response.json();
    },
    onSuccess: (data) => {
      setThreadId(data.id);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  // Add new mutation for saving vital signs
  const saveVitalSignsMutation = useMutation({
    mutationFn: async (vitals: VitalSigns & { threadId: string }) => {
      const response = await fetch("/api/vital-signs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: vitals.threadId,
          heartRate: vitals.hr,
          systolicBP: vitals.bp?.systolic,
          diastolicBP: vitals.bp?.diastolic,
          respiratoryRate: vitals.rr,
          spo2: vitals.spo2,
          temperature: vitals.temp,
        }),
      });
      if (!response.ok) throw new Error("Failed to save vital signs");
      return response.json();
    },
  });

  // Update the message handler to save vital signs
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      // Show typing indicator before making request
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Medical Assistant is typing...",
          createdAt: new Date(),
          username: "System",
          isTyping: true,
          isAssistant: true,
        },
      ]);

      const response = await fetch("/api/assistant/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          threadId,
          simulationType:
            scenarios?.find((s) => s.id === scenarioId)?.type || "emergency",
        }),
      });
      if (!response.ok) throw new Error("Failed to send message");
      return response.json();
    },
    onSuccess: (data) => {
      const content = data.content;
      console.log("Received message:", content);

      // Replace typing indicator with actual message
      setMessages((prev) => {
        const filtered = prev.filter((msg) => !msg.isTyping);
        return [
          ...filtered,
          {
            role: "assistant",
            content: content,
            createdAt: new Date(),
            username: "Medical Assistant",
            isTyping: false,
            isAssistant: true,
          },
        ];
      });

      const vitals = parseVitalSigns(content);
      if (vitals) {
        console.log("Found new vitals:", vitals);
        setLatestVitals((currentVitals) => ({
          ...currentVitals,
          ...vitals
        }));

        if (threadId) {
          saveVitalSignsMutation.mutate({
            ...vitals,
            threadId,
          });
        }
      }
    },
    onError: (error: Error) => {
      setMessages((prev) => prev.filter((msg) => !msg.isTyping));
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  // Add mutation for updating progress
  const updateProgress = useMutation({
    mutationFn: async (data: {
      scenarioId: number;
      score: number;
      threadId: string;
      feedback: string;
    }) => {
      const response = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update progress");
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch progress data
      queryClient.invalidateQueries({ queryKey: ["/api/progress"] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to update progress: ${error.message}`,
      });
    },
  });

  // Add query for loading vital signs history
  const { data: vitalSignsHistory } = useQuery({
    queryKey: [`/api/vital-signs/${threadId}`],
    queryFn: async () => {
      if (!threadId) return null;
      const response = await fetch(`/api/vital-signs/${threadId}`);
      if (!response.ok) throw new Error("Failed to load vital signs history");
      return response.json();
    },
    enabled: !!threadId,
  });

  // Start new chat
  const handleNewChat = async () => {
    const newChatId = Date.now().toString();
    setCurrentChatId(newChatId);
    setMessages([]);
    setLatestVitals({}); // Reset vital signs for new chat

    // Create new thread
    createThreadMutation.mutate();

    // Add to history
    const newChat: ChatHistory = {
      id: newChatId,
      threadId: "",
      messages: [],
      createdAt: new Date(),
      firstMessage: "New conversation",
      lastMessage: "New conversation",
    };

    setChatHistory((prev) => [newChat, ...prev]);
  };

  // Update handleLoadChat to load vital signs history
  const handleLoadChat = (chatId: string) => {
    setCurrentChatId(chatId);
    setLatestVitals({}); // Reset vitals before loading chat
    const savedChat = localStorage.getItem(
      `chat_${user?.id}_${scenarioId}_${chatId}`,
    );
    if (savedChat) {
      const chatData = JSON.parse(savedChat);
      setMessages(chatData.messages);
      setThreadId(chatData.threadId);

      // Parse vital signs from the loaded messages
      const lastMessageWithVitals = [...chatData.messages]
        .reverse()
        .find((msg) => {
          const vitals = parseVitalSigns(msg.content);
          return vitals !== null;
        });

      if (lastMessageWithVitals) {
        const vitals = parseVitalSigns(lastMessageWithVitals.content);
        if (vitals) {
          setLatestVitals(vitals);
        }
      }
    }
  };

  // Initialize thread when component mounts
  useEffect(() => {
    if (!threadId && !currentChatId) {
      handleNewChat();
    }
  }, []);

  // Room message fetching
  const { data: roomMessagesData } = useQuery({
    queryKey: [`/api/rooms/${roomId}/messages`],
    queryFn: () => getRoomMessages(roomId!),
    enabled: !!roomId,
    refetchInterval: 1000, // Poll every second for new messages
  });

  useEffect(() => {
    if (roomMessagesData) {
      const sortedMessages = [...roomMessagesData].sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateA - dateB;
      });

      let currentVitals: VitalSigns = { ...latestVitals };

      sortedMessages.forEach((msg) => {
        if (msg.isAssistant && !msg.content.includes("is typing")) {
          const newVitals = parseVitalSigns(msg.content);
          if (newVitals) {
            currentVitals = {
              ...currentVitals,
              ...newVitals
            };
          }
        }
      });

      if (Object.keys(currentVitals).length > 0) {
        setLatestVitals(currentVitals);
      }

      // Update latest vitals if there are changes
      if (Object.keys(currentVitals).length > 0) {
        setLatestVitals(currentVitals);
      }

      const newMessages: Message[] = sortedMessages.map((msg) => {
        // For system messages (join/leave/typing)
        if (
          msg.content.includes("joined the room") ||
          msg.content.includes("left the room") ||
          msg.content.includes("is typing")
        ) {
          return {
            id: msg.id,
            role: "assistant",
            content: msg.content,
            createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
            username: "System",
            isTyping: msg.content.includes("is typing"),
            isAssistant: true,
          };
        }

        // For AI assistant messages
        if (msg.isAssistant) {
          return {
            id: msg.id,
            role: "assistant",
            content: msg.content,
            createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
            username: "Medical Assistant",
            isTyping: false,
            isAssistant: true
          };
        }

        return {
          id: msg.id,
          role: "user",
          content: msg.content,
          createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
          username: msg.userId || user?.username,
          isTyping: false,
          isAssistant: false
        };
      });

      // Filter out old typing indicators
      const filteredMessages = newMessages.filter((msg, index) => {
        if (msg.isTyping) {
          const nextMsg = newMessages[index + 1];
          return !nextMsg || nextMsg.isTyping;
        }
        return true;
      });

      setMessages(filteredMessages);
    }
  }, [roomMessagesData]);

  // Room management functions
  const handleCreateRoom = async () => {
    try {
      const room = await createRoom({ scenarioId });
      if (room) {
        setRoomId(room.id);
        setCurrentRoom({
          id: room.id,
          code: room.code,
          creatorId: room.creatorId,
          endedAt: room.endedAt ? new Date(room.endedAt) : undefined,
        });

        // Create new thread for AI interactions
        const threadResponse = await fetch("/api/assistant/thread", {
          method: "POST",
        });

        if (threadResponse.ok) {
          const thread = await threadResponse.json();
          setThreadId(thread.id);
        }

        if (user) {
          connectToRoom(room.id, user.id, user.username);
        }

        toast({
          title: "Room Created",
          description: `Share this code with others: ${room.code}`,
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleJoinRoom = async () => {
    try {
      const room = await joinRoom({ code: roomCode });
      if (room) {
        setRoomId(room.id);
        setCurrentRoom({
          id: room.id,
          code: room.code,
          creatorId: room.creatorId,
          endedAt: room.endedAt ? new Date(room.endedAt) : undefined,
        });

        // Create new thread for AI interactions
        const threadResponse = await fetch("/api/assistant/thread", {
          method: "POST",
        });

        if (threadResponse.ok) {
          const thread = await threadResponse.json();
          setThreadId(thread.id);
        }

        if (user) {
          connectToRoom(room.id, user.id, user.username);
        }

        setShowJoinDialog(false);
        toast({
          title: "Room Joined",
          description: "Successfully joined the room",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleLeaveRoom = () => {
    if (roomId) {
      leaveRoom();
      setRoomId(null);
      setCurrentRoom(null);
      toast({
        title: "Left Room",
        description: "Successfully left the room",
      });
    }
  };

  const handleEndRoom = async () => {
    try {
      if (!currentRoom || !user) {
        throw new Error("Room or user information is missing");
      }

      const response = await fetch(`/api/rooms/${currentRoom.id}/end`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          userId: user.id,
          creatorId: currentRoom.creatorId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Room end error:", {
          status: response.status,
          error: errorText,
          userId: user.id,
          creatorId: currentRoom.creatorId,
        });
        throw new Error(errorText);
      }

      handleLeaveRoom();
      toast({
        title: "Room Ended",
        description: "Room has been ended for all participants",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  useEffect(() => {
    if (currentRoom && user) {
      setIsCreator(user.id === currentRoom.creatorId);
    }
  }, [currentRoom, user]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const newMessage: Message = {
      role: "user",
      content: input,
      username: user?.username,
      createdAt: new Date(),
      isAssistant: false,
    };

    setMessages((prev) => [...prev, newMessage]);
    setInput("");

    if (roomId && isConnected) {
      // Send message to room
      await sendRoomMessage(input);
    } else if (threadId) {
      // Send message to AI assistant
      try {
        await sendMessageMutation.mutateAsync(input);
      } catch (error) {
        console.error("Failed to get AI response:", error);
      }
    }
  };

  const handleVoiceInput = async (transcript: string) => {
    if (!transcript.trim()) return;
    setInput(transcript);

    // Automatically send the voice transcript
    const newMessage: Message = {
      role: "user",
      content: transcript,
      username: user?.username,
      createdAt: new Date(),
      isAssistant: false,
    };

    setMessages([...messages, newMessage]);
    setInput("");

    if (roomId && isConnected) {
      sendRoomMessage(transcript);
    } else if (threadId) {
      sendMessageMutation.mutate(transcript);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Image size should be less than 5MB",
      });
      return;
    }

    // Create FormData
    const formData = new FormData();
    formData.append("image", file);
    formData.append("threadId", threadId || "");
    formData.append(
      "simulationType",
      scenarios?.find((s) => s.id === scenarioId)?.type || "emergency",
    );

    try {
      const response = await fetch("/api/assistant/upload-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload image");
      }

      const data = await response.json();

      // Add image message to chat
      const newMessage: Message = {
        role: "user",
        content: `[Image uploaded: ${file.name}]`,
        username: user?.username,
        createdAt: new Date(),
        isAssistant: false,
      };

      setMessages([...messages, newMessage]);

      // Process assistant response
      if (threadId) {
        sendMessageMutation.mutate(
          `I've uploaded an image named ${file.name}. Please analyze it.`,
        );
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  useEffect(() => {
    if (currentRoom && user) {
      setIsCreator(user.id === currentRoom.creatorId);
    }
  }, [currentRoom, user]);

  const parseVitalSigns = (content: string): VitalSigns | null => {
    console.log("Attempting to parse vital signs from:", content);

    const cleanContent = content
      .replace(/\(on[^)]*\)/g, "") // Remove parenthetical statements about oxygen
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();

    const vitals: VitalSigns = {};

    const patterns = {
      hr: /(?:Heart Rate.?|HR|hr)\s:\s(\d+)/i,
      bp: /(?:Blood Pressure.?|BP|bp)\s:\s(\d+)\s\/\s(\d+)/i,
      rr: /(?:Respiratory Rate.?|RR|rr)\s:\s(\d+)/i,
      spo2: /(?:Oxygen Saturation.?|spo.?|SpO2|SpOz|O2 Sat|SaO2)\s:\s(\d+)/i,
      temp: /(?:Temperature.?|Temp)\s:\s([\d.]+)/i,
    };

    const parseSection = (text: string) => {
      // Debug logging for each section being parsed
      console.log("Parsing section:", text);

      const hrMatch = text.match(patterns.hr);
      if (hrMatch?.[1]) {
        vitals.hr = parseInt(hrMatch[1]);
        console.log("Found HR:", vitals.hr);
      }

      const bpMatch = text.match(patterns.bp);
      if (bpMatch?.[1] && bpMatch?.[2]) {
        vitals.bp = {
          systolic: parseInt(bpMatch[1]),
          diastolic: parseInt(bpMatch[2]),
        };
        console.log("Found BP:", vitals.bp);
      }

      const rrMatch = text.match(patterns.rr);
      if (rrMatch?.[1]) {
        vitals.rr = parseInt(rrMatch[1]);
        console.log("Found RR:", vitals.rr);
      }

      const spo2Match = text.match(patterns.spo2);
      if (spo2Match?.[1]) {
        vitals.spo2 = parseInt(spo2Match[1]);
        console.log("Found SpO2:", vitals.spo2);
      }

      const tempMatch = text.match(patterns.temp);
      if (tempMatch?.[1]) {
        vitals.temp = parseFloat(tempMatch[1]);
        console.log("Found Temp:", vitals.temp);
      }
    };

    // Split the content by bullet points and process each section
    const sections = cleanContent.split("•").map((section) => section.trim());
    sections.forEach((section) => {
      if (section) {
        parseSection(section);
      }
    });

    console.log("Final parsed vitals:", vitals);
    return Object.keys(vitals).length > 0 ? vitals : null;
  };

  const parseScore = (content: string): number | null => {
    console.log("Attempting to parse score from:", content);

    // Look for score patterns like "Final Score: X/Y" or "Score: X out of Y"
    const scoreMatch = content.match(
      /(?:Final\s+)?Score:\s*(\d+)(?:\s*\/\s*|\s+out\s+of\s+)(\d+)/i,
    );

    if (scoreMatch) {
      const [_, score, total] = scoreMatch;
      const numericScore = (parseInt(score) / parseInt(total)) * 100;
      console.log("Found score:", numericScore);
      return numericScore;
    }

    // Look for percentage scores
    const percentMatch = content.match(/Score:\s*(\d+)%/i);
    if (percentMatch) {
      const score = parseInt(percentMatch[1]);
      console.log("Found percentage score:", score);
      return score;
    }

    console.log("No score found in content");
    return null;
  };

  interface ChatHistory {
    id: string;
    threadId: string;
    messages: Message[];
    createdAt: Date;
    firstMessage: string;
    lastMessage: string;
  }

  return (
    <div className="space-y-4 max-w-full p-2 md:p-6">
      <Card className="min-h-[400px] h-[calc(100vh-200px)] flex flex-col">
        <CardHeader className="p-3 md:p-6">
          <CardTitle className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <span className="text-lg">Chat Interface</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNewChat}
                className="text-xs md:text-sm"
              >
                <Plus className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                New Chat
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              {!roomId ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCreateRoom}
                    className="text-xs md:text-sm flex-1 md:flex-none"
                  >
                    Create Room
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowJoinDialog(true)}
                    className="text-xs md:text-sm flex-1 md:flex-none"
                  >
                    Join Room
                  </Button>
                </>
              ) : (
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground flex-1 md:flex-none">
                    <Users className="h-3 w-3 md:h-4 md:w-4" />
                    <span className="truncate">Room: {currentRoom?.code}</span>
                  </div>
                  {isCreator ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleEndRoom}
                      className="text-xs md:text-sm whitespace-nowrap"
                    >
                      End Room
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleLeaveRoom}
                      className="text-xs md:text-sm whitespace-nowrap"
                    >
                      Leave Room
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardTitle>
        </CardHeader>

        <ScrollArea className="flex-1 p-3 md:p-4">
          <div className="space-y-4">
            {messages.map((message, i) => (
              <div
                key={message.id || i}
                className={`flex ${
                  message.role === "user" && message.username === user?.username
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                {(message.role === "assistant" ||
                  message.username !== user?.username) && (
                  <Avatar className="h-6 w-6 md:h-8 md:w-8 mr-2">
                    <AvatarImage
                      src={
                        message.role === "assistant"
                          ? "/assistant-profile.jpeg"
                          : "/user-profile.jpeg"
                      }
                      alt={message.role === "assistant" ? "Assistant" : "User"}
                    />
                    <AvatarFallback>
                      {message.role === "assistant"
                        ? "AI"
                        : message.username?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={`rounded-lg px-3 py-2 md:px-4 md:py-2 max-w-[85%] md:max-w-[75%] text-sm md:text-base ${
                    message.role === "user" &&
                    message.username === user?.username
                      ? "bg-primary text-primary-foreground"
                      : message.role === "assistant"
                        ? "bg-muted"
                        : "bg-secondary"
                  }`}
                >
                  {message.username && (
                    <div className="text-xs font-medium mb-1">
                      {message.username}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap break-words">
                    {message.isTyping ? (
                      <TypingIndicator />
                    ) : (
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => (
                            <p className="mb-2 text-sm md:text-base">{children}</p>
                          ),
                          ul: ({ children }) => (
                            <ul className="list-disc pl-4 mb-2 text-sm md:text-base">
                              {children}
                            </ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="list-decimal pl-4 mb-2 text-sm md:text-base">
                              {children}
                            </ol>
                          ),
                          li: ({ children }) => (
                            <li className="mb-1">{children}</li>
                          ),
                          strong: ({ children }) => (
                            <strong className="font-bold">{children}</strong>
                          ),
                          em: ({ children }) => (
                            <em className="italic">{children}</em>
                          ),
                          h1: ({ children }) => (
                            <h1 className="text-lg md:text-xl font-bold mb-2">
                              {children}
                            </h1>
                          ),
                          h2: ({ children }) => (
                            <h2 className="text-base md:text-lg font-bold mb-2">
                              {children}
                            </h2>
                          ),
                          h3: ({ children }) => (
                            <h3 className="text-sm md:text-base font-bold mb-2">
                              {children}
                            </h3>
                          ),
                          code: ({ children }) => (
                            <code className="bg-muted-foreground/10 rounded px-1 text-sm">
                              {children}
                            </code>
                          ),
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    )}
                  </div>
                  {message.createdAt && (
                    <div className="text-[10px] md:text-xs text-muted-foreground mt-1">
                      {new Date(message.createdAt).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <CardContent className="border-t p-3 md:p-4">
          <div className="flex flex-wrap md:flex-nowrap gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              onKeyPress={(e) => e.key === "Enter" && handleSend()}
              className="min-h-[40px] text-sm md:text-base flex-1"
            />
            <div className="flex gap-2 w-full md:w-auto">
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="flex-1 md:flex-none"
              >
                <Send className="h-4 w-4" />
              </Button>
              <div className="relative">
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    const input = document.getElementById('image-upload');
                    if (input) {
                      input.click();
                    }
                  }}
                  className="min-w-[40px]"
                >
                  <Upload className="h-4 w-4" />
                </Button>
              </div>
              <VoiceInput onTranscript={handleVoiceInput} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vital Signs Monitor */}
      <div className="w-full overflow-x-auto">
        <VitalSignsMonitor latestVitals={latestVitals} />
      </div>

      {chatHistory.length > 0 && (
        <Card>
          <CardContent className="p-3 md:p-4">
            <h4 className="font-semibold mb-4 text-sm md:text-base">Chat History</h4>
            <ScrollArea className="h-[150px] md:h-[200px]">
              <div className="space-y-2">
                {chatHistory.map((chat) => (
                  <Button
                    key={chat.id}
                    variant="ghost"
                    className="w-full justify-start text-left"
                    onClick={() => handleLoadChat(chat.id)}
                  >
                    <div className="flex flex-col items-start">
                      <span className="text-xs md:text-sm font-medium truncate w-full">
                        {chat.firstMessage}
                      </span>
                      <span className="text-[10px] md:text-xs text-muted-foreground">
                        {new Date(chat.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent className="sm:max-w-[90%] md:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-base md:text-lg">Join Room</DialogTitle>
            <DialogDescription className="text-sm">
              Enter the room code shared with you to join a collaborative session.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code" className="text-sm">Room Code</Label>
              <Input
                id="code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Enter room code"
                className="text-base"
              />
            </div>
            <Button
              className="w-full"
              onClick={handleJoinRoom}
              disabled={!roomCode}
            >
              Join Room
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}