import OpenAI from "openai";
import { z } from "zod";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const translateRequestSchema = z.object({
  text: z.string().min(1, "Text is required"),
  targetLanguage: z.string().min(2, "Target language is required"),
});

export type TranslationRequest = z.infer<typeof translateRequestSchema>;

export async function translateMedicalTerm(text: string, targetLanguage: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a medical terminology expert. Translate and explain medical terms accurately, considering cultural and linguistic nuances. Always provide:
          1. Direct translation
          2. Clinical definition
          3. Common usage in medical settings`
        },
        {
          role: "user",
          content: `Translate and explain this medical term to ${targetLanguage}: ${text}`
        }
      ],
      temperature: 0.3, // Lower temperature for more accurate translations
      max_tokens: 500,
    });

    return response.choices[0].message.content || "Translation not available";
  } catch (error: any) {
    console.error("OpenAI translation error:", error);
    throw new Error(`Translation failed: ${error.message}`);
  }
}

export const guidelineRequestSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  context: z.string().optional(),
});

export type GuidelineRequest = z.infer<typeof guidelineRequestSchema>;

export async function getATLSGuidelines(topic: string, context?: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an emergency medicine expert with deep knowledge of ATLS (Advanced Trauma Life Support) guidelines and protocols. 
          Provide accurate, concise information following these principles:
          1. Strictly adhere to the latest ATLS guidelines
          2. Focus on practical, actionable steps
          3. Include relevant assessment criteria and decision points
          4. Reference specific ATLS protocols where applicable`
        },
        {
          role: "user",
          content: `Provide ATLS guidelines and protocols for: ${topic}${context ? `\nContext: ${context}` : ''}`
        }
      ],
      temperature: 0.2, // Very low temperature for consistent, accurate guidelines
      max_tokens: 1000,
    });

    return response.choices[0].message.content || "Guidelines not available";
  } catch (error: any) {
    console.error("OpenAI guidelines error:", error);
    throw new Error(`Failed to retrieve guidelines: ${error.message}`);
  }
}
