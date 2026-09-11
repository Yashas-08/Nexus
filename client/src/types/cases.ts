import type { NormalizedAnalysis, ExternalContextItem } from './analysis';
import type { RiskLevel, UrgencyLevel } from './risk';
import type { RecommendedAction } from './actions';

export type PriorityLevel = 'urgent' | 'high' | 'medium' | 'low';
export type CaseStatus = 'needs_approval' | 'verified' | 'in_progress' | 'resolved';
export type ContextSourceType = 'text' | 'voice' | 'photo' | 'document' | 'location';

/**
 * Persisted Case domain model representing a saved NEXUS situation.
 */
export interface CaseRecord {
  id: string;
  userId: string;
  title: string;
  situation: string;
  intent: string;
  riskLevel: RiskLevel;
  urgency: UrgencyLevel;
  analysis: NormalizedAnalysis;
  externalContext?: ExternalContextItem[];
  actions: RecommendedAction[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Lightweight case item summary used for listing and cards.
 */
export interface CaseItem {
  id: string;
  title: string;
  situationType: string;
  priority: PriorityLevel;
  status: CaseStatus;
  summary: string;
  updatedAt: string;
  contextSources: ContextSourceType[];
  locationHint?: string;
  actionRequired?: string;
  // Reference to original case record when available
  rawRecord?: CaseRecord;
}

export type NavTab = 'home' | 'cases' | 'profile';

/**
 * Maps database row (snake_case) to CaseRecord (camelCase)
 */
export function mapDatabaseRowToCase(row: any): CaseRecord {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title || 'Untitled Situation',
    situation: row.situation || '',
    intent: row.intent || '',
    riskLevel: row.risk_level || 'LOW',
    urgency: row.urgency || 'ROUTINE',
    analysis: typeof row.analysis === 'string' ? JSON.parse(row.analysis) : (row.analysis || {}),
    externalContext: typeof row.external_context === 'string'
      ? JSON.parse(row.external_context)
      : (row.external_context || []),
    actions: typeof row.actions === 'string' ? JSON.parse(row.actions) : (row.actions || []),
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  };
}

/**
 * Converts a CaseRecord into a CaseItem for list rendering
 */
export function mapCaseRecordToCaseItem(record: CaseRecord): CaseItem {
  // Determine priority
  let priority: PriorityLevel = 'low';
  if (record.riskLevel === 'CRITICAL') priority = 'urgent';
  else if (record.riskLevel === 'HIGH') priority = 'high';
  else if (record.riskLevel === 'MODERATE') priority = 'medium';

  // Determine status
  const pendingActions = record.actions.filter((a) => a.requiresApproval && a.status !== 'APPROVED');
  const hasApprovedActions = record.actions.some((a) => a.status === 'APPROVED');
  
  let status: CaseStatus = 'in_progress';
  if (pendingActions.length > 0) {
    status = 'needs_approval';
  } else if (hasApprovedActions) {
    status = 'in_progress';
  } else if (record.analysis.verificationSummary?.verificationScore && record.analysis.verificationSummary.verificationScore > 0.5) {
    status = 'verified';
  }

  // Derive context sources
  const sources: ContextSourceType[] = ['text'];
  if (record.analysis.evidence?.some((e) => e.source === 'image')) sources.push('photo');
  if (record.analysis.evidence?.some((e) => e.source === 'document')) sources.push('document');
  if (record.analysis.evidence?.some((e) => e.source === 'location')) sources.push('location');

  // Relative time format
  const dateObj = new Date(record.updatedAt || record.createdAt);
  const now = new Date();
  const diffHours = Math.round((now.getTime() - dateObj.getTime()) / (1000 * 60 * 60));
  let updatedAtStr = 'Just now';
  if (diffHours >= 24) {
    const diffDays = Math.round(diffHours / 24);
    updatedAtStr = diffDays === 1 ? 'Yesterday' : `${diffDays}d ago`;
  } else if (diffHours >= 1) {
    updatedAtStr = `${diffHours}h ago`;
  }

  const primaryPending = pendingActions[0];

  return {
    id: record.id,
    title: record.title,
    situationType: record.riskLevel === 'CRITICAL' || record.riskLevel === 'HIGH' ? 'Safety & Hazard' : 'Community & Service',
    priority,
    status,
    summary: record.situation,
    updatedAt: updatedAtStr,
    contextSources: sources,
    actionRequired: primaryPending ? primaryPending.title : undefined,
    rawRecord: record,
  };
}
