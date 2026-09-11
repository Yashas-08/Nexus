import { GoogleGenAI } from '@google/genai';

let cachedClient: GoogleGenAI | null = null;

// Server-side Gemini client factory. Never expose this client or GEMINI_API_KEY to frontend.
export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({ apiKey });
  }
  return cachedClient;
}
