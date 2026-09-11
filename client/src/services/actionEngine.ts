import type { NormalizedAnalysis } from '../types/analysis';
import type { RiskAssessment } from '../types/risk';
import type {
  ActionGraph,
  RecommendedAction,
  ActionCategory,
  ActionPriority,
} from '../types/actions';

interface ActionBlueprint {
  id: string;
  category: ActionCategory;
  priority: ActionPriority;
  title: string;
  description: string;
  rationale: string;
  requiresApproval: boolean;
  matchPatterns: RegExp[];
  condition?: (analysis: Partial<NormalizedAnalysis>, risk?: RiskAssessment) => boolean;
}

const ACTION_BLUEPRINTS: ActionBlueprint[] = [
  // --- 1. IMMEDIATE SAFETY (Strictly First) ---
  {
    id: 'safety-trapped-rescue',
    category: 'SAFETY',
    priority: 'CRITICAL',
    title: 'Signal location and maintain immediate personal safety',
    description: 'If trapped or stranded, signal your location, conserve phone battery, and remain in the safest accessible area away from rising water or hazards.',
    rationale: 'Occupants reported trapped or unable to escape require immediate location signaling.',
    requiresApproval: false,
    matchPatterns: [/\b(trapped|stranded|confined|cannot (get out|escape|exit)|cut off by water)\b/i],
  },
  {
    id: 'safety-evacuate-fire',
    category: 'SAFETY',
    priority: 'CRITICAL',
    title: 'Evacuate premises and maintain exterior perimeter',
    description: 'Evacuate all occupants immediately through the safest clear exit. Do not re-enter the building for personal belongings.',
    rationale: 'Active combustion, fire, or heavy smoke presents immediate asphyxiation and thermal danger.',
    requiresApproval: false,
    matchPatterns: [/\b(fire|open flame|smoke billowing|burning|blaze|ignited)\b/i],
  },
  {
    id: 'safety-electrical-clearance',
    category: 'SAFETY',
    priority: 'HIGH',
    title: 'Maintain safe distance from live electrical lines',
    description: 'Keep all individuals and vehicles at least 10 meters (33 feet) away from downed wires, sparking equipment, and standing water in contact with electrical feeds.',
    rationale: 'Live electrical conductors and sparking wires present severe electrocution hazards.',
    requiresApproval: false,
    matchPatterns: [/\b(sparking|live wire|downed power line|high voltage|electric shock|breaker.*spark)\b/i],
  },
  {
    id: 'safety-gas-leak-ventilation',
    category: 'SAFETY',
    priority: 'HIGH',
    title: 'Avoid electrical switches and evacuate gas odor area',
    description: 'Do not operate light switches, phones, or appliances. Extinguish any open flames, open windows if safely reachable while leaving, and evacuate to fresh air.',
    rationale: 'Natural gas or toxic chemical vapors can ignite from minor electrical sparks or cause acute inhalation poisoning.',
    requiresApproval: false,
    matchPatterns: [/\b(gas leak|smell(ing)? gas|natural gas|toxic fume|chemical spill)\b/i],
  },
  {
    id: 'safety-isolate-water-main',
    category: 'SAFETY',
    priority: 'HIGH',
    title: 'Isolate main water supply valve',
    description: 'Locate and turn off the main water shutoff valve immediately to stop active flooding. Avoid entering flooded rooms where electrical outlets are submerged.',
    rationale: 'Rapid water inundation causes progressive structural damage and potential electrical short-circuiting.',
    requiresApproval: false,
    matchPatterns: [/\b(pipe burst|burst pipe|flooding|water main burst|water level rising|gushing water)\b/i],
  },
  {
    id: 'safety-structural-clearance',
    category: 'SAFETY',
    priority: 'HIGH',
    title: 'Clear area beneath compromised structural elements',
    description: 'Vacate rooms with cracked, sagging, or collapsing ceilings or walls. Do not walk directly beneath damaged overhead structures.',
    rationale: 'Compromised building integrity presents falling debris and structural collapse risks.',
    requiresApproval: false,
    matchPatterns: [/\b(collapse|collapsed|cave-in|ceiling falling|wall buckling|cracked foundation)\b/i],
  },
  {
    id: 'safety-severe-weather-hazard',
    category: 'SAFETY',
    priority: 'HIGH',
    title: 'Avoid low-lying roadways and seek elevated shelter',
    description: 'Meteorological telemetry or local reports indicate severe precipitation or storm conditions. Avoid driving or walking through moving water.',
    rationale: 'External weather telemetry corroborates heightened environmental and flash flood hazards.',
    requiresApproval: false,
    matchPatterns: [/\b(storm|heavy rain|downpour|flash flood|severe weather)\b/i],
    condition: (analysis) =>
      Boolean(
        analysis.externalContext?.some(
          (c) => c.source === 'WEATHER' && c.relevance === 'HIGH'
        )
      ),
  },

  // --- 2. GET HELP / CONTACT DISPATCH (Second) ---
  {
    id: 'contact-emergency-services',
    category: 'CONTACT',
    priority: 'CRITICAL',
    title: 'Contact emergency response authorities',
    description: 'Place an emergency call to local emergency authorities (police/fire/ambulance) to report immediate life safety or active hazardous conditions.',
    rationale: 'Potential immediate physical threat or severe uncontained hazard requires municipal emergency response.',
    requiresApproval: true,
    matchPatterns: [
      /\b(trapped|stranded|life[ -]?threat|fatal|unresponsive|drowning|suffocat|fire|gas leak|active flame)\b/i,
    ],
    condition: (_, risk) => risk?.level === 'CRITICAL' || risk?.level === 'HIGH',
  },
  {
    id: 'contact-utility-emergency-dispatch',
    category: 'CONTACT',
    priority: 'HIGH',
    title: 'Contact utility emergency service dispatch',
    description: 'Notify the municipal power or water utility emergency hotline to dispatch technical crews to isolate exterior service lines.',
    rationale: 'External infrastructure or utility disruption requires authorized utility provider intervention.',
    requiresApproval: true,
    matchPatterns: [
      /\b(power line down|downed power line|high voltage|water main burst|blackout|gas leak|utility failure)\b/i,
    ],
  },
  {
    id: 'contact-property-maintenance',
    category: 'CONTACT',
    priority: 'MEDIUM',
    title: 'Notify property manager or emergency plumber',
    description: 'Alert the building maintenance desk or licensed plumbing professional with details of the pipe rupture and current valve status.',
    rationale: 'Physical facility failure requires professional on-site mechanical remediation.',
    requiresApproval: true,
    matchPatterns: [/\b(pipe burst|burst pipe|leaking|valve stuck|sewage back|flooding kitchen|water damage)\b/i],
  },
  {
    id: 'contact-routine-service-desk',
    category: 'CONTACT',
    priority: 'LOW',
    title: 'Contact organization service desk during operating hours',
    description: 'Reach out to the administration desk or customer service via official channels to submit your request or inquiry.',
    rationale: 'Routine administrative matters are resolved through standard operating procedures.',
    requiresApproval: true,
    matchPatterns: [/\b(schedule|appointment|renewal|hours|reservation|fee|bill|account|library)\b/i],
    condition: (_, risk) => risk?.level === 'LOW' || risk?.urgency === 'ROUTINE',
  },

  // --- 3. COLLECT MISSING INFORMATION (Third) ---
  {
    id: 'info-check-occupant-status',
    category: 'INFORMATION',
    priority: 'HIGH',
    title: 'Confirm whether anyone is currently trapped or injured',
    description: 'Verify the status and exact location of all building occupants or affected individuals to report accurate counts to responders.',
    rationale: 'Incomplete information regarding human occupants impedes appropriate emergency triage.',
    requiresApproval: false,
    matchPatterns: [/\b(occupant|injur|trapped|unaccounted|person|elderly|child)\b/i],
    condition: (analysis) =>
      Boolean(analysis.missingInformation?.some((m) => /occupant|injur|trapped|people|person/i.test(m))),
  },
  {
    id: 'info-verify-utility-valve',
    category: 'INFORMATION',
    priority: 'MEDIUM',
    title: 'Locate utility shutoff valve and verify status',
    description: 'Check whether the local isolation valve or main breaker switch can be safely accessed without stepping into standing water or hazard zones.',
    rationale: 'Uncertain valve accessibility affects whether immediate interior mitigation is feasible.',
    requiresApproval: false,
    matchPatterns: [/\b(valve|breaker|meter|shutoff|switch)\b/i],
    condition: (analysis) =>
      Boolean(analysis.missingInformation?.some((m) => /valve|breaker|shutoff|isolate/i.test(m))),
  },

  // --- 4. DOCUMENT EVIDENCE (Fourth) ---
  {
    id: 'doc-record-property-damage',
    category: 'DOCUMENT',
    priority: 'MEDIUM',
    title: 'Record time-stamped photographs of damage',
    description: 'Take clear photos and video of water levels, structural damage, and affected equipment before beginning cleanup or repair.',
    rationale: 'Objective visual records are necessary for insurance claims, landlord disputes, and repair estimates.',
    requiresApproval: false,
    matchPatterns: [/\b(damage|flood|leak|burst|cracked|ruined|soaked|spoilage)\b/i],
  },

  // --- 5. FOLLOW UP & MONITORING (Fifth) ---
  {
    id: 'followup-monitor-containment',
    category: 'FOLLOW_UP',
    priority: 'LOW',
    title: 'Monitor area for secondary leakage or moisture spread',
    description: 'Periodically inspect adjacent walls, subfloors, and ceilings for secondary water migration or structural settling once the primary leak is halted.',
    rationale: 'Trapped moisture can cause delayed mold growth and hidden electrical corrosion.',
    requiresApproval: false,
    matchPatterns: [/\b(leak|flood|burst|water damage)\b/i],
  },
  {
    id: 'followup-confirm-ticket',
    category: 'FOLLOW_UP',
    priority: 'LOW',
    title: 'Retain inquiry reference and confirmation details',
    description: 'Keep a copy of all confirmation numbers, sent correspondence, and scheduled appointment times.',
    rationale: 'Ensures clear tracking for administrative follow-up.',
    requiresApproval: false,
    matchPatterns: [/\b(schedule|appointment|renewal|ticket|reservation)\b/i],
    condition: (_, risk) => risk?.level === 'LOW',
  },
];

const CATEGORY_ORDER: Record<ActionCategory, number> = {
  SAFETY: 1,
  CONTACT: 2,
  INFORMATION: 3,
  DOCUMENT: 4,
  NAVIGATION: 5,
  FOLLOW_UP: 6,
};

const PRIORITY_ORDER: Record<ActionPriority, number> = {
  CRITICAL: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
};

/**
 * Normalizes text to assist in matching.
 */
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, ' ').trim();
}

/**
 * Pure deterministic Action Policy Engine.
 * Converts situation analysis, verified evidence, and risk results into an ordered Action Graph.
 */
export function generateActionGraph(
  analysis: Partial<NormalizedAnalysis> | null | undefined,
  risk: RiskAssessment | null | undefined
): ActionGraph {
  if (!analysis) {
    return {
      actions: [],
      stageSummary: {
        hasSafetyAction: false,
        hasContactAction: false,
        hasInformationAction: false,
        hasFollowUpAction: false,
      },
    };
  }

  // Aggregate all narrative signals
  const searchCorpus = [
    analysis.situation || '',
    analysis.userIntent || '',
    ...(analysis.userReported || []).map((u) => u.text),
    ...(analysis.facts || []).map((f) => f.text),
    ...(analysis.risks || []).map((r) => r.text),
    ...(analysis.evidence || []).map((e) => e.text),
    ...(analysis.missingInformation || []),
  ]
    .map(normalizeText)
    .join(' ');

  const actions: RecommendedAction[] = [];
  const includedActionIds = new Set<string>();

  // 1. Evaluate Blueprints against context
  for (const blueprint of ACTION_BLUEPRINTS) {
    if (includedActionIds.has(blueprint.id)) continue;

    // Check pattern match
    let matchesPattern = blueprint.matchPatterns.some((pattern) => pattern.test(searchCorpus));

    // Optional condition check
    if (blueprint.condition && !blueprint.condition(analysis, risk ?? undefined)) {
      matchesPattern = false;
    }

    if (matchesPattern) {
      includedActionIds.add(blueprint.id);

      // Inherit priority from risk level if appropriate
      let effectivePriority = blueprint.priority;
      if (risk?.level === 'CRITICAL' && blueprint.category === 'SAFETY') {
        effectivePriority = 'CRITICAL';
      } else if (risk?.level === 'LOW' && effectivePriority !== 'LOW' && blueprint.category !== 'SAFETY') {
        effectivePriority = 'LOW';
      }

      actions.push({
        id: blueprint.id,
        title: blueprint.title,
        description: blueprint.description,
        priority: effectivePriority,
        category: blueprint.category,
        rationale: blueprint.rationale,
        requiresApproval: blueprint.requiresApproval,
        status: 'RECOMMENDED',
      });
    }
  }

  // 2. Intelligent Missing Information Transformation
  // If there are unaddressed missing information items in analysis, create specific info actions
  if (Array.isArray(analysis.missingInformation) && analysis.missingInformation.length > 0) {
    const unhandledMissing = analysis.missingInformation.filter((m) => {
      const norm = m.toLowerCase();
      // Only include if not already addressed by another action
      return (
        !norm.includes('occupant') &&
        !norm.includes('valve') &&
        m.trim().length > 5
      );
    });

    if (unhandledMissing.length > 0 && !includedActionIds.has('info-clarify-missing-details')) {
      const topMissingItem = unhandledMissing[0];
      actions.push({
        id: 'info-clarify-missing-details',
        title: `Confirm: ${topMissingItem}`,
        description: `Clarify ${topMissingItem.toLowerCase()} to enable accurate assessment and appropriate response.`,
        priority: risk?.level === 'HIGH' || risk?.level === 'CRITICAL' ? 'MEDIUM' : 'LOW',
        category: 'INFORMATION',
        rationale: 'Key factual details remain unconfirmed in the current situation description.',
        requiresApproval: false,
        status: 'RECOMMENDED',
      });
      includedActionIds.add('info-clarify-missing-details');
    }
  }

  // 3. Fallback for benign or unclassified situations
  if (actions.length === 0) {
    actions.push({
      id: 'routine-general-inquiry',
      title: 'Review situation details and proceed with standard steps',
      description: 'Review the identified situation and consult standard guidelines for your specific inquiry.',
      priority: 'LOW',
      category: 'FOLLOW_UP',
      rationale: 'No urgent life-safety or hazardous triggers were identified in the reported context.',
      requiresApproval: false,
      status: 'RECOMMENDED',
    });
  }

  // 4. Sort actions according to the Action Graph flow:
  // Categories: SAFETY -> CONTACT -> INFORMATION -> DOCUMENT -> FOLLOW_UP
  // Within categories: CRITICAL -> HIGH -> MEDIUM -> LOW
  actions.sort((a, b) => {
    const catDiff = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
    if (catDiff !== 0) return catDiff;
    return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  });

  // 5. Build summary
  const primaryActionId = actions.length > 0 ? actions[0].id : undefined;

  return {
    actions,
    primaryActionId,
    stageSummary: {
      hasSafetyAction: actions.some((a) => a.category === 'SAFETY'),
      hasContactAction: actions.some((a) => a.category === 'CONTACT'),
      hasInformationAction: actions.some((a) => a.category === 'INFORMATION'),
      hasFollowUpAction: actions.some((a) => a.category === 'FOLLOW_UP'),
    },
  };
}
