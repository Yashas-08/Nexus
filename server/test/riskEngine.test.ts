import { assessRisk } from '../../client/src/services/riskEngine';
import type { NormalizedAnalysis } from '../../client/src/types/analysis';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
}

console.log('--- STARTING RISK ENGINE TEST SUITE ---');

// Base factory helper
function createMockAnalysis(partial: Partial<NormalizedAnalysis>): NormalizedAnalysis {
  return {
    situation: partial.situation || 'General situation',
    userIntent: partial.userIntent || 'Need assistance',
    severity: partial.severity || 'low',
    confidence: partial.confidence ?? 0.8,
    facts: partial.facts || [],
    userReported: partial.userReported || [],
    inferences: partial.inferences || [],
    risks: partial.risks || [],
    missingInformation: partial.missingInformation || [],
    evidence: partial.evidence || [],
    conflicts: partial.conflicts || [],
    verificationSummary: partial.verificationSummary || {
      verifiedCount: 0,
      userReportedCount: 0,
      inferredCount: 0,
      unknownCount: 0,
      totalEvidenceCount: 0,
      verificationScore: 0,
    },
  };
}

// 1. Low-risk normal situation
{
  const input = createMockAnalysis({
    situation: 'Checking library opening hours and book return policy.',
    userIntent: 'Find out when the library opens tomorrow',
    severity: 'low',
    evidence: [
      { id: '1', text: 'Library closes at 6pm', status: 'VERIFIED', source: 'text' },
    ],
  });
  const res = assessRisk(input);
  assert(res.level === 'LOW', `Test 1: Expected LOW level, got ${res.level}`);
  assert(res.urgency === 'ROUTINE', `Test 1: Expected ROUTINE urgency, got ${res.urgency}`);
  assert(res.score < 30, `Test 1: Expected score < 30, got ${res.score}`);
  console.log('✓ Test 1 Passed: Low-risk normal situation correctly assessed as LOW / ROUTINE');
}

// 2. Moderate-risk situation
{
  const input = createMockAnalysis({
    situation: 'Kitchen sink pipe burst and leaking water on floor. Valve is shut off.',
    userIntent: 'Get plumber to fix broken pipe under sink',
    severity: 'medium',
    evidence: [
      { id: '1', text: 'Pipe burst under sink', status: 'USER_REPORTED', source: 'text' },
      { id: '2', text: 'Water leaking onto kitchen floor', status: 'USER_REPORTED', source: 'text' },
    ],
  });
  const res = assessRisk(input);
  assert(res.level === 'MODERATE', `Test 2: Expected MODERATE level, got ${res.level}`);
  assert(res.urgency === 'SOON', `Test 2: Expected SOON urgency, got ${res.urgency}`);
  assert(res.score >= 30 && res.score < 60, `Test 2: Expected score 30-59, got ${res.score}`);
  console.log('✓ Test 2 Passed: Moderate-risk situation correctly assessed as MODERATE / SOON');
}

// 3. High-risk safety situation
{
  const input = createMockAnalysis({
    situation: 'Downed power line sparking on the sidewalk next to pedestrian crossing.',
    userIntent: 'Report dangerous live electrical wire',
    severity: 'high',
    evidence: [
      { id: '1', text: 'Power line down on sidewalk sparking', status: 'VERIFIED', source: 'image' },
    ],
  });
  const res = assessRisk(input);
  assert(res.level === 'HIGH' || res.level === 'CRITICAL', `Test 3: Expected HIGH or CRITICAL level, got ${res.level}`);
  assert(res.urgency === 'URGENT' || res.urgency === 'IMMEDIATE', `Test 3: Expected URGENT/IMMEDIATE urgency, got ${res.urgency}`);
  assert(res.score >= 60, `Test 3: Expected score >= 60, got ${res.score}`);
  console.log('✓ Test 3 Passed: High-risk electrical safety situation correctly assessed as HIGH/CRITICAL');
}

// 4. Critical life-threatening situation
{
  const input = createMockAnalysis({
    situation: 'Building fire with thick smoke and an elderly resident trapped inside bedroom.',
    userIntent: 'Emergency assistance for trapped resident',
    severity: 'critical',
    evidence: [
      { id: '1', text: 'Active fire in living room', status: 'USER_REPORTED', source: 'text' },
      { id: '2', text: 'Elderly occupant trapped inside bedroom cannot escape', status: 'USER_REPORTED', source: 'text' },
    ],
  });
  const res = assessRisk(input);
  assert(res.level === 'CRITICAL', `Test 4: Expected CRITICAL level, got ${res.level}`);
  assert(res.urgency === 'IMMEDIATE', `Test 4: Expected IMMEDIATE urgency, got ${res.urgency}`);
  assert(res.score >= 80, `Test 4: Expected score >= 80, got ${res.score}`);
  console.log('✓ Test 4 Passed: Critical life-threatening situation correctly assessed as CRITICAL / IMMEDIATE');
}

// 5. High-severity but USER_REPORTED evidence (CRITICAL SAFETY RULE)
{
  const input = createMockAnalysis({
    situation: 'A user reports a possible person trapped in floodwater.',
    userIntent: 'Rescue person trapped in rising floodwater',
    severity: 'high',
    evidence: [
      { id: '1', text: 'Person reported trapped in floodwater', status: 'USER_REPORTED', source: 'text' },
    ],
    verificationSummary: {
      verifiedCount: 0,
      userReportedCount: 1,
      inferredCount: 0,
      unknownCount: 0,
      totalEvidenceCount: 1,
      verificationScore: 0,
    },
  });
  const res = assessRisk(input);
  assert(res.level === 'HIGH' || res.level === 'CRITICAL', `Test 5: Expected HIGH or CRITICAL level, got ${res.level}`);
  assert(res.urgency === 'URGENT' || res.urgency === 'IMMEDIATE', `Test 5: Expected URGENT/IMMEDIATE urgency, got ${res.urgency}`);
  assert(res.evidenceConfidence === 'LIMITED', `Test 5: Expected LIMITED confidence, got ${res.evidenceConfidence}`);
  console.log('✓ Test 5 Passed: Safety rule strictly maintained — USER_REPORTED life threat never reduced to LOW/MODERATE');
}

// 6. Inferred risk signal (appropriate lower weight)
{
  const input = createMockAnalysis({
    situation: 'Damp smell in basement after rainfall last week.',
    userIntent: 'Check if basement needs dehumidifier',
    severity: 'low',
    evidence: [
      { id: '1', text: 'Damp smell in basement', status: 'USER_REPORTED', source: 'text' },
    ],
    inferences: [
      { text: 'Possible risk of property damage if dampness persists', confidence: 0.6 },
    ],
  });
  const res = assessRisk(input);
  assert(res.level === 'LOW' || res.level === 'MODERATE', `Test 6: Expected LOW/MODERATE level, got ${res.level}`);
  assert(res.score <= 45, `Test 6: Expected score <= 45 for mild inference, got ${res.score}`);
  console.log('✓ Test 6 Passed: Inferred risk signal given appropriate bounded weight');
}

// 7. Missing / unknown information
{
  const input = createMockAnalysis({
    situation: 'Smell of gas outside the building near the meter box.',
    userIntent: 'Find out who to contact',
    severity: 'high',
    evidence: [
      { id: '1', text: 'Gas leak odor detected outside', status: 'USER_REPORTED', source: 'text' },
      { id: '2', text: 'Status of main gas shutoff valve', status: 'UNKNOWN', source: 'system' },
      { id: '3', text: 'Presence of occupants in building', status: 'UNKNOWN', source: 'system' },
      { id: '4', text: 'Presence of ignition sources', status: 'UNKNOWN', source: 'system' },
      { id: '5', text: 'Concentration of gas fumes', status: 'UNKNOWN', source: 'system' },
    ],
    verificationSummary: {
      verifiedCount: 0,
      userReportedCount: 1,
      inferredCount: 0,
      unknownCount: 4,
      totalEvidenceCount: 5,
      verificationScore: 0,
    },
  });
  const res = assessRisk(input);
  assert(res.level === 'HIGH' || res.level === 'CRITICAL', `Test 7: Expected HIGH/CRITICAL for gas leak, got ${res.level}`);
  assert(res.evidenceConfidence === 'UNCERTAIN' || res.evidenceConfidence === 'LIMITED', `Test 7: Expected UNCERTAIN/LIMITED confidence, got ${res.evidenceConfidence}`);
  console.log('✓ Test 7 Passed: Missing information creates visible uncertainty without eroding severe hazard level');
}

// 8. Multiple duplicate user claims (No artificial score inflation)
{
  const singleClaimAnalysis = createMockAnalysis({
    situation: 'Severe flooding in basement from broken water pipe.',
    userIntent: 'Stop water leak',
    evidence: [
      { id: '1', text: 'Severe flooding in basement from broken water pipe', status: 'USER_REPORTED', source: 'text' },
    ],
  });

  const duplicateClaimsAnalysis = createMockAnalysis({
    situation: 'Severe flooding in basement from broken water pipe.',
    userIntent: 'Severe flooding in basement from broken water pipe.',
    userReported: [
      { text: 'Severe flooding in basement from broken water pipe', source: 'text' },
      { text: 'Severe flooding in basement from broken water pipe', source: 'text' },
      { text: 'Severe flooding in basement from broken water pipe', source: 'text' },
    ],
    facts: [
      { text: 'Severe flooding in basement from broken water pipe', source: 'text' },
    ],
    risks: [
      { text: 'Severe flooding in basement from broken water pipe', priority: 'medium' },
    ],
    evidence: [
      { id: '1', text: 'Severe flooding in basement from broken water pipe', status: 'USER_REPORTED', source: 'text' },
      { id: '2', text: 'Severe flooding in basement from broken water pipe', status: 'USER_REPORTED', source: 'text' },
    ],
  });

  const resSingle = assessRisk(singleClaimAnalysis);
  const resDup = assessRisk(duplicateClaimsAnalysis);

  assert(resSingle.score === resDup.score, `Test 8: Expected equal scores (${resSingle.score} === ${resDup.score})`);
  assert(resSingle.level === resDup.level, `Test 8: Expected equal levels (${resSingle.level} === ${resDup.level})`);
  console.log('✓ Test 8 Passed: Duplicate user claims deduplicated; score not artificially inflated');
}

// 9. Conflicting evidence handled cleanly
{
  const input = createMockAnalysis({
    situation: 'Basement wall cracked and ceiling falling after excavation next door.',
    userIntent: 'Assess if house is safe to enter',
    evidence: [
      { id: '1', text: 'Ceiling falling and structural collapse danger', status: 'USER_REPORTED', source: 'text' },
      { id: '2', text: 'Contractor stated site is safe', status: 'USER_REPORTED', source: 'text' },
    ],
    conflicts: [
      {
        description: 'Discrepancy regarding structural safety',
        competingClaims: ['Ceiling falling down', 'Contractor stated site is safe'],
        resolution: 'Inspect by licensed structural engineer prior to re-entry',
      },
    ],
  });
  const res = assessRisk(input);
  assert(res.level === 'HIGH' || res.level === 'CRITICAL', `Test 9: Structural collapse threat must be HIGH/CRITICAL despite conflict, got ${res.level}`);
  assert(res.urgency === 'URGENT' || res.urgency === 'IMMEDIATE', `Test 9: Urgency must be elevated, got ${res.urgency}`);
  console.log('✓ Test 9 Passed: Conflicting evidence prioritizes safety; structural threat acknowledged');
}

// 10. Low confidence with potentially severe consequences
{
  const input = createMockAnalysis({
    situation: 'Elderly neighbor not answering door, water trickling under door into hallway.',
    userIntent: 'Welfare check on elderly neighbor',
    evidence: [
      { id: '1', text: 'Elderly resident unresponsive to calls', status: 'USER_REPORTED', source: 'text' },
      { id: '2', text: 'Water trickling under door', status: 'USER_REPORTED', source: 'text' },
    ],
    verificationSummary: {
      verifiedCount: 0,
      userReportedCount: 2,
      inferredCount: 0,
      unknownCount: 0,
      totalEvidenceCount: 2,
      verificationScore: 0,
    },
  });
  const res = assessRisk(input);
  assert(res.level === 'HIGH' || res.level === 'CRITICAL', `Test 10: Expected HIGH/CRITICAL level, got ${res.level}`);
  assert(res.evidenceConfidence === 'LIMITED', `Test 10: Expected LIMITED evidence confidence, got ${res.evidenceConfidence}`);
  assert(res.reasoning.some((r) => r.includes('user reports') || r.includes('human life')), `Test 10: Reasoning must note user reporting and potential danger`);
  console.log('✓ Test 10 Passed: Severity cleanly separated from confidence');
}

// 11. Determinism: Same input produces identical output
{
  const input = createMockAnalysis({
    situation: 'Main gas line valve stuck and smelling gas in basement.',
    userIntent: 'Shut off gas main',
    evidence: [
      { id: '1', text: 'Gas leak smell in basement', status: 'USER_REPORTED', source: 'text' },
      { id: '2', text: 'Main valve stuck', status: 'USER_REPORTED', source: 'text' },
    ],
  });
  const res1 = assessRisk(input);
  const res2 = assessRisk(input);
  assert(JSON.stringify(res1) === JSON.stringify(res2), 'Test 11: Consecutive runs on identical input must be identical');
  console.log('✓ Test 11 Passed: Pure determinism verified — identical input yields identical output');
}

// 12. Invalid / incomplete analysis does not crash
{
  const emptyRes = assessRisk(null as any);
  assert(emptyRes.level === 'LOW', 'Test 12: Null input must return LOW fallback');
  assert(emptyRes.score === 0, 'Test 12: Null input must return score 0');

  const partialRes = assessRisk({} as any);
  assert(partialRes.level === 'LOW', 'Test 12: Empty object must return LOW fallback');
  assert(Array.isArray(partialRes.factors), 'Test 12: Factors must be an array');
  assert(Array.isArray(partialRes.reasoning), 'Test 12: Reasoning must be an array');
  console.log('✓ Test 12 Passed: Graceful fallback on invalid/incomplete inputs without crash');
}

console.log('--- ALL 12 RISK ENGINE UNIT TESTS PASSED SUCCESSFULLY ---');
