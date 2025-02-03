import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
import { useRoom } from "@/hooks/use-room";
import { useUser } from "@/hooks/use-user";
import { Send, Upload, Users } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id?: number;
  role: "user" | "assistant";
  content: string;
  username?: string;
  createdAt?: Date;
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
      const response = await fetch("/api/assistant/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, threadId }),
      });
      if (!response.ok) throw new Error("Failed to send message");
      return response.json();
    },
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.content },
      ]);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  // Initialize thread when component mounts
  useEffect(() => {
    if (!threadId) {
      createThreadMutation.mutate();
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
    <Card className="h-[600px] flex flex-col">
      <CardContent className="flex-none p-4 border-b">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">Chat Interface</h3>
          {!roomId ? (
            <div className="flex gap-2">
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
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Collaborative Mode</span>
            </div>
          )}
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
                {message.content}
              </div>
            </div>
          ))}
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
            disabled={sendMessageMutation.isPending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>

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
    </Card>
  );
}