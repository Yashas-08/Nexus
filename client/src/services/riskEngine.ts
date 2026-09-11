import type { NormalizedAnalysis, EvidenceStatus } from '../types/analysis';
import type {
  RiskAssessment,
  RiskLevel,
  UrgencyLevel,
  FactorImpact,
  EvidenceConfidenceLevel,
  RiskFactor,
} from '../types/risk';

interface SignalDefinition {
  id: string;
  label: string;
  impact: FactorImpact;
  basePoints: number;
  isLifeSafety: boolean;
  patterns: RegExp[];
}

const SIGNAL_DEFINITIONS: SignalDefinition[] = [
  // 1. Life Safety & Physical Threat
  {
    id: 'trapped_or_stranded',
    label: 'Persons trapped or stranded',
    impact: 'HIGH',
    basePoints: 85,
    isLifeSafety: true,
    patterns: [
      /\b(trapped|stranded|confined|stuck inside|cannot (get out|escape|exit)|cut off by water|surrounded by water)\b/i,
    ],
  },
  {
    id: 'life_threat',
    label: 'Potential threat to life or physical safety',
    impact: 'HIGH',
    basePoints: 85,
    isLifeSafety: true,
    patterns: [
      /\b(life[ -]?threat(ening)?|fatal|unresponsive|drowning|suffocat(ing|ion)|crush(ed)?|electrocution|in immediate danger)\b/i,
    ],
  },
  {
    id: 'medical_urgency',
    label: 'Acute medical urgency',
    impact: 'HIGH',
    basePoints: 80,
    isLifeSafety: true,
    patterns: [
      /\b(severe bleeding|chest pain|unconscious|head injury|seizure|choking|difficulty breathing|overdose|cardiac)\b/i,
    ],
  },

  // 2. Fire, Electrical, Chemical & Environmental Hazards
  {
    id: 'fire_or_combustion',
    label: 'Active fire or smoke hazard',
    impact: 'HIGH',
    basePoints: 75,
    isLifeSafety: true,
    patterns: [
      /\b(fire|open flame|smoke billowing|burning|combustion|blaze|ignited)\b/i,
    ],
  },
  {
    id: 'electrical_or_sparking',
    label: 'Live electrical or sparking hazard',
    impact: 'HIGH',
    basePoints: 70,
    isLifeSafety: false,
    patterns: [
      /\b(sparking|live wire|power line down|downed power line|high voltage|electric shock|exposed electrical)\b/i,
    ],
  },
  {
    id: 'hazardous_chemical_gas',
    label: 'Hazardous gas or chemical condition',
    impact: 'HIGH',
    basePoints: 75,
    isLifeSafety: true,
    patterns: [
      /\b(gas leak|smell(ing)? gas|natural gas|toxic fume|chemical spill|carbon monoxide|poisonous)\b/i,
    ],
  },
  {
    id: 'severe_flooding',
    label: 'Severe water inundation or flooding',
    impact: 'HIGH',
    basePoints: 65,
    isLifeSafety: false,
    patterns: [
      /\b(flood(ing|ed)?|rising water|submerged|inundat(ed|ion)|water main burst|water level rising|gushing water)\b/i,
    ],
  },

  // 3. Infrastructure & Property Failure
  {
    id: 'structural_failure',
    label: 'Structural damage or collapse risk',
    impact: 'HIGH',
    basePoints: 65,
    isLifeSafety: false,
    patterns: [
      /\b(collapse|collapsed|cave-in|ceiling falling|cracked foundation|wall buckling|sinkhole)\b/i,
    ],
  },
  {
    id: 'utility_infrastructure',
    label: 'Major utility or infrastructure failure',
    impact: 'MEDIUM',
    basePoints: 45,
    isLifeSafety: false,
    patterns: [
      /\b(power outage|blackout|pipe burst|burst pipe|valve stuck|sewage back(up)?|no water supply|road blocked|traffic blocked)\b/i,
    ],
  },
  {
    id: 'property_damage',
    label: 'Active property damage',
    impact: 'MEDIUM',
    basePoints: 35,
    isLifeSafety: false,
    patterns: [
      /\b(leaking|water damage|soaked floor|property damage|broken window|ruined|spoilage)\b/i,
    ],
  },

  // 4. Escalation & Vulnerability Modifiers
  {
    id: 'vulnerable_persons',
    label: 'Vulnerable individuals potentially affected',
    impact: 'MEDIUM',
    basePoints: 50,
    isLifeSafety: false,
    patterns: [
      /\b(infant|baby|child|children|elderly|senior|wheelchair|disabled|bedridden|patient|nursing home)\b/i,
    ],
  },
  {
    id: 'rapid_escalation',
    label: 'Active escalation or uncontained condition',
    impact: 'HIGH',
    basePoints: 55,
    isLifeSafety: false,
    patterns: [
      /\b(spreading|worsening rapidly|accelerating|out of control|uncontained|cannot stop|rising fast)\b/i,
    ],
  },

  // 5. Routine / Low-Risk Situations
  {
    id: 'routine_administrative',
    label: 'Routine administrative inquiry or schedule',
    impact: 'LOW',
    basePoints: 10,
    isLifeSafety: false,
    patterns: [
      /\b(schedule|appointment|form|bill|account|renewal|receipt|opening hours|fee|book return|library)\b/i,
    ],
  },
  {
    id: 'minor_maintenance',
    label: 'Minor routine maintenance',
    impact: 'LOW',
    basePoints: 15,
    isLifeSafety: false,
    patterns: [
      /\b(slow drain|dripping faucet|squeaky|lightbulb|cosmetic|scratch|loose knob)\b/i,
    ],
  },
];

/**
 * Normalizes text to assist in deduplication of user claims across analysis sections.
 */
function normalizeTextRoot(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts unique statements across all sections to prevent the same claim from inflating score.
 */
function collectDeduplicatedTexts(analysis: Partial<NormalizedAnalysis>): { text: string; source: EvidenceStatus }[] {
  const seen = new Set<string>();
  const collected: { text: string; source: EvidenceStatus }[] = [];

  const add = (rawText: string | undefined, source: EvidenceStatus) => {
    if (!rawText) return;
    const root = normalizeTextRoot(rawText);
    if (root.length < 3) return;

    // Check if semantic root is already seen (or closely substrings existing)
    for (const s of seen) {
      if (s === root || s.includes(root) || root.includes(s)) {
        return;
      }
    }
    seen.add(root);
    collected.push({ text: rawText, source });
  };

  // 1. Evidence items (Phase 5 normalized truth)
  if (Array.isArray(analysis.evidence)) {
    for (const item of analysis.evidence) {
      add(item.text, item.status);
    }
  }

  // 2. Situation & user intent
  add(analysis.situation, 'USER_REPORTED');
  add(analysis.userIntent, 'USER_REPORTED');

  // 3. User reported & facts fallback
  if (Array.isArray(analysis.userReported)) {
    for (const item of analysis.userReported) {
      add(item.text, 'USER_REPORTED');
    }
  }
  if (Array.isArray(analysis.facts)) {
    for (const item of analysis.facts) {
      add(item.text, item.source === 'text' ? 'USER_REPORTED' : 'VERIFIED');
    }
  }

  // 4. Inferences & risks
  if (Array.isArray(analysis.inferences)) {
    for (const item of analysis.inferences) {
      add(item.text, 'INFERRED');
    }
  }
  if (Array.isArray(analysis.risks)) {
    for (const item of analysis.risks) {
      add(item.text, 'INFERRED');
    }
  }

  return collected;
}

/**
 * Evaluates the evidentiary confidence level based on verification statistics and sources.
 */
function evaluateEvidenceConfidence(
  analysis: Partial<NormalizedAnalysis>,
  matchedFactors: RiskFactor[]
): EvidenceConfidenceLevel {
  const summary = analysis.verificationSummary;
  const evidenceList = analysis.evidence || [];

  const verifiedCount = summary?.verifiedCount ?? evidenceList.filter((e) => e.status === 'VERIFIED').length;
  const score = summary?.verificationScore ?? (evidenceList.length > 0 ? verifiedCount / evidenceList.length : 0);
  const unknownCount = summary?.unknownCount ?? evidenceList.filter((e) => e.status === 'UNKNOWN').length;

  const hasVerifiedSignal = matchedFactors.some((f) => f.sourceType === 'VERIFIED');
  const hasExternalConflict = analysis.conflicts?.some((c) =>
    c.description.toLowerCase().includes('meteorological') || c.description.toLowerCase().includes('external')
  );

  if (hasExternalConflict) {
    return 'UNCERTAIN';
  }

  if (hasVerifiedSignal && score >= 0.5 && verifiedCount >= 2) {
    return 'CONFIRMED';
  }

  if (hasVerifiedSignal || (verifiedCount >= 1 && score >= 0.25)) {
    return 'SUBSTANTIAL';
  }

  if (unknownCount >= 4 && verifiedCount === 0) {
    return 'UNCERTAIN';
  }

  return 'LIMITED';
}

/**
 * Pure, deterministic risk assessment engine.
 * Computes risk level, normalized 0-100 score, priority urgency, and explainable reasoning.
 */
export function assessRisk(analysis: Partial<NormalizedAnalysis> | null | undefined): RiskAssessment {
  // Graceful fallback for missing or empty inputs
  if (!analysis) {
    return {
      level: 'LOW',
      score: 0,
      urgency: 'ROUTINE',
      evidenceConfidence: 'UNCERTAIN',
      factors: [],
      reasoning: ['Insufficient situation data to perform a risk assessment.'],
    };
  }

  const statementList = collectDeduplicatedTexts(analysis);

  // 1. Detect unique signals
  const detectedSignals: SignalDefinition[] = [];
  const factors: RiskFactor[] = [];
  const detectedSignalIds = new Set<string>();

  for (const def of SIGNAL_DEFINITIONS) {
    let matched = false;
    let matchedSource: EvidenceStatus = 'USER_REPORTED';
    let matchedSnippet = '';

    for (const pat of def.patterns) {
      // Find matching item to attribute source correctly
      for (const item of statementList) {
        if (pat.test(item.text)) {
          matched = true;
          matchedSource = item.source;
          matchedSnippet = item.text;
          break;
        }
      }
      if (matched) break;
    }

    if (matched && !detectedSignalIds.has(def.id)) {
      detectedSignalIds.add(def.id);
      detectedSignals.push(def);
      factors.push({
        label: def.label,
        impact: def.impact,
        sourceType: matchedSource,
        detail: matchedSnippet.length > 80 ? matchedSnippet.slice(0, 77) + '...' : matchedSnippet,
      });
    }
  }

  // 2. Identify Critical Safety Conditions
  const hasLifeSafety = detectedSignals.some((s) => s.isLifeSafety);
  const hasVulnerable = detectedSignalIds.has('vulnerable_persons');
  const hasEscalation = detectedSignalIds.has('rapid_escalation');
  const hasHighHazard = detectedSignals.some(
    (s) => s.id === 'fire_or_combustion' || s.id === 'hazardous_chemical_gas' || s.id === 'electrical_or_sparking'
  );

  // 3. Compute Deterministic Base Score
  let score = 0;
  if (detectedSignals.length === 0) {
    // Fallback baseline when no specific hazards detected
    score = 15;
  } else {
    // Start with highest severity factor's base points
    const highestBase = Math.max(...detectedSignals.map((s) => s.basePoints));
    score = highestBase;

    // Independent category modifier: +5 for each additional distinct hazard (up to +15)
    const additionalHazardsCount = Math.min(3, Math.max(0, detectedSignals.length - 1));
    score += additionalHazardsCount * 5;

    // Modifiers
    if (hasVulnerable) score += 10;
    if (hasEscalation) score += 10;
  }

  // External context telemetry integration (e.g. verified severe weather)
  const severeWeatherContext = analysis.externalContext?.find(
    (c) => c.source === 'WEATHER' && c.relevance === 'HIGH' && c.verificationStatus === 'VERIFIED'
  );
  if (severeWeatherContext) {
    score += 10;
    factors.push({
      label: 'Verified Severe Weather Telemetry',
      impact: 'HIGH',
      sourceType: 'VERIFIED',
      detail: severeWeatherContext.summary,
    });
  }

  // Deduplication check: Multiple user claims about the same issue must NOT add redundant base points.
  // (Notice collectDeduplicatedTexts already enforces single detection per signal ID).

  // 4. Evidence Weighting & Adjustments
  const evidenceConfidence = evaluateEvidenceConfidence(analysis, factors);

  // When all matched factors are purely INFERRED without direct user report or verification
  const isPurelyInferred = factors.length > 0 && factors.every((f) => f.sourceType === 'INFERRED');
  if (isPurelyInferred && !hasLifeSafety) {
    score = Math.max(20, score - 15);
  }

  // 5. CRITICAL SAFETY RULE:
  // Never reduce a clearly life-threatening situation to LOW or MODERATE merely because confidence is low!
  if (hasLifeSafety) {
    // Floor score at minimum 80 for life-threatening situations
    score = Math.max(80, score);
  } else if (hasHighHazard) {
    // Floor score at minimum 65 for active fire / gas / high voltage
    score = Math.max(65, score);
  }

  // Clamp normalized score strictly to integer 0–100
  score = Math.min(100, Math.max(0, Math.round(score)));

  // 6. Determine Risk Level
  let level: RiskLevel;
  if (score >= 80 || hasLifeSafety) {
    level = 'CRITICAL';
  } else if (score >= 60 || hasHighHazard) {
    level = 'HIGH';
  } else if (score >= 30) {
    level = 'MODERATE';
  } else {
    level = 'LOW';
  }

  // 7. Determine Priority / Recommended Urgency
  let urgency: UrgencyLevel;
  if (level === 'CRITICAL' || hasLifeSafety) {
    urgency = 'IMMEDIATE';
  } else if (level === 'HIGH') {
    urgency = 'URGENT';
  } else if (level === 'MODERATE') {
    urgency = 'SOON';
  } else {
    urgency = 'ROUTINE';
  }

  // 8. Generate Human-Readable Explainable Reasoning
  const reasoning: string[] = [];

  if (hasLifeSafety) {
    reasoning.push('Potential immediate threat to human life or safety requires urgent prioritized response.');
  }

  if (hasHighHazard) {
    reasoning.push('Active environmental or hazardous conditions detected in reported situation.');
  }

  if (detectedSignalIds.has('severe_flooding')) {
    reasoning.push('Severe water inundation threatens interior building integrity or physical accessibility.');
  }

  if (detectedSignalIds.has('utility_infrastructure')) {
    reasoning.push('Key utility or infrastructure failure disrupts normal operations.');
  }

  if (hasVulnerable) {
    reasoning.push('Vulnerable individuals identified; response priority elevated.');
  }

  if (hasEscalation) {
    reasoning.push('Report indicates worsening or uncontained conditions.');
  }

  if (severeWeatherContext) {
    reasoning.push(`Meteorological telemetry corroborates severe external conditions (${severeWeatherContext.title}).`);
  }

  // Explain evidence confidence relationship explicitly
  if (hasLifeSafety && evidenceConfidence === 'LIMITED') {
    reasoning.push('Evidence relies on direct user reports without external sensor corroboration, but severe potential consequences warrant immediate caution.');
  } else if (evidenceConfidence === 'CONFIRMED') {
    reasoning.push('Risk factors are objectively corroborated by verified telemetry or documents.');
  } else if (evidenceConfidence === 'UNCERTAIN') {
    reasoning.push('Significant missing information exists; on-site clarification is recommended.');
  }

  // Fallback reasoning if none populated
  if (reasoning.length === 0) {
    if (level === 'LOW') {
      reasoning.push('No life safety, structural, or urgent physical hazards identified in available details.');
      reasoning.push('Situation can be addressed through routine procedures.');
    } else {
      reasoning.push('Assessment reflects standard baseline thresholds for reported situation.');
    }
  }

  return {
    level,
    score,
    urgency,
    evidenceConfidence,
    factors,
    reasoning,
  };
}
