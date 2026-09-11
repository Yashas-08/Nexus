import type { ExternalContextItem } from '../../types/analysis.js';
import { getGeminiClient } from '../../lib/gemini.js';

export class WebContextService {
  private timeoutMs = 4000;

  /**
   * Retrieves relevant public advisories, official notices, or civic policies
   * using Gemini search grounding when public verification is required.
   */
  public async fetchPublicAdvisories(
    topicQuery: string,
    locationName?: string
  ): Promise<ExternalContextItem | null> {
    const ai = getGeminiClient();
    if (!ai) return null;

    try {
      const locationClause = locationName ? ` in or near ${locationName}` : '';
      const prompt = `Provide current official public advisories, civic announcements, or emergency guidance for: "${topicQuery}"${locationClause}. Keep the response factual, concise, and focused on official civic policy or public safety alerts. Limit to 2 concise sentences.`;

      // Use gemini-2.5-flash with search tool
      const response = await Promise.race([
        ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            temperature: 0.1,
            // Search tool integration where available
            tools: [{ googleSearch: {} }],
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Web context timeout')), this.timeoutMs)
        ),
      ]);

      const text = response.text?.trim();
      if (!text || text.length < 15) return null;

      return {
        id: `ctx-web-${Date.now()}`,
        source: 'WEB',
        title: 'Public Civic Advisory & Regulatory Context',
        summary: text,
        retrievedAt: new Date().toISOString(),
        relevance: 'MEDIUM',
        verificationStatus: 'CONTEXT_ONLY',
        sourceReference: 'Official Public & Civic Information Index',
      };
    } catch (err) {
      // Graceful fallback if search tool or API is unavailable
      return null;
    }
  }
}

export const webContextService = new WebContextService();
