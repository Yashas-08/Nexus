export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

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
