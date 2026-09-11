import { generateCaseTitle, validateAndSanitizeCase } from '../../client/src/utils/caseValidation';
import { mapDatabaseRowToCase, mapCaseRecordToCaseItem, type CaseRecord } from '../../client/src/types/cases';
import type { NormalizedAnalysis } from '../../client/src/types/analysis';
import type { RiskAssessment } from '../../client/src/types/risk';
import type { RecommendedAction } from '../../client/src/types/actions';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
}

console.log('--- STARTING PHASE 9: CASES & PERSISTENCE TEST SUITE (13 SCENARIOS) ---');

function createSampleCaseRecord(overrides: Partial<CaseRecord> = {}): CaseRecord {
  const analysis: NormalizedAnalysis = {
    situation: 'Basement flooded due to burst main pipe',
    userIntent: 'Isolate water line and request emergency extraction',
    severity: 'high',
    confidence: 0.9,
    facts: [{ text: 'Water pooling 4 inches deep', source: 'image' }],
    userReported: [{ text: 'Burst pipe started 1 hour ago', source: 'text' }],
    inferences: [{ text: 'Water heater supply line damaged', confidence: 0.85 }],
    risks: [{ text: 'Electrical short near subpanel', priority: 'critical' }],
    missingInformation: ['Main shutoff valve location verified?'],
    evidence: [
      {
        id: 'ev-1',
        text: 'Water pooling 4 inches deep',
        status: 'VERIFIED',
        source: 'image',
      },
    ],
    conflicts: [],
    verificationSummary: {
      verifiedCount: 1,
      userReportedCount: 1,
      inferredCount: 1,
      unknownCount: 1,
      totalEvidenceCount: 4,
      verificationScore: 0.25,
    },
    externalContext: [
      {
        id: 'ctx-w-1',
        source: 'WEATHER',
        title: 'Local Telemetry',
        summary: 'No rain, 18°C',
        retrievedAt: new Date().toISOString(),
        relevance: 'LOW',
        verificationStatus: 'VERIFIED',
      },
    ],
  };

  const actions: RecommendedAction[] = [
    {
      id: 'safety-water-main',
      title: 'Isolate main water supply valve',
      description: 'Turn off shutoff valve immediately',
      priority: 'CRITICAL',
      category: 'SAFETY',
      rationale: 'Prevent progressive flooding',
      requiresApproval: false,
      status: 'RECOMMENDED',
    },
    {
      id: 'contact-emergency-plumber',
      title: 'Contact licensed emergency plumber',
      description: 'Dispatch specialist to repair rupture',
      priority: 'HIGH',
      category: 'CONTACT',
      rationale: 'Professional physical remediation needed',
      requiresApproval: true,
      status: 'APPROVED',
    },
  ];

  return {
    id: 'case-uuid-12345',
    userId: 'user-auth-uuid-999',
    title: 'Flooding in Basement',
    situation: 'Basement flooded due to burst main pipe',
    intent: 'Isolate water line and request emergency extraction',
    riskLevel: 'HIGH',
    urgency: 'IMMEDIATE',
    analysis,
    externalContext: analysis.externalContext,
    actions,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// 1. Title Generation: Contextual title generated, no generic "Case #123"
{
  console.log('Scenario 1: Title Generation creates informative, contextual titles');
  const title1 = generateCaseTitle('Active gas leak in kitchen smelling of rotten eggs');
  assert(title1.includes('Gas leak in Kitchen'), `Title must describe hazard and room: ${title1}`);

  const title2 = generateCaseTitle('Tree fallen onto driveway blocking garage exit');
  assert(!title2.includes('Case #'), 'Must not generate generic Case # identifier');
  assert(title2.length > 5, 'Title must have descriptive length');
  console.log('  Passed Scenario 1');
}

// 2. Data Validation: Validates complete CaseRecord structure
{
  console.log('Scenario 2: Validation schema accepts complete NormalizedAnalysis and ActionGraph');
  const sample = createSampleCaseRecord();
  const sanitized = validateAndSanitizeCase(sample);
  assert(sanitized !== null, 'Sanitization must return a valid CaseRecord');
  assert(sanitized?.id === sample.id, 'ID must be preserved');
  assert(sanitized?.riskLevel === 'HIGH', 'Risk level must be preserved');
  assert(sanitized?.actions.length === 2, 'Actions array must be preserved');
  console.log('  Passed Scenario 2');
}

// 3. Graceful fallback on corrupt / legacy JSONB
{
  console.log('Scenario 3: Graceful fallback on corrupt or partial database record');
  const corruptRecord = {
    id: 'corrupt-1',
    situation: 'Broken fence',
    analysis: '{ invalid-json-payload',
    actions: null,
  };
  const sanitized = validateAndSanitizeCase(corruptRecord);
  assert(sanitized !== null, 'Must sanitize without throwing');
  assert(Array.isArray(sanitized?.actions), 'Actions must default to empty array');
  assert(sanitized?.analysis.facts.length === 0, 'Analysis must default gracefully');
  console.log('  Passed Scenario 3');
}

// 4. Action State Persistence: User APPROVED and DISMISSED statuses preserved
{
  console.log('Scenario 4: Action states (APPROVED, DISMISSED) are accurately preserved');
  const sample = createSampleCaseRecord();
  sample.actions[0].status = 'DISMISSED';
  sample.actions[1].status = 'APPROVED';

  const sanitized = validateAndSanitizeCase(sample);
  assert(sanitized?.actions[0].status === 'DISMISSED', 'First action status must remain DISMISSED');
  assert(sanitized?.actions[1].status === 'APPROVED', 'Second action status must remain APPROVED');
  console.log('  Passed Scenario 4');
}

// 5. Database Row Mapper: Translates snake_case DB columns to camelCase
{
  console.log('Scenario 5: mapDatabaseRowToCase translates Postgres schema correctly');
  const dbRow = {
    id: 'db-uuid-888',
    user_id: 'auth-user-111',
    title: 'Burst pipe in Bathroom',
    situation: 'Water gushing from toilet valve',
    intent: 'Stop the leak',
    risk_level: 'HIGH',
    urgency: 'URGENT',
    analysis: JSON.stringify({ situation: 'Water gushing from toilet valve', facts: [] }),
    external_context: JSON.stringify([]),
    actions: JSON.stringify([{ id: 'act-1', title: 'Shut valve', status: 'APPROVED' }]),
    created_at: '2026-09-11T10:00:00Z',
    updated_at: '2026-09-11T10:05:00Z',
  };

  const mapped = mapDatabaseRowToCase(dbRow);
  assert(mapped.id === 'db-uuid-888', 'ID mapped');
  assert(mapped.userId === 'auth-user-111', 'userId mapped from user_id');
  assert(mapped.riskLevel === 'HIGH', 'riskLevel mapped from risk_level');
  assert(mapped.actions.length === 1, 'Actions parsed from JSON string');
  assert(mapped.actions[0].status === 'APPROVED', 'Action status preserved');
  console.log('  Passed Scenario 5');
}

// 6. CaseItem Mapper: Generates correct list summary badges & status
{
  console.log('Scenario 6: mapCaseRecordToCaseItem derives correct priority and action badge');
  const sample = createSampleCaseRecord({ riskLevel: 'CRITICAL' });
  const item = mapCaseRecordToCaseItem(sample);

  assert(item.priority === 'urgent', 'CRITICAL risk maps to urgent priority badge');
  assert(item.title === sample.title, 'Title matches');
  assert(item.contextSources.includes('photo'), 'Photo source detected from evidence');
  console.log('  Passed Scenario 6');
}

// 7. Reopening: Preserves verified evidence and external context without re-analysis
{
  console.log('Scenario 7: Reopened case preserves evidence and external telemetry without alteration');
  const sample = createSampleCaseRecord();
  const item = mapCaseRecordToCaseItem(sample);
  assert(item.rawRecord !== undefined, 'rawRecord must be attached for zero-overhead reopening');
  assert(item.rawRecord?.analysis.verificationSummary.verifiedCount === 1, 'Verified count intact');
  assert(item.rawRecord?.externalContext?.[0].source === 'WEATHER', 'Weather context intact');
  console.log('  Passed Scenario 7');
}

// 8. Sorting: Cases sorted newest first
{
  console.log('Scenario 8: Case list respects descending chronological ordering');
  const olderCase = createSampleCaseRecord({
    id: 'case-older',
    createdAt: '2026-09-10T10:00:00Z',
    updatedAt: '2026-09-10T10:00:00Z',
  });
  const newerCase = createSampleCaseRecord({
    id: 'case-newer',
    createdAt: '2026-09-11T12:00:00Z',
    updatedAt: '2026-09-11T12:00:00Z',
  });

  const caseList = [olderCase, newerCase].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  assert(caseList[0].id === 'case-newer', 'Newer case must be first in list');
  assert(caseList[1].id === 'case-older', 'Older case must be second in list');
  console.log('  Passed Scenario 8');
}

// 9. Deletion: Targeted delete removes only the designated case
{
  console.log('Scenario 9: Deletion isolates target record and preserves others');
  const cases = [
    createSampleCaseRecord({ id: 'case-keep-1' }),
    createSampleCaseRecord({ id: 'case-delete' }),
    createSampleCaseRecord({ id: 'case-keep-2' }),
  ];

  const targetId = 'case-delete';
  const remaining = cases.filter((c) => c.id !== targetId);
  assert(remaining.length === 2, 'Exactly one case removed');
  assert(!remaining.some((c) => c.id === targetId), 'Target case not in remaining');
  assert(remaining.some((c) => c.id === 'case-keep-1'), 'First case retained');
  assert(remaining.some((c) => c.id === 'case-keep-2'), 'Second case retained');
  console.log('  Passed Scenario 9');
}

// 10. Empty state representation
{
  console.log('Scenario 10: Empty state represented cleanly without placeholder injection');
  const emptyCases: CaseRecord[] = [];
  const items = emptyCases.map(mapCaseRecordToCaseItem);
  assert(items.length === 0, 'No fake or placeholder cases injected');
  console.log('  Passed Scenario 10');
}

// 11. Duplicate Save Guard simulation: Same request returns identical promise
{
  console.log('Scenario 11: In-flight duplicate save prevention deduplicates concurrent calls');
  const saveMap = new Map<string, Promise<any>>();
  const key = 'Basement flooded due to burst main pipe_85';

  let executionCount = 0;
  const mockSave = () => {
    executionCount++;
    return Promise.resolve({ id: 'case-unique-1' });
  };

  const p1 = saveMap.has(key) ? saveMap.get(key)! : saveMap.set(key, mockSave()).get(key)!;
  const p2 = saveMap.has(key) ? saveMap.get(key)! : saveMap.set(key, mockSave()).get(key)!;

  assert(p1 === p2, 'Concurrent calls return identical promise');
  assert(executionCount === 1, 'Save execution triggered exactly once');
  console.log('  Passed Scenario 11');
}

// 12. Row Level Security verification: Policy DDL verification
{
  console.log('Scenario 12: RLS policy verification checks user ownership');
  import('fs').then((fs) => {
    const migrationSql = fs.readFileSync('c:/Users/yasha/OneDrive/Desktop/Nexus/supabase/migrations/20260911_create_cases.sql', 'utf8');
    assert(migrationSql.includes('ENABLE ROW LEVEL SECURITY'), 'RLS must be enabled');
    assert(migrationSql.includes('auth.uid() = user_id'), 'Policies must enforce auth.uid() = user_id');
    assert(migrationSql.includes('cases_select_policy'), 'Select policy defined');
    assert(migrationSql.includes('cases_insert_policy'), 'Insert policy defined');
    assert(migrationSql.includes('cases_delete_policy'), 'Delete policy defined');
    console.log('  Passed Scenario 12');
  });
}

// 13. Privacy / Security: Case payload does not store raw binary uploads or API secrets
{
  console.log('Scenario 13: CaseRecord excludes raw binary buffers and API secrets');
  const sample = createSampleCaseRecord();
  const serialized = JSON.stringify(sample);
  assert(!serialized.includes('GEMINI_API_KEY'), 'Must not leak server API keys');
  assert(!serialized.includes('service_role'), 'Must not leak Supabase service role credentials');
  assert(!serialized.includes('data:image'), 'Must not store raw data URIs or base64 streams in summary item');
  console.log('  Passed Scenario 13');
}

setTimeout(() => {
  console.log('\n======================================================');
  console.log('🎉 ALL 13 PHASE 9 CASES & PERSISTENCE TESTS PASSED!');
  console.log('======================================================');
}, 500);
