import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function translateMedicalTerm(text: string, targetLanguage: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a medical translation expert. Provide accurate translations of medical terminology while maintaining clinical precision. Output JSON in format: { 'translation': string }"
        },
        {
          role: "user",
          content: `Translate the following medical term/phrase to ${targetLanguage}: ${text}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result.translation;
  } catch (error) {
    console.error("Translation error:", error);
    throw new Error("Failed to translate medical term");
  }
}

export async function getATLSGuidelines(topic: string, context?: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an ATLS (Advanced Trauma Life Support) expert. Provide evidence-based guidelines and protocols based on the latest medical standards. Output JSON in format: { 'guidelines': string }"
        },
        {
          role: "user",
          content: `Provide ATLS guidelines for: ${topic}${context ? `\nAdditional context: ${context}` : ''}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result.guidelines;
  } catch (error) {
    console.error("Guidelines error:", error);
    throw new Error("Failed to fetch ATLS guidelines");
  }
}
