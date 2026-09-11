import { generateActionGraph } from '../../client/src/services/actionEngine';
import type { NormalizedAnalysis } from '../../client/src/types/analysis';
import type { RiskAssessment } from '../../client/src/types/risk';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
}

console.log('--- STARTING ACTION ENGINE TEST SUITE ---');

// Helper factory
function createMockData(
  analysisPartial: Partial<NormalizedAnalysis>,
  riskPartial?: Partial<RiskAssessment>
): { analysis: NormalizedAnalysis; risk: RiskAssessment } {
  const analysis: NormalizedAnalysis = {
    situation: analysisPartial.situation || 'General situation',
    userIntent: analysisPartial.userIntent || 'Resolve issue',
    severity: analysisPartial.severity || 'low',
    confidence: analysisPartial.confidence ?? 0.8,
    facts: analysisPartial.facts || [],
    userReported: analysisPartial.userReported || [],
    inferences: analysisPartial.inferences || [],
    risks: analysisPartial.risks || [],
    missingInformation: analysisPartial.missingInformation || [],
    evidence: analysisPartial.evidence || [],
    conflicts: analysisPartial.conflicts || [],
    verificationSummary: analysisPartial.verificationSummary || {
      verifiedCount: 0,
      userReportedCount: 0,
      inferredCount: 0,
      unknownCount: 0,
      totalEvidenceCount: 0,
      verificationScore: 0,
    },
  };

  const risk: RiskAssessment = {
    level: riskPartial?.level || 'LOW',
    score: riskPartial?.score ?? 15,
    urgency: riskPartial?.urgency || 'ROUTINE',
    evidenceConfidence: riskPartial?.evidenceConfidence || 'CONFIRMED',
    factors: riskPartial?.factors || [],
    reasoning: riskPartial?.reasoning || [],
  };

  return { analysis, risk };
}

// 1. LOW-risk situation: Routine inquiry generates routine actions, no emergency safety actions
{
  const { analysis, risk } = createMockData(
    {
      situation: 'Check community library weekend opening hours and room reservation policy.',
      userIntent: 'Find out when library opens',
    },
    { level: 'LOW', urgency: 'ROUTINE' }
  );

  const graph = generateActionGraph(analysis, risk);
  assert(graph.actions.length > 0, 'Test 1: Must generate at least one action');
  assert(!graph.stageSummary.hasSafetyAction, 'Test 1: Low risk must NOT generate emergency safety actions');
  assert(
    graph.actions.some((a) => a.category === 'CONTACT' || a.category === 'FOLLOW_UP'),
    'Test 1: Low risk should generate routine contact or follow-up action'
  );
  console.log('✓ Test 1 Passed: Low-risk situation generates routine actions without emergency safety guidance');
}

// 2. MODERATE-risk situation: Practical next steps, utility contact, damage documentation
{
  const { analysis, risk } = createMockData(
    {
      situation: 'Kitchen pipe burst with water leaking on floor. Shutoff valve is working.',
      userIntent: 'Get plumber to fix pipe burst',
    },
    { level: 'MODERATE', urgency: 'SOON' }
  );

  const graph = generateActionGraph(analysis, risk);
  assert(graph.stageSummary.hasSafetyAction, 'Test 2: Pipe burst must generate isolation safety action');
  assert(graph.stageSummary.hasContactAction, 'Test 2: Must generate maintenance/plumber contact action');
  assert(
    graph.actions.some((a) => a.category === 'DOCUMENT'),
    'Test 2: Water damage must generate photo documentation action'
  );
  console.log('✓ Test 2 Passed: Moderate-risk situation generates isolation, contact, and documentation actions');
}

// 3. HIGH-risk situation: Urgent electrical/hazard safety action first, contact dispatch second
{
  const { analysis, risk } = createMockData(
    {
      situation: 'Downed power line on sidewalk next to pedestrian crossing with visible sparking.',
      userIntent: 'Report live wire danger',
    },
    { level: 'HIGH', urgency: 'URGENT' }
  );

  const graph = generateActionGraph(analysis, risk);
  assert(graph.actions.length >= 2, 'Test 3: Must generate at least 2 actions');
  assert(graph.actions[0].category === 'SAFETY', 'Test 3: First action MUST be SAFETY');
  assert(
    graph.actions[0].title.toLowerCase().includes('electrical') || graph.actions[0].title.toLowerCase().includes('distance'),
    'Test 3: First action must be electrical clearance'
  );
  assert(
    graph.actions.some((a) => a.category === 'CONTACT'),
    'Test 3: Must generate utility/emergency contact action'
  );
  console.log('✓ Test 3 Passed: High-risk situation places electrical safety clearance strictly first');
}

// 4. CRITICAL-risk situation: Immediate safety evacuation/rescue first, emergency contact second
{
  const { analysis, risk } = createMockData(
    {
      situation: 'Active building fire with heavy smoke and resident trapped in bedroom.',
      userIntent: 'Rescue trapped resident from building fire',
    },
    { level: 'CRITICAL', urgency: 'IMMEDIATE' }
  );

  const graph = generateActionGraph(analysis, risk);
  assert(graph.actions[0].category === 'SAFETY', 'Test 4: Immediate action must be SAFETY');
  assert(graph.actions[0].priority === 'CRITICAL', 'Test 4: First action priority must be CRITICAL');
  assert(
    graph.actions.some((a) => a.category === 'CONTACT' && a.id === 'contact-emergency-services'),
    'Test 4: Must recommend contacting emergency services'
  );
  console.log('✓ Test 4 Passed: Critical life-threatening situation places immediate safety and rescue first');
}

// 5. User-reported high-risk signal: Generates safety action despite being uncorroborated
{
  const { analysis, risk } = createMockData(
    {
      situation: 'User reports possible gas leak odor outside building near meters.',
      userReported: [{ text: 'User smells strong gas leak odor', source: 'text' }],
    },
    { level: 'HIGH', urgency: 'URGENT', evidenceConfidence: 'LIMITED' }
  );

  const graph = generateActionGraph(analysis, risk);
  assert(graph.stageSummary.hasSafetyAction, 'Test 5: User-reported gas leak must generate safety action');
  const safetyAction = graph.actions.find((a) => a.category === 'SAFETY');
  assert(
    safetyAction?.title.toLowerCase().includes('gas') || safetyAction?.title.toLowerCase().includes('evacuate'),
    'Test 5: Safety action must address gas odor'
  );
  console.log('✓ Test 5 Passed: Safety action generated for uncorroborated user-reported hazard');
}

// 6. Inferred risk signal: Appropriate lower priority or conditional action
{
  const { analysis, risk } = createMockData(
    {
      situation: 'Damp smell in basement after heavy rainfall.',
      inferences: [{ text: 'Potential mold growth if water damage not remediated', confidence: 0.6 }],
    },
    { level: 'LOW', urgency: 'ROUTINE' }
  );

  const graph = generateActionGraph(analysis, risk);
  const followUp = graph.actions.find((a) => a.category === 'FOLLOW_UP');
  assert(followUp !== undefined, 'Test 6: Inferred moisture risk should produce follow-up monitoring action');
  assert(followUp?.priority === 'LOW', 'Test 6: Follow-up action must have LOW priority');
  console.log('✓ Test 6 Passed: Inferred risk produces appropriate bounded follow-up action');
}

// 7. Missing information: Transforms critical missing details into an INFORMATION action
{
  const { analysis, risk } = createMockData(
    {
      situation: 'Heavy flooding reported in residential apartment building.',
      missingInformation: [
        'Confirm whether any occupants are currently trapped or injured',
        'Status of main utility shutoff valve',
      ],
    },
    { level: 'HIGH', urgency: 'URGENT' }
  );

  const graph = generateActionGraph(analysis, risk);
  assert(graph.stageSummary.hasInformationAction, 'Test 7: Must include INFORMATION action');
  const infoAction = graph.actions.find((a) => a.category === 'INFORMATION');
  assert(
    infoAction?.title.toLowerCase().includes('trapped') || infoAction?.title.toLowerCase().includes('valve'),
    'Test 7: Information action must target critical missing detail'
  );
  console.log('✓ Test 7 Passed: Missing information successfully transformed into an actionable INFORMATION step');
}

// 8. Duplicate action generation: Duplicate triggers merged into single action with combined rationale
{
  const { analysis, risk } = createMockData(
    {
      situation: 'Severe pipe burst flooding basement. Pipe burst flooding basement.',
      userReported: [
        { text: 'Pipe burst flooding basement', source: 'text' },
        { text: 'Pipe burst flooding basement', source: 'text' },
      ],
      facts: [{ text: 'Pipe burst flooding basement', source: 'text' }],
    },
    { level: 'MODERATE', urgency: 'SOON' }
  );

  const graph = generateActionGraph(analysis, risk);
  const isolationActions = graph.actions.filter((a) => a.id === 'safety-isolate-water-main');
  assert(isolationActions.length === 1, `Test 8: Expected exactly 1 isolation action, got ${isolationActions.length}`);
  console.log('✓ Test 8 Passed: Duplicate triggers merged into exactly one action');
}

// 9. Conflicting signals: Safest supported action prioritized
{
  const { analysis, risk } = createMockData(
    {
      situation: 'Ceiling collapsed in garage after storm. Contractor says building is fine.',
      userReported: [
        { text: 'Ceiling collapsed and wall cracked', source: 'text' },
        { text: 'Contractor says building is fine', source: 'text' },
      ],
    },
    { level: 'HIGH', urgency: 'URGENT' }
  );

  const graph = generateActionGraph(analysis, risk);
  assert(graph.actions[0].category === 'SAFETY', 'Test 9: Safest supported action must be first');
  assert(
    graph.actions[0].title.toLowerCase().includes('structural') || graph.actions[0].title.toLowerCase().includes('clear'),
    'Test 9: Structural clearance must be prioritized over unverified clearance'
  );
  console.log('✓ Test 9 Passed: Conflicting signals prioritize safety action first');
}

// 10. No-action / insufficient context scenario: Safe fallback without crashing
{
  const graphNull = generateActionGraph(null, null);
  assert(Array.isArray(graphNull.actions), 'Test 10: Null analysis returns valid ActionGraph');
  assert(graphNull.actions.length === 0, 'Test 10: Null analysis has 0 actions');

  const graphEmpty = generateActionGraph({}, undefined);
  assert(graphEmpty.actions.length > 0, 'Test 10: Empty object provides safe fallback action');
  assert(graphEmpty.actions[0].priority === 'LOW', 'Test 10: Fallback action has LOW priority');
  console.log('✓ Test 10 Passed: Safe fallback on missing or empty context without crashing');
}

// 11. Consequential action always requires approval
{
  const { analysis, risk } = createMockData(
    {
      situation: 'Apartment fire with smoke billowing from kitchen.',
    },
    { level: 'CRITICAL', urgency: 'IMMEDIATE' }
  );

  const graph = generateActionGraph(analysis, risk);
  const contactAction = graph.actions.find((a) => a.id === 'contact-emergency-services');
  assert(contactAction !== undefined, 'Test 11: Emergency contact action must be present');
  assert(contactAction?.requiresApproval === true, 'Test 11: Consequential external contact MUST require approval');
  console.log('✓ Test 11 Passed: Consequential external contact strictly requires approval');
}

// 12. Approved action is never incorrectly marked completed
{
  const { analysis, risk } = createMockData(
    {
      situation: 'Pipe burst in kitchen.',
    },
    { level: 'MODERATE', urgency: 'SOON' }
  );

  const graph = generateActionGraph(analysis, risk);
  for (const act of graph.actions) {
    assert(act.status === 'RECOMMENDED', 'Test 12: Initial status must be RECOMMENDED');
    assert(act.status !== 'COMPLETED', 'Test 12: Action must never initialize as COMPLETED');
  }
  console.log('✓ Test 12 Passed: Actions initialize in RECOMMENDED state and are never falsely marked completed');
}

// 13. Determinism: Same input produces deterministic action ordering
{
  const { analysis, risk } = createMockData(
    {
      situation: 'Gas leak smell near electrical panel with flooding in basement.',
      missingInformation: ['Confirm whether anyone is currently trapped or injured'],
    },
    { level: 'HIGH', urgency: 'URGENT' }
  );

  const run1 = generateActionGraph(analysis, risk);
  const run2 = generateActionGraph(analysis, risk);

  assert(run1.actions.length === run2.actions.length, 'Test 13: Action counts must match');
  for (let i = 0; i < run1.actions.length; i++) {
    assert(run1.actions[i].id === run2.actions[i].id, `Test 13: Action ID at index ${i} must match`);
    assert(run1.actions[i].priority === run2.actions[i].priority, `Test 13: Priority at index ${i} must match`);
    assert(run1.actions[i].category === run2.actions[i].category, `Test 13: Category at index ${i} must match`);
  }
  console.log('✓ Test 13 Passed: Pure determinism verified — identical input yields identical action ordering');
}

console.log('--- ALL 13 ACTION ENGINE UNIT TESTS PASSED SUCCESSFULLY ---');
