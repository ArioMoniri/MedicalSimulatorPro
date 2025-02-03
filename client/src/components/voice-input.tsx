import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
}

// Add proper types for Speech Recognition
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export default function VoiceInput({ onTranscript }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const { toast } = useToast();

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => {
          console.log("Voice recognition started");
          setIsRecording(true);
        };

        recognition.onend = () => {
          console.log("Voice recognition ended");
          setIsRecording(false);
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = Array.from(event.results)
            .map(result => result[0].transcript)
            .join("");

          if (event.results[0].isFinal) {
            onTranscript(transcript);
          }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error("Speech recognition error:", event.error);
          setIsRecording(false);

          toast({
            variant: "destructive",
            title: "Voice Input Error",
            description: `Error: ${event.error}. Please try again.`
          });
        };

        setRecognition(recognition);
      } else {
        toast({
          variant: "destructive",
          title: "Voice Input Not Supported",
          description: "Your browser doesn't support voice input. Please try using a modern browser like Chrome."
        });
      }
    }
  }, [onTranscript, toast]);

  const toggleRecording = useCallback(async () => {
    if (!recognition) {
      toast({
        variant: "destructive",
        title: "Voice Input Error",
        description: "Speech recognition is not initialized"
      });
      return;
    }

    try {
      if (isRecording) {
        recognition.stop();
      } else {
        // Request microphone permission first
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // Stop the stream immediately
        recognition.start();
      }
    } catch (error) {
      console.error("Microphone permission error:", error);
      toast({
        variant: "destructive",
        title: "Microphone Access Denied",
        description: "Please allow microphone access to use voice input"
      });
      setIsRecording(false);
    }
  }, [recognition, isRecording, toast]);

  if (!recognition) {
    return null;
  }

  return (
    <Button
      variant={isRecording ? "destructive" : "secondary"}
      size="icon"
      onClick={toggleRecording}
      className="relative"
    >
      {isRecording ? (
        <MicOff className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
      {isRecording && (
        <span className="absolute -top-1 -right-1 h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
        </span>
      )}
    </Button>
  );
}