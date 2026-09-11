import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { IntentAnalyzeRequestSchema } from '../server/src/types/analysis.js';
import { geminiService } from '../server/src/services/geminiService.js';
import { verificationEngine } from '../server/src/services/verificationEngine.js';
import { contextRouter } from '../server/src/services/context/contextRouter.js';

const app = express();

app.use(
  cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      const allowed =
        !origin ||
        origin.startsWith('http://localhost') ||
        origin.endsWith('.vercel.app') ||
        Boolean(process.env.CLIENT_URL && origin === process.env.CLIENT_URL);
      callback(null, allowed);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '25mb' }));

// ── Health ──────────────────────────────────────────────────────────────────
app.get(['/', '/api', '/api/health', '/health'], (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'NEXUS backend is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ── Intent Analyze ──────────────────────────────────────────────────────────
app.post(['/api/intent/analyze', '/intent/analyze'], async (req: Request, res: Response) => {
  const validation = IntentAnalyzeRequestSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid request: ' + validation.error.errors.map((e) => e.message).join(', '),
    });
  }

  try {
    const rawAnalysis = await geminiService.analyzeIntent(validation.data);
    const externalContext = await contextRouter.routeContext(validation.data, rawAnalysis);
    const normalized = verificationEngine.normalize(rawAnalysis, validation.data, externalContext);
    return res.status(200).json({ status: 'success', data: normalized });
  } catch (err: any) {
    console.error('[POST /api/intent/analyze]', err?.message);

    const msg = String(err?.message ?? '');
    if (msg.includes('GEMINI_API_KEY'))
      return res.status(503).json({ status: 'error', message: 'Gemini service is not configured.' });
    if (msg.includes('quota') || msg.includes('rate limit'))
      return res.status(429).json({ status: 'error', message: 'Rate limit reached. Please try again shortly.' });
    if (msg.includes('JSON') || msg.includes('schema'))
      return res.status(502).json({ status: 'error', message: 'AI response validation failed. Please try again.' });

    return res.status(500).json({ status: 'error', message: 'Failed to analyze situation. Please try again.' });
  }
});

// ── 404 catch-all ──────────────────────────────────────────────────────────
app.use((req: Request, res: Response) => {
  res.status(404).json({ status: 'error', message: `Not found: ${req.method} ${req.originalUrl || req.url}` });
});

// ── Error-handling middleware ──────────────────────────────────────────────
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Unhandled API Error]', err?.message ?? err);
  res.status(500).json({ status: 'error', message: 'Internal server error' });
});

export { app };

export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req as any, res as any);
}
