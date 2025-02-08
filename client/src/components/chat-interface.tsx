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
import { useMobile } from "@/hooks/use-mobile";
import { Send, Upload, Users, Plus, Menu } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from 'react-markdown';

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

interface ChatHistory {
  id: string;
  threadId: string;
  messages: Message[];
  createdAt: Date;
  firstMessage: string;
  lastMessage: string;
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
  const [showHistory, setShowHistory] = useState(true);
  const isMobile = useMobile();
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

  useEffect(() => {
    const loadHistory = () => {
      const history = localStorage.getItem(`chat_history_list_${user?.id}_${scenarioId}`);
      if (history) {
        setChatHistory(JSON.parse(history));
      }

      const currentId = localStorage.getItem(`current_chat_${user?.id}_${scenarioId}`);
      if (currentId) {
        setCurrentChatId(currentId);
        const savedChat = localStorage.getItem(`chat_${user?.id}_${scenarioId}_${currentId}`);
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

  useEffect(() => {
    if (user?.id && currentChatId && messages.length > 0) {
      const chatData = {
        messages,
        threadId,
      };
      localStorage.setItem(
        `chat_${user?.id}_${scenarioId}_${currentChatId}`,
        JSON.stringify(chatData)
      );

      const firstMessage = messages[0].content;
      const lastMessage = messages[messages.length - 1].content;
      let updatedHistory = chatHistory.filter(chat => chat.id !== currentChatId);

      const newChat: ChatHistory = {
        id: currentChatId,
        threadId: threadId || '',
        messages,
        createdAt: new Date(),
        firstMessage: firstMessage.substring(0, 100) + "...",
        lastMessage: lastMessage.substring(0, 100) + "..."
      };

      updatedHistory = [newChat, ...updatedHistory];

      setChatHistory(updatedHistory);
      localStorage.setItem(
        `chat_history_list_${user?.id}_${scenarioId}`,
        JSON.stringify(updatedHistory)
      );

      localStorage.setItem(
        `current_chat_${user?.id}_${scenarioId}`,
        currentChatId
      );
    }
  }, [messages, currentChatId, user?.id, scenarioId, threadId, chatHistory]);


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

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Medical Assistant is typing...",
        createdAt: new Date(),
        username: "System",
        isTyping: true,
        isAssistant: true
      }]);

      const response = await fetch("/api/assistant/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          threadId,
          simulationType: scenarios?.find(s => s.id === scenarioId)?.type || "emergency"
        }),
      });
      if (!response.ok) throw new Error("Failed to send message");
      return response.json();
    },
    onSuccess: (data) => {
      const content = data.content;
      console.log("Received message:", content);

      setMessages(prev => {
        const filtered = prev.filter(msg => !msg.isTyping);
        return [...filtered, {
          role: "assistant",
          content: content,
          createdAt: new Date(),
          username: "Medical Assistant",
          isTyping: false,
          isAssistant: true
        }];
      });

      const vitals = parseVitalSigns(content);
      if (vitals) {
        console.log("Found new vitals:", vitals);
        setLatestVitals(vitals);

        if (threadId) {
          saveVitalSignsMutation.mutate({
            ...vitals,
            threadId,
          });
        }
      }

      const score = parseScore(content);
      if (score !== null && scenarioId) {
        updateProgress.mutate({
          scenarioId,
          score,
          threadId: threadId!,
          feedback: content
        });
      }
    },
    onError: (error: Error) => {
      setMessages(prev => prev.filter(msg => !msg.isTyping));
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const updateProgress = useMutation({
    mutationFn: async (data: { scenarioId: number; score: number; threadId: string, feedback: string }) => {
      const response = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update progress");
      return response.json();
    },
    onSuccess: () => {
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

  const handleNewChat = async () => {
    const newChatId = Date.now().toString();
    setCurrentChatId(newChatId);
    setMessages([]);
    setLatestVitals({});

    createThreadMutation.mutate();

    const newChat: ChatHistory = {
      id: newChatId,
      threadId: '',
      messages: [],
      createdAt: new Date(),
      firstMessage: "New conversation",
      lastMessage: "New conversation"
    };

    setChatHistory(prev => [newChat, ...prev]);
  };

  const handleLoadChat = (chatId: string) => {
    setCurrentChatId(chatId);
    setLatestVitals({});
    const savedChat = localStorage.getItem(`chat_${user?.id}_${scenarioId}_${chatId}`);
    if (savedChat) {
      const chatData = JSON.parse(savedChat);
      setMessages(chatData.messages);
      setThreadId(chatData.threadId);

      const lastMessageWithVitals = [...chatData.messages].reverse()
        .find(msg => {
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

  useEffect(() => {
    if (!threadId && !currentChatId) {
      handleNewChat();
    }
  }, []);

  const { data: roomMessagesData } = useQuery({
    queryKey: [`/api/rooms/${roomId}/messages`],
    queryFn: () => getRoomMessages(roomId!),
    enabled: !!roomId,
    refetchInterval: 1000,
  });

  useEffect(() => {
    if (roomMessagesData) {
      const sortedMessages = [...roomMessagesData].sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateA - dateB;
      });

      sortedMessages.forEach(msg => {
        if (msg.isAssistant) {
          const vitals = parseVitalSigns(msg.content);
          if (vitals) {
            setLatestVitals(vitals);
          }
        }
      });

      const newMessages: Message[] = sortedMessages.map((msg) => {
        if (msg.content.includes("joined the room") ||
          msg.content.includes("left the room") ||
          msg.content.includes("is typing")) {
          return {
            id: msg.id,
            role: "assistant",
            content: msg.content,
            createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
            username: "System",
            isTyping: msg.content.includes("is typing"),
            isAssistant: true
          };
        }

        if (msg.isAssistant) {
          const vitals = parseVitalSigns(msg.content);
          if (vitals) {
            setLatestVitals(vitals);
          }

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
          username: msg.username || user?.username,
          isTyping: false,
          isAssistant: false
        };
      });

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

  const handleCreateRoom = async () => {
    try {
      const room = await createRoom({ scenarioId });
      if (room) {
        setRoomId(room.id);
        setCurrentRoom({
          id: room.id,
          code: room.code,
          creatorId: room.creatorId,
          endedAt: room.endedAt ? new Date(room.endedAt) : undefined
        });

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
          endedAt: room.endedAt ? new Date(room.endedAt) : undefined
        });

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
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          userId: user.id,
          creatorId: currentRoom.creatorId
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Room end error:', {
          status: response.status,
          error: errorText,
          userId: user.id,
          creatorId: currentRoom.creatorId
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
      isAssistant: false
    };

    setMessages(prev => [...prev, newMessage]);
    setInput("");

    if (roomId && isConnected) {
      await sendRoomMessage(input);
    } else if (threadId) {
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

    const newMessage: Message = {
      role: "user",
      content: transcript,
      username: user?.username,
      createdAt: new Date(),
      isAssistant: false
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

    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Image size should be less than 5MB"
      });
      return;
    }

    const formData = new FormData();
    formData.append('image', file);
    formData.append('threadId', threadId || '');
    formData.append('simulationType', scenarios?.find(s => s.id === scenarioId)?.type || 'emergency');

    try {
      const response = await fetch('/api/assistant/upload-image', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();

      const newMessage: Message = {
        role: "user",
        content: `[Image uploaded: ${file.name}]`,
        username: user?.username,
        createdAt: new Date(),
        isAssistant: false
      };

      setMessages([...messages, newMessage]);

      if (threadId) {
        sendMessageMutation.mutate(`I've uploaded an image named ${file.name}. Please analyze it.`);
      }

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message
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
      .replace(/[•*-]\s+/g, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const vitals: VitalSigns = {};

    const patterns = {
      hr: /\(?\s*(?:hr|heart rate)\s*\)?\s*:?\s*(\d+)(?:\s*bpm)?/i,
      BP: /\(?\s*(?:bp|blood pressure)\s*\)?\s*:?\s*(\d+)\s*\/\s*(\d+)(?:\s*(?:mmhg|mm hg))?/i,
      rr: /\(?\s*(?:rr|respiratory rate|resp)\s*\)?\s*:?\s*(\d+)(?:\s*(?:breaths\/min|\/min|bpm))?/i,
      spo2: /\(?\s*(?:spo.*?|spo2|o2 sat|oxygen saturation|sao2)\s*\)?\s*:?\s*(\d+)\s*%?/i,
      temp: /\(?\s*(?:temp|temperature)\s*\)?\s*:?\s*([\d.]+)(?:\s*[°]?\s*[CF])?/i
    };

    const hrMatch = cleanContent.match(patterns.hr);
    if (hrMatch) {
      vitals.hr = parseInt(hrMatch[1]);
      console.log("Found HR:", vitals.hr);
    }

    const bpMatch = cleanContent.match(patterns.BP);
    if (bpMatch) {
      vitals.bp = {
        systolic: parseInt(bpMatch[1]),
        diastolic: parseInt(bpMatch[2])
      };
      console.log("Found BP:", vitals.bp);
    }

    const rrMatch = cleanContent.match(patterns.rr);
    if (rrMatch) {
      vitals.rr = parseInt(rrMatch[1]);
      console.log("Found RR:", vitals.rr);
    }

    const spo2Match = cleanContent.match(patterns.spo2);
    if (spo2Match) {
      vitals.spo2 = parseInt(spo2Match[1]);
      console.log("Found SpO2:", vitals.spo2);
    }

    const tempMatch = cleanContent.match(patterns.temp);
    if (tempMatch) {
      vitals.temp = parseFloat(tempMatch[1]);
      console.log("Found Temp:", vitals.temp);
    }

    if (Object.keys(vitals).length === 0) {
      const parts = cleanContent.split(/[,•]/).map(part => part.trim());
      parts.forEach(part => {
        if (!vitals.hr) {
          const hrMatch = part.match(patterns.hr);
          if (hrMatch) vitals.hr = parseInt(hrMatch[1]);
        }
        if (!vitals.bp) {
          const bpMatch = part.match(patterns.BP);
          if (bpMatch) vitals.bp = { systolic: parseInt(bpMatch[1]), diastolic: parseInt(bpMatch[2]) };
        }
        if (!vitals.rr) {
          const rrMatch = part.match(patterns.rr);
          if (rrMatch) vitals.rr = parseInt(rrMatch[1]);
        }
        if (!vitals.spo2) {
          const spo2Match = part.match(patterns.spo2);
          if (spo2Match) vitals.spo2 = parseInt(spo2Match[1]);
        }
        if (!vitals.temp) {
          const tempMatch = part.match(patterns.temp);
          if (tempMatch) vitals.temp = parseFloat(tempMatch[1]);
        }
      });
    }

    console.log("Final parsed vitals:", vitals);
    return Object.keys(vitals).length > 0 ? vitals : null;
  };

  const parseScore = (content: string): number | null => {
    console.log("Attempting to parse score from:", content);

    const scoreMatch = content.match(/(?:Final\s+)?Score:\s*(\d+)(?:\s*\/\s*|\s+out\s+of\s+)(\d+)/i);

    if (scoreMatch) {
      const [_, score, total] = scoreMatch;
      const numericScore = (parseInt(score) / parseInt(total)) * 100;
      console.log("Found score:", numericScore);
      return numericScore;
    }

    const percentMatch = content.match(/Score:\s*(\d+)%/i);
    if (percentMatch) {
      const score = parseInt(percentMatch[1]);
      console.log("Found percentage score:", score);
      return score;
    }

    console.log("No score found in content");
    return null;
  };

  const toggleHistory = () => {
    setShowHistory(!showHistory);
  };

  return (
    <div className="space-y-4 px-2 md:px-6">
      <Card className="h-[600px] flex flex-col">
        <CardHeader className="pb-4">
          <CardTitle className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
            <div className="flex items-center gap-2">
              <span>Chat Interface</span>
              <Button
                variant="outline"
                size={isMobile ? "sm" : "default"}
                onClick={handleNewChat}
                className="h-8"
              >
                <Plus className="h-4 w-4 mr-1" />
                New Chat
              </Button>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              {!roomId ? (
                <>
                  <Button
                    variant="outline"
                    size={isMobile ? "sm" : "default"}
                    onClick={handleCreateRoom}
                    className="flex-1 md:flex-none h-8"
                  >
                    Create Room
                  </Button>
                  <Button
                    variant="outline"
                    size={isMobile ? "sm" : "default"}
                    onClick={() => setShowJoinDialog(true)}
                    className="flex-1 md:flex-none h-8"
                  >
                    Join Room
                  </Button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span className="hidden md:inline">Room Code:</span>
                    <span>{currentRoom?.code}</span>
                  </div>
                  {isCreator ? (
                    <Button
                      variant="destructive"
                      size={isMobile ? "sm" : "default"}
                      onClick={handleEndRoom}
                      className="h-8"
                    >
                      End Room
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      size={isMobile ? "sm" : "default"}
                      onClick={handleLeaveRoom}
                      className="h-8"
                    >
                      Leave
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardTitle>
        </CardHeader>

        <ScrollArea className="flex-1 p-4">
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
                {(message.role === "assistant" || message.username !== user?.username) && (
                  <Avatar className="h-8 w-8 mr-2">
                    <AvatarImage
                      src={message.role === "assistant" ? "/assistant-profile.jpeg" : "/user-profile.jpeg"}
                      alt={message.role === "assistant" ? "Assistant" : "User"}
                    />
                    <AvatarFallback>
                      {message.role === "assistant" ? "AI" : message.username?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={`rounded-lg px-4 py-2 max-w-[85%] md:max-w-[75%] ${
                    message.role === "user" && message.username === user?.username
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
                          p: ({ children }) => <p className="mb-2">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                          li: ({ children }) => <li className="mb-1">{children}</li>,
                          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                          em: ({ children }) => <em className="italic">{children}</em>,
                          h1: ({ children }) => <h1 className="text-xl font-bold mb-2">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-lg font-bold mb-2">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-base font-bold mb-2">{children}</h3>,
                          code: ({ children }) => <code className="bg-muted-foreground/10 rounded px-1">{children}</code>,
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    )}
                  </div>
                  {message.createdAt && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(message.createdAt).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <CardContent className="border-t p-2 md:p-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              onKeyPress={(e) => e.key === "Enter" && handleSend()}
              className="h-10"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              size={isMobile ? "sm" : "default"}
              className="h-10"
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
                size={isMobile ? "sm" : "icon"}
                onClick={() => {
                  const input = document.getElementById('image-upload');
                  if (input) {
                    input.click();
                  }
                }}
                className="h-10"
              >
                <Upload className="h-4 w-4" />
              </Button>
            </div>
            <VoiceInput onTranscript={handleVoiceInput} />
          </div>
        </CardContent>
      </Card>

      <div className="hidden md:block">
        <VitalSignsMonitor latestVitals={latestVitals} />
      </div>

      {isMobile && (
        <Button
          variant="outline"
          className="w-full mb-2"
          onClick={() => setShowHistory(!showHistory)}
        >
          <Menu className="h-4 w-4 mr-2" />
          {showHistory ? "Hide" : "Show"} History & Vitals
        </Button>
      )}

      {(!isMobile || showHistory) && (
        <>
          {isMobile && <VitalSignsMonitor latestVitals={latestVitals} />}

          {chatHistory.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h4 className="font-semibold mb-4">Chat History</h4>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {chatHistory.map((chat) => (
                      <Button
                        key={chat.id}
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => handleLoadChat(chat.id)}
                      >
                        <div className="flex flex-col items-start">
                          <span className="text-sm font-medium">
                            {chat.firstMessage}
                          </span>
                          <span className="text-xs text-muted-foreground">
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
        </>
      )}

      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join Room</DialogTitle>
            <DialogDescription>
              Enter the room code shared with you to join a collaborative session.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">Room Code</Label>
              <Input
                id="code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Enter room code"
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