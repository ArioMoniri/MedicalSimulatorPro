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

    if (!response.choices?.[0]?.message?.content) {
      throw new Error("Invalid response from OpenAI");
    }

    const result = JSON.parse(response.choices[0].message.content);
    if (!result?.translation) {
      throw new Error("Invalid translation response format");
    }

    return result.translation;
  } catch (error) {
    console.error("Translation error:", error);
    throw new Error("Failed to translate medical term");
  }
}

interface GuidelineNode {
  id: string;
  type: 'default' | 'decision' | 'action';
  data: { label: string };
  position: { x: number; y: number };
}

interface GuidelineEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

interface GuidelinesResponse {
  text: string;
  flowchart: {
    nodes: GuidelineNode[];
    edges: GuidelineEdge[];
  };
}

export async function getATLSGuidelines(topic: string, context?: string): Promise<GuidelinesResponse> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an ATLS (Advanced Trauma Life Support) expert. Provide evidence-based guidelines as both text and a decision tree flowchart. Format the response exactly as follows:
{
  "text": "Detailed textual guidelines here...",
  "flowchart": {
    "nodes": [
      {
        "id": "node1",
        "type": "default",
        "data": { "label": "Start Assessment" },
        "position": { "x": 0, "y": 0 }
      },
      // More nodes...
    ],
    "edges": [
      {
        "id": "edge1",
        "source": "node1",
        "target": "node2",
        "label": "Yes/No"
      },
      // More edges...
    ]
  }
}`
        },
        {
          role: "user",
          content: `Provide ATLS guidelines for: ${topic}${context ? `\nAdditional context: ${context}` : ''}`
        }
      ],
      response_format: { type: "json_object" }
    });

    if (!response.choices?.[0]?.message?.content) {
      throw new Error("Invalid response from OpenAI");
    }

    const result = JSON.parse(response.choices[0].message.content);

    // Validate response structure
    if (!result?.text || !result?.flowchart?.nodes || !Array.isArray(result.flowchart.nodes) || !result?.flowchart?.edges || !Array.isArray(result.flowchart.edges)) {
      throw new Error("Invalid guidelines response format");
    }

    // Ensure nodes have required properties
    result.flowchart.nodes = result.flowchart.nodes.map((node: any, index: number) => ({
      ...node,
      id: node.id || `node${index + 1}`,
      type: node.type || 'default',
      position: node.position || { x: index * 150, y: index * 100 },
      data: { label: node.data?.label || `Step ${index + 1}` }
    }));

    // Ensure edges have required properties
    result.flowchart.edges = result.flowchart.edges.map((edge: any, index: number) => ({
      ...edge,
      id: edge.id || `edge${index + 1}`,
      source: edge.source,
      target: edge.target,
      label: edge.label || ''
    }));

    return result;
  } catch (error) {
    console.error("Guidelines error:", error);
    throw new Error("Failed to fetch ATLS guidelines");
  }
}