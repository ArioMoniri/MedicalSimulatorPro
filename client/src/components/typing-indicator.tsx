import { Loader2 } from "lucide-react";

export default function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>Medical Assistant is typing...</span>
    </div>
  );
}
