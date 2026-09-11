export type PriorityLevel = 'urgent' | 'high' | 'medium' | 'low';

export type CaseStatus = 'needs_approval' | 'verified' | 'in_progress' | 'resolved';

export type ContextSourceType = 'text' | 'voice' | 'photo' | 'document' | 'location';

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
}

export type NavTab = 'home' | 'cases' | 'profile';
