import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export default function VoiceInput({ onTranscript }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const { toast } = useToast();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition && !recognitionRef.current) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US'; // Set language explicitly

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

          let errorMessage = "An error occurred. Please try again.";
          switch (event.error) {
            case 'network':
              errorMessage = "Network connection is required for voice input. Please check your connection.";
              break;
            case 'not-allowed':
              errorMessage = "Microphone access was denied. Please enable microphone access in your browser settings.";
              setHasPermission(false);
              break;
            case 'no-speech':
              errorMessage = "No speech was detected. Please try again.";
              break;
            case 'aborted':
              return; // Don't show error for user-initiated stops
          }

          toast({
            variant: "destructive",
            title: "Voice Input Error",
            description: errorMessage
          });
        };

        recognitionRef.current = recognition;
      } else if (!SpeechRecognition) {
        toast({
          variant: "destructive",
          title: "Voice Input Not Supported",
          description: "Your browser doesn't support voice input. Please try using a modern browser like Chrome."
        });
      }
    }

    // Cleanup
    return () => {
      if (recognitionRef.current && isRecording) {
        recognitionRef.current.stop();
      }
    };
  }, [onTranscript, toast, isRecording]);

  const checkMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setHasPermission(true);
      return true;
    } catch (error) {
      console.error("Microphone permission error:", error);
      setHasPermission(false);
      return false;
    }
  };

  const toggleRecording = useCallback(async () => {
    if (!recognitionRef.current) {
      toast({
        variant: "destructive",
        title: "Voice Input Error",
        description: "Speech recognition is not initialized"
      });
      return;
    }

    try {
      if (isRecording) {
        recognitionRef.current.stop();
      } else {
        // Check/request microphone permission first
        if (hasPermission === null) {
          const permitted = await checkMicrophonePermission();
          if (!permitted) {
            toast({
              variant: "destructive",
              title: "Microphone Access Required",
              description: "Please allow microphone access to use voice input"
            });
            return;
          }
        } else if (!hasPermission) {
          toast({
            variant: "destructive",
            title: "Microphone Access Denied",
            description: "Please enable microphone access in your browser settings"
          });
          return;
        }

        // Check network connectivity
        if (!navigator.onLine) {
          toast({
            variant: "destructive",
            title: "Network Error",
            description: "Please check your internet connection to use voice input"
          });
          return;
        }

        recognitionRef.current.start();
      }
    } catch (error) {
      console.error("Speech recognition error:", error);
      setIsRecording(false);
      toast({
        variant: "destructive",
        title: "Voice Input Error",
        description: "Failed to start voice input. Please try again."
      });
    }
  }, [isRecording, hasPermission, toast]);

  if (!recognitionRef.current) {
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