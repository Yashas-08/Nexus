import { Router, Request, Response } from 'express';
import { IntentAnalyzeRequestSchema } from '../types/analysis.js';
import { geminiService } from '../services/geminiService.js';

const router = Router();

router.post('/analyze', async (req: Request, res: Response) => {
  try {
    // 1. Validate request payload with Zod
    const validationResult = IntentAnalyzeRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid intent payload: ' + validationResult.error.errors.map((e) => e.message).join(', '),
      });
    }

    // 2. Call Gemini multimodal service
    const analysis = await geminiService.analyzeIntent(validationResult.data);

    // 3. Return validated structured result
    return res.status(200).json({
      status: 'success',
      data: analysis,
    });
  } catch (err: any) {
    console.error('[POST /api/intent/analyze] Error:', err.message);

    // Safe error message to avoid exposing secrets
    let clientMessage = 'Failed to analyze situation. Please try again.';
    let statusCode = 500;

    if (err.message.includes('GEMINI_API_KEY')) {
      clientMessage = 'Gemini service is not configured on the server.';
      statusCode = 503;
    } else if (err.message.includes('quota') || err.message.includes('rate limit')) {
      clientMessage = 'AI analysis service rate limit reached. Please try again in a few moments.';
      statusCode = 429;
    } else if (err.message.includes('JSON') || err.message.includes('schema')) {
      clientMessage = 'AI response validation failed. Please try again.';
      statusCode = 502;
    }

    return res.status(statusCode).json({
      status: 'error',
      message: clientMessage,
    });
  }
});

export default router;
