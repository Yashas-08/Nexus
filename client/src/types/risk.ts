import type { EvidenceStatus } from './analysis';

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export type UrgencyLevel = 'ROUTINE' | 'SOON' | 'URGENT' | 'IMMEDIATE';

export type FactorImpact = 'LOW' | 'MEDIUM' | 'HIGH';

export type EvidenceConfidenceLevel = 'CONFIRMED' | 'SUBSTANTIAL' | 'LIMITED' | 'UNCERTAIN';

export interface RiskFactor {
  label: string;
  impact: FactorImpact;
  sourceType?: EvidenceStatus;
  detail?: string;
}

export interface RiskAssessment {
  level: RiskLevel;
  score: number; // 0 to 100 normalized integer
  urgency: UrgencyLevel;
  evidenceConfidence: EvidenceConfidenceLevel;
  factors: RiskFactor[];
  reasoning: string[];
}
