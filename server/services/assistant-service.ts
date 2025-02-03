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
    const message = await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content,
    });

    // Run the assistant on the thread
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: ASSISTANT_ID,
    });

    // Wait for the run to complete
    let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    while (runStatus.status === "queued" || runStatus.status === "in_progress") {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    }

    if (runStatus.status === "completed") {
      // Get the assistant's response
      const messages = await openai.beta.threads.messages.list(threadId);
      const latestMessage = messages.data[0];
      
      return {
        role: latestMessage.role,
        content: latestMessage.content[0].type === 'text' ? latestMessage.content[0].text.value : '',
      };
    } else {
      throw new Error(`Run failed with status: ${runStatus.status}`);
    }
  } catch (error: any) {
    console.error("Failed to send message:", error);
    throw new Error(`Failed to send message: ${error.message}`);
  }
}
