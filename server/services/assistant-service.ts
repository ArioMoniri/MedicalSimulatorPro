import OpenAI from "openai";
import { z } from "zod";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Assistant ID for the emergency simulator
const ASSISTANT_ID = "asst_kiBkT0Aq4TNAdBfpQpHZVj14";

export const assistantMessageSchema = z.object({
  content: z.string().min(1, "Message content is required"),
  threadId: z.string().optional(),
});

export type AssistantMessage = z.infer<typeof assistantMessageSchema>;

export async function createThread() {
  try {
    const thread = await openai.beta.threads.create();
    return thread;
  } catch (error: any) {
    console.error("Failed to create thread:", error);
    throw new Error(`Failed to create thread: ${error.message}`);
  }
}

export async function sendMessage(content: string, threadId: string) {
  try {
    // Add the message to the thread
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content,
    });

    // Run the assistant
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: ASSISTANT_ID,
    });

    // Wait for the run to complete with timeout
    let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds timeout

    while (runStatus.status === "queued" || runStatus.status === "in_progress") {
      if (attempts >= maxAttempts) {
        throw new Error("Request timed out after 30 seconds");
      }

      // Wait for 1 second before checking again
      await new Promise((resolve) => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
      attempts++;

      // Log status for debugging
      console.log(`Run status check ${attempts}: ${runStatus.status}`);
    }

    // Handle failed or cancelled runs
    if (runStatus.status === "failed") {
      console.error("Run failed:", runStatus.last_error);
      throw new Error(`Run failed: ${runStatus.last_error?.code} - ${runStatus.last_error?.message}`);
    }

    if (runStatus.status === "cancelled") {
      throw new Error("Run was cancelled");
    }

    if (runStatus.status === "expired") {
      throw new Error("Run expired");
    }

    if (runStatus.status === "requires_action") {
      throw new Error("Run requires action");
    }

    // Get the assistant's response
    const messages = await openai.beta.threads.messages.list(threadId);
    const assistantMessage = messages.data.find(msg => msg.role === "assistant");

    if (!assistantMessage || !assistantMessage.content[0]) {
      throw new Error("No response from assistant");
    }

    return {
      role: "assistant",
      content: assistantMessage.content[0].type === 'text' ? assistantMessage.content[0].text.value : '',
    };
  } catch (error: any) {
    console.error("Failed to send message:", error);
    throw new Error(`Failed to send message: ${error.message}`);
  }
}