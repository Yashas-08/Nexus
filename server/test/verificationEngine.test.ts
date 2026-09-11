import assert from 'node:assert';
import { verificationEngine } from '../src/services/verificationEngine.js';
import type { AnalysisResult, IntentAnalyzeRequest } from '../src/types/analysis.js';

console.log('--- STARTING VERIFICATION ENGINE TEST SUITE ---');

// Base mock AnalysisResult
function createMockAnalysis(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    situation: 'Basement flooding near furnace',
    userIntent: 'Report water hazard and seek resolution',
    severity: 'high',
    confidence: 0.9,
    facts: [],
    userReported: [],
    inferences: [],
    risks: [],
    missingInformation: [],
    ...overrides,
  };
}

// TEST 1: User statement from text only CANNOT be classified as VERIFIED
{
  const mockAnalysis = createMockAnalysis({
    facts: [
      { text: 'Water is 3 inches deep on floor', source: 'text' },
    ],
  });
  const request: IntentAnalyzeRequest = { text: 'Water is 3 inches deep on floor', images: [], documents: [] };

  const result = verificationEngine.normalize(mockAnalysis, request);
  const factItem = result.evidence.find((e) => e.text.includes('3 inches deep'));

  assert.ok(factItem, 'Fact item should exist in normalized evidence');
  assert.strictEqual(
    factItem.status,
    'USER_REPORTED',
    'CRITICAL: Text statement without independent document MUST be downgraded to USER_REPORTED'
  );
  console.log('✓ Test 1 Passed: Text statement without external document correctly classified as USER_REPORTED');
}

// TEST 2: Observable image evidence becomes VERIFIED when image is present
{
  const mockAnalysis = createMockAnalysis({
    facts: [
      { text: 'Water level clearly submerging base of furnace in photo', source: 'image' },
    ],
  });
  const request: IntentAnalyzeRequest = {
    text: '',
    images: [{ name: 'furnace.jpg', mimeType: 'image/jpeg', base64Data: 'dummy' }],
    documents: [],
  };

  const result = verificationEngine.normalize(mockAnalysis, request);
  const imgItem = result.evidence.find((e) => e.text.includes('furnace'));

  assert.ok(imgItem);
  assert.strictEqual(imgItem.status, 'VERIFIED', 'Observable visual evidence must be VERIFIED when image is attached');
  assert.strictEqual(imgItem.source, 'image');
  console.log('✓ Test 2 Passed: Observable image evidence correctly classified as VERIFIED');
}

// TEST 3: Image claimed as source but NO image was attached in request -> Downgrade
{
  const mockAnalysis = createMockAnalysis({
    facts: [
      { text: 'Cracked water main visible in street', source: 'image' },
    ],
  });
  const request: IntentAnalyzeRequest = { text: 'Cracked water main', images: [], documents: [] };

  const result = verificationEngine.normalize(mockAnalysis, request);
  const item = result.evidence.find((e) => e.text.includes('Cracked water main'));

  assert.ok(item);
  assert.notStrictEqual(item.status, 'VERIFIED', 'Cannot be VERIFIED if no image was provided');
  assert.strictEqual(item.status, 'INFERRED', 'Downgraded to INFERRED when no image exists');
  console.log('✓ Test 3 Passed: Claimed image fact downgraded when no image provided in request');
}

// TEST 4: Location context verified when location attached
{
  const mockAnalysis = createMockAnalysis({
    facts: [
      { text: 'Coordinates within flood advisory zone', source: 'location' },
    ],
  });
  const request: IntentAnalyzeRequest = {
    text: 'Flooded',
    images: [],
    documents: [],
    location: { latitude: 40.7128, longitude: -74.006, accuracy: 12 },
  };

  const result = verificationEngine.normalize(mockAnalysis, request);
  const locItem = result.evidence.find((e) => e.text.includes('Coordinates'));

  assert.ok(locItem);
  assert.strictEqual(locItem.status, 'VERIFIED');
  assert.strictEqual(locItem.source, 'location');
  console.log('✓ Test 4 Passed: Location sensor context correctly classified as VERIFIED');
}

// TEST 5: Inferences can NEVER become VERIFIED
{
  const mockAnalysis = createMockAnalysis({
    inferences: [
      { text: 'Electrical short circuit is highly likely', confidence: 0.95 },
    ],
  });
  const request: IntentAnalyzeRequest = { text: 'Water near panel', images: [], documents: [] };

  const result = verificationEngine.normalize(mockAnalysis, request);
  const infItem = result.evidence.find((e) => e.text.includes('short circuit'));

  assert.ok(infItem);
  assert.strictEqual(infItem.status, 'INFERRED', 'Inferences must remain INFERRED');
  assert.strictEqual(infItem.confidence, 0.95);
  console.log('✓ Test 5 Passed: Inferences strictly preserved as INFERRED and never upgraded');
}

// TEST 6: Missing information mapped to UNKNOWN
{
  const mockAnalysis = createMockAnalysis({
    missingInformation: [
      'Whether main gas shutoff valve has been engaged',
    ],
  });
  const request: IntentAnalyzeRequest = { text: 'Gas smell', images: [], documents: [] };

  const result = verificationEngine.normalize(mockAnalysis, request);
  const unkItem = result.evidence.find((e) => e.text.includes('gas shutoff valve'));

  assert.ok(unkItem);
  assert.strictEqual(unkItem.status, 'UNKNOWN', 'Missing information must be mapped to UNKNOWN status');
  console.log('✓ Test 6 Passed: Missing information correctly mapped to UNKNOWN');
}

// TEST 7: Conflicting information detection
{
  const mockAnalysis = createMockAnalysis({
    userReported: [
      { text: 'The entire road is completely closed to all traffic', source: 'text' },
    ],
    missingInformation: [
      'Current official closure status of the road by local police',
    ],
  });
  const request: IntentAnalyzeRequest = { text: 'Road closed', images: [], documents: [] };

  const result = verificationEngine.normalize(mockAnalysis, request);
  assert.ok(result.conflicts.length > 0, 'Conflict must be surfaced when user asserts status that is unconfirmed');
  console.log('✓ Test 7 Passed: Potential discrepancy surfaced in conflicts list');
}

// TEST 8: Empty evidence handling
{
  const mockAnalysis = createMockAnalysis({
    facts: [],
    userReported: [],
    inferences: [],
    missingInformation: [],
  });
  const request: IntentAnalyzeRequest = { text: 'Hello', images: [], documents: [] };

  const result = verificationEngine.normalize(mockAnalysis, request);
  assert.strictEqual(result.evidence.length, 0);
  assert.strictEqual(result.verificationSummary.totalEvidenceCount, 0);
  assert.strictEqual(result.verificationSummary.verificationScore, 0);
  console.log('✓ Test 8 Passed: Empty evidence handled cleanly with 0 score');
}

// TEST 9: Verification summary accuracy
{
  const mockAnalysis = createMockAnalysis({
    facts: [
      { text: 'GPS coordinates verified', source: 'location' },
      { text: 'User says leak started at 4pm', source: 'text' }, // Will be downgraded to USER_REPORTED
    ],
    inferences: [
      { text: 'Risk of mold growth', confidence: 0.8 },
    ],
    missingInformation: [
      'Plumbing blueprints',
    ],
  });
  const request: IntentAnalyzeRequest = {
    text: 'Leak',
    images: [],
    documents: [],
    location: { latitude: 10, longitude: 20 },
  };

  const result = verificationEngine.normalize(mockAnalysis, request);
  assert.strictEqual(result.verificationSummary.verifiedCount, 1, 'Exactly 1 verified item');
  assert.strictEqual(result.verificationSummary.userReportedCount, 1, 'Exactly 1 user reported item');
  assert.strictEqual(result.verificationSummary.inferredCount, 1, 'Exactly 1 inferred item');
  assert.strictEqual(result.verificationSummary.unknownCount, 1, 'Exactly 1 unknown item');
  assert.strictEqual(result.verificationSummary.totalEvidenceCount, 4, 'Total evidence items is 4');
  assert.strictEqual(result.verificationSummary.verificationScore, 0.25, 'Score is 1/4 = 0.25');
  console.log('✓ Test 9 Passed: Verification summary counts and score calculated with mathematical precision');
}

console.log('--- ALL 9 UNIT TESTS COMPLETED SUCCESSFULLY ---');
