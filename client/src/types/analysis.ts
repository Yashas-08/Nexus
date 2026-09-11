export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

export type EvidenceStatus = 'VERIFIED' | 'USER_REPORTED' | 'INFERRED' | 'UNKNOWN';

export type EvidenceSource = 'text' | 'image' | 'document' | 'location' | 'system';

export interface EvidenceItem {
  id: string;
  text: string;
  status: EvidenceStatus;
  source: EvidenceSource;
  confidence?: number | null;
  verifiedBy?: string | null;
  notes?: string | null;
}

export interface EvidenceConflict {
  description: string;
  competingClaims: string[];
  resolution: string;
}

export interface VerificationSummary {
  verifiedCount: number;
  userReportedCount: number;
  inferredCount: number;
  unknownCount: number;
  totalEvidenceCount: number;
  verificationScore: number;
}

export interface AnalysisFact {
  text: string;
  source: 'text' | 'image' | 'document' | 'location';
}

export interface AnalysisUserReported {
  text: string;
  source: 'text' | 'image' | 'document';
}

export interface AnalysisInference {
  text: string;
  confidence: number;
}

export interface AnalysisRisk {
  text: string;
  priority: SeverityLevel;
}

export interface AnalysisResult {
  situation: string;
  userIntent: string;
  severity: SeverityLevel;
  confidence: number;
  facts: AnalysisFact[];
  userReported: AnalysisUserReported[];
  inferences: AnalysisInference[];
  risks: AnalysisRisk[];
  missingInformation: string[];
}

export interface ExternalContextItem {
  id: string;
  source: 'WEB' | 'MAP' | 'WEATHER';
  title: string;
  summary: string;
  retrievedAt: string;
  relevance: 'LOW' | 'MEDIUM' | 'HIGH';
  verificationStatus: 'VERIFIED' | 'CONTEXT_ONLY' | 'UNAVAILABLE';
  sourceReference?: string;
}

export interface NormalizedAnalysis extends AnalysisResult {
  evidence: EvidenceItem[];
  conflicts: EvidenceConflict[];
  verificationSummary: VerificationSummary;
  externalContext?: ExternalContextItem[];
}
