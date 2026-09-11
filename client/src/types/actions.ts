export type ActionPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ActionCategory =
  | 'SAFETY'
  | 'CONTACT'
  | 'INFORMATION'
  | 'DOCUMENT'
  | 'NAVIGATION'
  | 'FOLLOW_UP';

export type ActionStatus = 'RECOMMENDED' | 'APPROVED' | 'DISMISSED' | 'COMPLETED';

export interface RecommendedAction {
  id: string;
  title: string;
  description: string;
  priority: ActionPriority;
  category: ActionCategory;
  rationale: string;
  requiresApproval: boolean;
  status: ActionStatus;
}

export interface ActionGraph {
  actions: RecommendedAction[];
  primaryActionId?: string;
  stageSummary: {
    hasSafetyAction: boolean;
    hasContactAction: boolean;
    hasInformationAction: boolean;
    hasFollowUpAction: boolean;
  };
}
