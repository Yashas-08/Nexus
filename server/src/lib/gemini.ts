import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;

// Base server configuration prepared for future Gemini integrations.
// Never expose this client or GEMINI_API_KEY to frontend/client.
export const geminiClient = apiKey ? new GoogleGenAI({ apiKey }) : null;

export function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return geminiClient;
}
