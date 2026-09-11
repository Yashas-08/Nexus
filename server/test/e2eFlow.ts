import { assessRisk } from '../../client/src/services/riskEngine';
import { generateActionGraph } from '../../client/src/services/actionEngine';

async function testE2E() {
  console.log('1. Testing High Risk Situation against live server...');
  const highRiskPayload = {
    text: 'Water pipe burst flooding the basement floor right next to the electrical breaker panel with sparking wires.',
    images: [],
    documents: [],
    location: null,
  };

  const res1 = await fetch('http://localhost:5000/api/intent/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(highRiskPayload),
  });

  const body1 = (await res1.json()) as any;
  console.log('Server response status:', res1.status, body1.status);
  const risk1 = assessRisk(body1.data);
  console.log('Risk Level:', risk1.level);
  console.log('Risk Score:', risk1.score);
  console.log('Urgency:', risk1.urgency);
  console.log('Evidence Confidence:', risk1.evidenceConfidence);
  console.log('Risk Factors:', risk1.factors.map((f) => `${f.label} [${f.impact}]`));
  console.log('Reasoning:', risk1.reasoning);

  if (risk1.level !== 'HIGH' && risk1.level !== 'CRITICAL') {
    throw new Error(`Expected HIGH or CRITICAL risk, got ${risk1.level}`);
  }
  if (risk1.urgency !== 'URGENT' && risk1.urgency !== 'IMMEDIATE') {
    throw new Error(`Expected URGENT or IMMEDIATE urgency, got ${risk1.urgency}`);
  }

  const actionGraph1 = generateActionGraph(body1.data, risk1);
  console.log('Generated Actions Count:', actionGraph1.actions.length);
  console.log('Action Sequence:');
  actionGraph1.actions.forEach((a, i) => {
    console.log(`  ${i + 1}. [${a.category}] ${a.title} (${a.priority}) - RequiresApproval: ${a.requiresApproval}`);
  });

  if (!actionGraph1.stageSummary.hasSafetyAction) {
    throw new Error('Expected high-risk situation to have a SAFETY action');
  }
  if (actionGraph1.actions[0].category !== 'SAFETY') {
    throw new Error('Expected high-risk first action to be SAFETY');
  }

  console.log('\n2. Testing Low Risk Situation against live server...');
  const lowRiskPayload = {
    text: 'Want to check the community center weekend opening hours and room reservation policy.',
    images: [],
    documents: [],
    location: null,
  };

  const res2 = await fetch('http://localhost:5000/api/intent/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lowRiskPayload),
  });

  const body2 = (await res2.json()) as any;
  console.log('Server response status:', res2.status, body2.status);
  const risk2 = assessRisk(body2.data);
  console.log('Risk Level:', risk2.level);
  console.log('Risk Score:', risk2.score);
  console.log('Urgency:', risk2.urgency);
  console.log('Evidence Confidence:', risk2.evidenceConfidence);
  console.log('Risk Factors:', risk2.factors.map((f) => `${f.label} [${f.impact}]`));
  console.log('Reasoning:', risk2.reasoning);

  if (risk2.level !== 'LOW') {
    throw new Error(`Expected LOW risk, got ${risk2.level}`);
  }
  if (risk2.urgency !== 'ROUTINE') {
    throw new Error(`Expected ROUTINE urgency, got ${risk2.urgency}`);
  }

  const actionGraph2 = generateActionGraph(body2.data, risk2);
  console.log('Generated Actions Count (Low Risk):', actionGraph2.actions.length);
  console.log('Action Sequence:');
  actionGraph2.actions.forEach((a, i) => {
    console.log(`  ${i + 1}. [${a.category}] ${a.title} (${a.priority}) - RequiresApproval: ${a.requiresApproval}`);
  });

  if (actionGraph2.stageSummary.hasSafetyAction) {
    throw new Error('Low risk situation should NOT have emergency safety actions');
  }

  console.log('\n--- E2E FLOW TEST COMPLETED SUCCESSFULLY ---');
}

testE2E().catch((err) => {
  console.error('E2E Flow Error:', err);
  process.exit(1);
});
