import { getGeminiClient } from '../lib/gemini.js';
import {
  AnalysisResponseSchema,
  type AnalysisResult,
  type IntentAnalyzeRequest,
} from '../types/analysis.js';

const SYSTEM_INSTRUCTION = `You are the understanding intelligence inside NEXUS, an application that bridges messy human intent and real-world systems.
Your job is solely to UNDERSTAND and STRUCTURE the user's situation based on available evidence, NOT to execute actions or provide conversational chit-chat.

CRITICAL RULES:
1. Distinguish strictly between:
   - FACTS: Directly observed or verified from the input (e.g., photo visibly showing water puddle, document explicitly showing policy number, GPS coordinates provided).
   - USER_REPORTED: Information asserted by the user that is not independently verified by an image or document (e.g., "airline refused to rebook", "leak started 2 hours ago").
   - INFERENCES: Logical deductions derived from available evidence. Must include a confidence score (0 to 1). Never present inference as fact.
   - RISKS: Concrete hazards, deadlines, property damage, financial loss, or safety issues with priority: "low", "medium", "high", or "critical".
   - MISSING_INFORMATION: Important unknowns or missing evidence needed to reach full certainty or resolution.
2. NEVER invent, assume, or hallucinate facts or evidence not present in the inputs.
3. If an image is provided, analyze the visual evidence carefully.
4. If location is provided, note the geographic context accurately.
5. Severity must be one of: "low", "medium", "high", "critical", assigned strictly based on real urgency/harm.
6. Return a valid JSON object matching the requested schema.`;

export class GeminiService {
  private modelName = 'gemini-2.5-flash';

  public async analyzeIntent(request: IntentAnalyzeRequest): Promise<AnalysisResult> {
    const ai = getGeminiClient();

    // Prepare prompt parts
    const parts: any[] = [];

    // Context description for the model
    let contextDescription = `${SYSTEM_INSTRUCTION}\n\n--- INCOMING SITUATION INTENT ---\n`;

    if (request.text.trim()) {
      contextDescription += `User Description:\n"${request.text.trim()}"\n\n`;
    } else {
      contextDescription += `User Description: [No text provided; context provided via attachments]\n\n`;
    }

    if (request.location) {
      contextDescription += `Attached Location Context:\nLatitude: ${request.location.latitude}, Longitude: ${request.location.longitude}`;
      if (request.location.accuracy) {
        contextDescription += ` (Accuracy: ±${request.location.accuracy}m)`;
      }
      if (request.location.label) {
        contextDescription += ` - Label: "${request.location.label}"`;
      }
      contextDescription += '\n\n';
    }

    if (request.documents && request.documents.length > 0) {
      contextDescription += `Attached Document(s):\n`;
      request.documents.forEach((doc, idx) => {
        contextDescription += `Document #${idx + 1} (${doc.name}, type: ${doc.mimeType}):\n`;
        if (doc.textContent) {
          contextDescription += `Content excerpt:\n"""\n${doc.textContent.slice(0, 15000)}\n"""\n\n`;
        } else {
          contextDescription += `(Binary document metadata attached)\n\n`;
        }
      });
    }

    contextDescription += `Analyze all provided modalities and output a structured JSON response matching this structure:
{
  "situation": "<concise summary of the situation>",
  "userIntent": "<what the user is seeking or trying to resolve>",
  "severity": "low" | "medium" | "high" | "critical",
  "confidence": <number between 0 and 1>,
  "facts": [
    { "text": "<verifiable fact>", "source": "text" | "image" | "document" | "location" }
  ],
  "userReported": [
    { "text": "<user asserted claim>", "source": "text" | "image" | "document" }
  ],
  "inferences": [
    { "text": "<deduced insight>", "confidence": <number between 0 and 1> }
  ],
  "risks": [
    { "text": "<potential hazard or complication>", "priority": "low" | "medium" | "high" | "critical" }
  ],
  "missingInformation": [
    "<key unknown or piece of information not yet established>"
  ]
}`;

    parts.push(contextDescription);

    // Add image inlineData if present
    if (request.images && request.images.length > 0) {
      for (const img of request.images) {
        // Strip data URI scheme prefix if client included it
        const cleanBase64 = img.base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
        parts.push({
          inlineData: {
            mimeType: img.mimeType || 'image/jpeg',
            data: cleanBase64,
          },
        });
      }
    }

    try {
      const response = await ai.models.generateContent({
        model: this.modelName,
        contents: parts,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2, // Low temperature for high factual discipline
        },
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error('Gemini returned an empty response.');
      }

      let parsedJson: any;
      try {
        parsedJson = JSON.parse(responseText);
      } catch (jsonErr) {
        console.error('[GeminiService] Failed to parse JSON response:', responseText);
        throw new Error('Gemini response could not be parsed as valid JSON.');
      }

      // Validate with Zod schema
      const validated = AnalysisResponseSchema.safeParse(parsedJson);
      if (!validated.success) {
        console.error(
          '[GeminiService] Response schema validation failed:',
          validated.error.format()
        );
        throw new Error(
          'Gemini response format did not match the expected NEXUS schema: ' +
            validated.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
        );
      }

      return validated.data;
    } catch (err: any) {
      console.error('[GeminiService] Analysis failed:', err?.message || err);
      // Re-throw with clean user-safe error
      throw new Error(err?.message || 'Failed to analyze situation with Gemini.');
    }
  }
}

export const geminiService = new GeminiService();
