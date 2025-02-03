import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from 'react-markdown';

const parseVitalSigns = (content: string): VitalSigns | null => {
  // Look for vital signs block in markdown format
  const vitalsMatch = content.match(/Vital Signs Monitor:\n\n([\s\S]*?)(?:\n\n|$)/);
  if (!vitalsMatch) return null;

  const vitalsBlock = vitalsMatch[1];

  const hrMatch = vitalsBlock.match(/HR:\s*(\d+)\s*bpm/);
  const bpMatch = vitalsBlock.match(/BP:\s*(\d+)\/(\d+)\s*mmHg/);
  const rrMatch = vitalsBlock.match(/RR:\s*(\d+)/);
  const spo2Match = vitalsBlock.match(/SpO₂:\s*(\d+)%/);
  const tempMatch = vitalsBlock.match(/Temp:\s*(\d+\.?\d*)/);

  if (!hrMatch && !bpMatch && !rrMatch && !spo2Match && !tempMatch) {
    return null;
  }

  return {
    hr: hrMatch ? parseInt(hrMatch[1]) : undefined,
    bp: bpMatch ? { systolic: parseInt(bpMatch[1]), diastolic: parseInt(bpMatch[2]) } : undefined,
    rr: rrMatch ? parseInt(rrMatch[1]) : undefined,
    spo2: spo2Match ? parseInt(spo2Match[1]) : undefined,
    temp: tempMatch ? parseFloat(tempMatch[1]) : undefined,
  };
};

const removeVitalSignsBlock = (content: string): string => {
  return content.replace(/Vital Signs Monitor:\n\nHR:.*?Temp:.*?°C/gm, '').trim();
};

interface Message {
  id?: number;
  role: "user" | "assistant";
  content: string;
  username?: string;
  createdAt?: string | Date;
}

interface ChatHistory {
  id: string;
  threadId: string;
  messages: Message[];
  createdAt: Date;
  firstMessage: string;
  lastMessage: string;
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

  const { user } = useUser();
  const { toast } = useToast();
  const {
    createRoom,
    joinRoom,
    getRoomMessages,
    connectToRoom,
    sendMessage: sendRoomMessage,
    isConnected,
  } = useRoom();

  // Load chat history
  useEffect(() => {
    const loadHistory = () => {
      const history = localStorage.getItem(`chat_history_list_${user?.id}_${scenarioId}`);
      if (history) {
        setChatHistory(JSON.parse(history));
      }

      // Load current chat if exists
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
        JSON.stringify(chatData)
      );

      // Update history list
      const firstMessage = messages[0].content;
      const lastMessage = messages[messages.length - 1].content;
      const updatedHistory = chatHistory.map(chat => 
        chat.id === currentChatId 
          ? { 
              ...chat, 
              firstMessage: firstMessage.substring(0, 100) + "...",
              lastMessage: lastMessage.substring(0, 100) + "..."
            }
          : chat
      );

      if (!chatHistory.some(chat => chat.id === currentChatId)) {
        updatedHistory.unshift({
          id: currentChatId,
          threadId: threadId || '',
          messages,
          createdAt: new Date(),
          firstMessage: firstMessage.substring(0, 100) + "...",
          lastMessage: lastMessage.substring(0, 100) + "..."
        });
      }

      setChatHistory(updatedHistory);
      localStorage.setItem(
        `chat_history_list_${user?.id}_${scenarioId}`,
        JSON.stringify(updatedHistory)
      );

      // Save current chat id
      localStorage.setItem(
        `current_chat_${user?.id}_${scenarioId}`,
        currentChatId
      );
    }
  }, [messages, currentChatId, user?.id, scenarioId, threadId]);

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

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      setIsTyping(true);
      const response = await fetch("/api/assistant/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, threadId }),
      });
      if (!response.ok) throw new Error("Failed to send message");
      return response.json();
    },
    onSuccess: (data) => {
      const contentParts = data.content.split('---').map((part: string) => part.trim());

      contentParts.forEach((part: string) => {
        const vitals = parseVitalSigns(part);
        if (vitals) {
          setLatestVitals(vitals);
        }
        const cleanContent = removeVitalSignsBlock(part);
        if (cleanContent) {
          setMessages(prev => [
            ...prev,
            { 
              role: "assistant", 
              content: cleanContent
            }
          ]);
        }
      });
      setIsTyping(false);
    },
    onError: (error: Error) => {
      setIsTyping(false);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
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
      threadId: '',
      messages: [],
      createdAt: new Date(),
      firstMessage: "New conversation",
      lastMessage: "New conversation"
    };

    setChatHistory(prev => [newChat, ...prev]);
  };

  // Load previous chat
  const handleLoadChat = (chatId: string) => {
    setCurrentChatId(chatId);
    const savedChat = localStorage.getItem(`chat_${user?.id}_${scenarioId}_${chatId}`);
    if (savedChat) {
      const chatData = JSON.parse(savedChat);
      setMessages(chatData.messages);
      setThreadId(chatData.threadId);

      // Update vital signs from the latest message containing vitals
      const latestVitalsMessage = [...chatData.messages].reverse()
        .find(msg => msg.role === "assistant" && msg.content.includes("Vital Signs Monitor:"));

      if (latestVitalsMessage) {
        const vitals = parseVitalSigns(latestVitalsMessage.content);
        if (vitals) {
          setLatestVitals(vitals);
        }
      } else {
        setLatestVitals({}); // Reset if no vitals found
      }
    }
  };

  // Initialize thread when component mounts
  useEffect(() => {
    if (!threadId && !currentChatId) {
      handleNewChat();
    }
  }, []);

  // Fetch room messages if in collaborative mode
  const { data: roomMessages } = useQuery({
    queryKey: [`/api/rooms/${roomId}/messages`],
    queryFn: () => getRoomMessages(roomId!),
    enabled: !!roomId,
  });

  useEffect(() => {
    if (roomMessages) {
      setMessages(
        roomMessages.map((msg) => ({
          id: msg.id,
          role: "user",
          content: msg.content,
          createdAt: new Date(msg.createdAt),
          username: user?.id === msg.userId ? user.username : undefined,
        }))
      );
    }
  }, [roomMessages, user]);

  const handleCreateRoom = async () => {
    try {
      const room = await createRoom({ scenarioId });
      setRoomId(room.id);

      if (user) {
        connectToRoom(room.id, user.id, user.username);
      }

      toast({
        title: "Room Created",
        description: `Share this code with others: ${room.code}`,
      });
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
      setRoomId(room.id);

      if (user) {
        connectToRoom(room.id, user.id, user.username);
      }

      setShowJoinDialog(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const newMessage: Message = {
      role: "user",
      content: input,
      username: user?.username,
      createdAt: new Date(),
    };

    setMessages([...messages, newMessage]);
    setInput("");

    if (roomId && isConnected) {
      sendRoomMessage(input);
    } else if (threadId) {
      sendMessageMutation.mutate(input);
    }
  };

  const handleVoiceInput = (transcript: string) => {
    setInput(transcript);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log("Image upload:", file);
  };

  return (
    <div className="space-y-6">
      <Card className="h-[600px] flex flex-col">
        <CardContent className="flex-none p-4 border-b">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Chat Interface</h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleNewChat}
              >
                <Plus className="h-4 w-4 mr-2" />
                New Chat
              </Button>
              {!roomId ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCreateRoom}
                  >
                    Create Room
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowJoinDialog(true)}
                  >
                    Join Room
                  </Button>
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>Collaborative Mode</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((message, i) => (
              <div
                key={i}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`rounded-lg px-4 py-2 max-w-[80%] ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {message.username && (
                    <div className="text-xs font-medium mb-1">
                      {message.username}
                    </div>
                  )}
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="rounded-lg px-4 py-2 bg-muted">
                  <TypingIndicator />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <CardContent className="border-t p-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              onKeyPress={(e) => e.key === "Enter" && handleSend()}
            />
            <VoiceInput onTranscript={handleVoiceInput} />
            <Button
              variant="outline"
              size="icon"
              onClick={() => document.getElementById("image-upload")?.click()}
            >
              <Upload className="h-4 w-4" />
              <input
                id="image-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
            </Button>
            <Button 
              size="icon" 
              onClick={handleSend}
              disabled={sendMessageMutation.isPending || isTyping}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Vital Signs Monitor */}
      <VitalSignsMonitor latestVitals={latestVitals} />

      {/* Chat History Section */}
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