import type { CaseRecord } from '../types/cases';
import type { NormalizedAnalysis } from '../types/analysis';
import type { RecommendedAction } from '../types/actions';

/**
 * Validates and sanitizes a CaseRecord from arbitrary database JSON.
 * Guarantees that malformed or legacy structures do not throw runtime exceptions.
 */
export function validateAndSanitizeCase(raw: any): CaseRecord | null {
  if (!raw || typeof raw !== 'object') return null;

  const id = typeof raw.id === 'string' && raw.id.trim().length > 0 ? raw.id : `case-${Date.now()}`;
  const userId = typeof raw.userId === 'string' ? raw.userId : (raw.user_id || 'anonymous');
  const title = typeof raw.title === 'string' && raw.title.trim().length > 0 ? raw.title.trim() : 'Saved Situation';
  const situation = typeof raw.situation === 'string' ? raw.situation : '';
  const intent = typeof raw.intent === 'string' ? raw.intent : '';
  
  const riskLevel = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'].includes(raw.riskLevel || raw.risk_level)
    ? (raw.riskLevel || raw.risk_level)
    : 'LOW';

  const urgency = ['ROUTINE', 'SOON', 'URGENT', 'IMMEDIATE'].includes(raw.urgency)
    ? raw.urgency
    : 'ROUTINE';

  let rawAnalysis = raw.analysis;
  if (typeof rawAnalysis === 'string') {
    try {
      rawAnalysis = JSON.parse(rawAnalysis);
    } catch {
      rawAnalysis = {};
    }
  }
  rawAnalysis = rawAnalysis && typeof rawAnalysis === 'object' ? rawAnalysis : {};

  const analysis: NormalizedAnalysis = {
    situation: rawAnalysis.situation || situation,
    userIntent: rawAnalysis.userIntent || intent,
    severity: rawAnalysis.severity || 'low',
    confidence: typeof rawAnalysis.confidence === 'number' ? rawAnalysis.confidence : 0.8,
    facts: Array.isArray(rawAnalysis.facts) ? rawAnalysis.facts : [],
    userReported: Array.isArray(rawAnalysis.userReported) ? rawAnalysis.userReported : [],
    inferences: Array.isArray(rawAnalysis.inferences) ? rawAnalysis.inferences : [],
    risks: Array.isArray(rawAnalysis.risks) ? rawAnalysis.risks : [],
    missingInformation: Array.isArray(rawAnalysis.missingInformation) ? rawAnalysis.missingInformation : [],
    evidence: Array.isArray(rawAnalysis.evidence) ? rawAnalysis.evidence : [],
    conflicts: Array.isArray(rawAnalysis.conflicts) ? rawAnalysis.conflicts : [],
    verificationSummary: rawAnalysis.verificationSummary || {
      verifiedCount: 0,
      userReportedCount: 0,
      inferredCount: 0,
      unknownCount: 0,
      totalEvidenceCount: 0,
      verificationScore: 0,
    },
    externalContext: Array.isArray(rawAnalysis.externalContext) ? rawAnalysis.externalContext : undefined,
  };

  let rawExt = raw.externalContext || raw.external_context;
  if (typeof rawExt === 'string') {
    try {
      rawExt = JSON.parse(rawExt);
    } catch {
      rawExt = [];
    }
  }
  const externalContext = Array.isArray(rawExt) ? rawExt : [];

  let rawActions = raw.actions;
  if (typeof rawActions === 'string') {
    try {
      rawActions = JSON.parse(rawActions);
    } catch {
      rawActions = [];
    }
  }
  const actions: RecommendedAction[] = Array.isArray(rawActions)
    ? rawActions.map((act: any, idx: number) => ({
        id: typeof act.id === 'string' ? act.id : `act-${idx}`,
        title: typeof act.title === 'string' ? act.title : 'Recommended Step',
        description: typeof act.description === 'string' ? act.description : '',
        priority: act.priority || 'MEDIUM',
        category: act.category || 'SAFETY',
        rationale: typeof act.rationale === 'string' ? act.rationale : '',
        requiresApproval: Boolean(act.requiresApproval),
        status: act.status || 'RECOMMENDED',
      }))
    : [];

  const createdAt = raw.createdAt || raw.created_at || new Date().toISOString();
  const updatedAt = raw.updatedAt || raw.updated_at || createdAt;

  return {
    id,
    userId,
    title,
    situation,
    intent,
    riskLevel,
    urgency,
    analysis,
    externalContext,
    actions,
    createdAt,
    updatedAt,
  };
}

/**
 * Generates an informative, human-readable title from situation text and analysis facts.
 * Never produces generic placeholders like "Case #123" or "AI Analysis".
 */
export function generateCaseTitle(situation: string, facts?: Array<{ text: string }>): string {
  const combinedContext = [
    situation,
    ...(facts || []).map((f) => f.text),
  ].join(' ');

  const cleanSituation = combinedContext.replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleanSituation) return 'Situation Assessment';

  // Check for distinct hazard patterns first
  const match = cleanSituation.match(
    /\b(flooding|burst pipe|gas leak|fire|sparking wire|power outage|broken glass|tree fall|downed wire|blackout|water leak|mold|chemical spill|ceiling collapse)\b/i
  );
  if (match) {
    const hazard = match[0].charAt(0).toUpperCase() + match[0].slice(1).toLowerCase();
    // Look for location keywords
    const locMatch = cleanSituation.match(/\b(basement|kitchen|bathroom|roof|driveway|street|road|sidewalk|apartment|hallway|bedroom|office)\b/i);
    if (locMatch) {
      const loc = locMatch[0].charAt(0).toUpperCase() + locMatch[0].slice(1).toLowerCase();
      return `${hazard} in ${loc}`;
    }
    return `${hazard} Reported`;
  }

  // Fallback to first clause of situation
  const firstSentence = cleanSituation.split(/[.!?]/)[0].trim();
  const words = firstSentence.split(' ').slice(0, 5).join(' ');
  if (words.length > 5) {
    return words.charAt(0).toUpperCase() + words.slice(1);
  }

  return 'Situation Assessment';
}
