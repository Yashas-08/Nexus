import type { CaseRecord } from '../types/cases';
import type { NormalizedAnalysis, ExternalContextItem } from '../types/analysis';
import type { RecommendedAction } from '../types/actions';

// Known valid enum values
const VALID_RISK_LEVELS = new Set(['LOW', 'MODERATE', 'HIGH', 'CRITICAL']);
const VALID_URGENCIES = new Set(['ROUTINE', 'SOON', 'URGENT', 'IMMEDIATE']);

/** Safely parse a JSON string; returns fallback on failure. */
function tryParseJson<T>(raw: unknown, fallback: T): T {
  if (raw && typeof raw === 'object') return raw as T;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as T; } catch { /* fall through */ }
  }
  return fallback;
}

/** Ensure a value is an array, returning [] otherwise. */
const ensureArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/**
 * Validates and sanitizes a CaseRecord from arbitrary database JSON.
 * Guarantees that malformed or legacy structures do not throw runtime exceptions.
 */
export function validateAndSanitizeCase(raw: any): CaseRecord | null {
  if (!raw || typeof raw !== 'object') return null;

  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id : `case-${Date.now()}`;
  const userId = (raw.userId || raw.user_id || 'anonymous') as string;
  const title = (raw.title?.trim() || 'Saved Situation') as string;
  const situation = (typeof raw.situation === 'string' ? raw.situation : '') as string;
  const intent = (typeof raw.intent === 'string' ? raw.intent : '') as string;

  const riskLevelRaw = raw.riskLevel || raw.risk_level;
  const riskLevel = VALID_RISK_LEVELS.has(riskLevelRaw) ? riskLevelRaw : 'LOW';

  const urgency = VALID_URGENCIES.has(raw.urgency) ? raw.urgency : 'ROUTINE';

  const rawAnalysis = tryParseJson<any>(raw.analysis, {});

  const analysis: NormalizedAnalysis = {
    situation: rawAnalysis.situation || situation,
    userIntent: rawAnalysis.userIntent || intent,
    severity: rawAnalysis.severity || 'low',
    confidence: typeof rawAnalysis.confidence === 'number' ? rawAnalysis.confidence : 0.8,
    facts: ensureArray(rawAnalysis.facts),
    userReported: ensureArray(rawAnalysis.userReported),
    inferences: ensureArray(rawAnalysis.inferences),
    risks: ensureArray(rawAnalysis.risks),
    missingInformation: ensureArray(rawAnalysis.missingInformation),
    evidence: ensureArray(rawAnalysis.evidence),
    conflicts: ensureArray(rawAnalysis.conflicts),
    verificationSummary: rawAnalysis.verificationSummary ?? {
      verifiedCount: 0,
      userReportedCount: 0,
      inferredCount: 0,
      unknownCount: 0,
      totalEvidenceCount: 0,
      verificationScore: 0,
    },
    externalContext: Array.isArray(rawAnalysis.externalContext)
      ? rawAnalysis.externalContext
      : undefined,
  };

  const externalContext = ensureArray<ExternalContextItem>(
    tryParseJson(raw.externalContext ?? raw.external_context, [])
  );

  const actions: RecommendedAction[] = ensureArray<any>(
    tryParseJson(raw.actions, [])
  ).map((act: any, idx: number) => ({
    id: typeof act.id === 'string' ? act.id : `act-${idx}`,
    title: typeof act.title === 'string' ? act.title : 'Recommended Step',
    description: typeof act.description === 'string' ? act.description : '',
    priority: act.priority || 'MEDIUM',
    category: act.category || 'SAFETY',
    rationale: typeof act.rationale === 'string' ? act.rationale : '',
    requiresApproval: Boolean(act.requiresApproval),
    status: act.status || 'RECOMMENDED',
  }));

  const createdAt = raw.createdAt || raw.created_at || new Date().toISOString();
  const updatedAt = raw.updatedAt || raw.updated_at || createdAt;

  return { id, userId, title, situation, intent, riskLevel, urgency, analysis, externalContext, actions, createdAt, updatedAt };
}

const HAZARD_PATTERN =
  /\b(flooding|burst pipe|gas leak|fire|sparking wire|power outage|broken glass|tree fall|downed wire|blackout|water leak|mold|chemical spill|ceiling collapse)\b/i;
const LOCATION_PATTERN =
  /\b(basement|kitchen|bathroom|roof|driveway|street|road|sidewalk|apartment|hallway|bedroom|office)\b/i;

/**
 * Generates a human-readable title from situation text and analysis facts.
 * Never produces generic placeholders like "Case #123" or "AI Analysis".
 */
export function generateCaseTitle(situation: string, facts?: Array<{ text: string }>): string {
  const corpus = [situation, ...(facts ?? []).map((f) => f.text)].join(' ');
  const clean = corpus.replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return 'Situation Assessment';

  const hazardMatch = clean.match(HAZARD_PATTERN);
  if (hazardMatch) {
    const hazard = hazardMatch[0][0].toUpperCase() + hazardMatch[0].slice(1).toLowerCase();
    const locMatch = clean.match(LOCATION_PATTERN);
    if (locMatch) {
      return `${hazard} in ${locMatch[0][0].toUpperCase()}${locMatch[0].slice(1).toLowerCase()}`;
    }
    return `${hazard} Reported`;
  }

  const words = clean.split(/[.!?]/)[0].trim().split(' ').slice(0, 5).join(' ');
  if (words.length > 5) {
    return words[0].toUpperCase() + words.slice(1);
  }

  return 'Situation Assessment';
}
