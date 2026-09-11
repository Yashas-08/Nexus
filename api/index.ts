import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Inline all server routes so Vercel can resolve them at build time
// without needing to cross into ../server/src which is outside api/ scope

const app = express();

// Allow requests from any Vercel deployment URL or localhost
const allowedOrigins = process.env.CLIENT_URL
  ? [process.env.CLIENT_URL, 'http://localhost:5173']
  : ['http://localhost:5173'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.some((o) => origin.startsWith(o)) || origin.endsWith('.vercel.app')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '25mb' }));

// ── Health ──────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'NEXUS backend server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ── Intent Analyze ──────────────────────────────────────────────────────────
// Dynamic imports ensure each heavy dependency is only loaded once
// and avoids top-level import path resolution issues on Vercel builds.
app.post('/api/intent/analyze', async (req, res) => {
  try {
    const { IntentAnalyzeRequestSchema } = await import('../server/src/types/analysis.js');
    const { geminiService } = await import('../server/src/services/geminiService.js');
    const { verificationEngine } = await import('../server/src/services/verificationEngine.js');
    const { contextRouter } = await import('../server/src/services/context/contextRouter.js');

    const validationResult = IntentAnalyzeRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        status: 'error',
        message:
          'Invalid intent payload: ' +
          validationResult.error.errors.map((e: any) => e.message).join(', '),
      });
    }

    const rawAnalysis = await geminiService.analyzeIntent(validationResult.data);
    const externalContext = await contextRouter.routeContext(validationResult.data, rawAnalysis);
    const normalizedAnalysis = verificationEngine.normalize(
      rawAnalysis,
      validationResult.data,
      externalContext
    );

    return res.status(200).json({ status: 'success', data: normalizedAnalysis });
  } catch (err: any) {
    console.error('[POST /api/intent/analyze] Error:', err.message);

    let clientMessage = 'Failed to analyze situation. Please try again.';
    let statusCode = 500;

    if (err.message?.includes('GEMINI_API_KEY')) {
      clientMessage = 'Gemini service is not configured on the server.';
      statusCode = 503;
    } else if (err.message?.includes('quota') || err.message?.includes('rate limit')) {
      clientMessage = 'AI analysis service rate limit reached. Please try again in a few moments.';
      statusCode = 429;
    } else if (err.message?.includes('JSON') || err.message?.includes('schema')) {
      clientMessage = 'AI response validation failed. Please try again.';
      statusCode = 502;
    }

    return res.status(statusCode).json({ status: 'error', message: clientMessage });
  }
});

// ── 404 catch-all ──────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ status: 'error', message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Export as Vercel serverless handler
export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req as any, res as any);
}
