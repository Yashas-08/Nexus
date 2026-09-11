import type {
  AnalysisResult,
  IntentAnalyzeRequest,
  NormalizedAnalysis,
  EvidenceItem,
  EvidenceConflict,
  VerificationSummary,
  ExternalContextItem,
} from '../types/analysis.js';

export class VerificationEngine {
  /**
   * Deterministically normalizes and classifies Gemini analysis results
   * against the actual physical modalities and real-world external context.
   */
  public normalize(
    raw: AnalysisResult,
    request: IntentAnalyzeRequest,
    externalContext: ExternalContextItem[] = []
  ): NormalizedAnalysis {
    const hasImages = Boolean(request.images && request.images.length > 0);
    const hasDocuments = Boolean(request.documents && request.documents.length > 0);
    const hasLocation = Boolean(request.location !== null && request.location !== undefined);

    const evidenceItems: EvidenceItem[] = [];
    const conflicts: EvidenceConflict[] = [];

    let counter = 1;
    const generateId = (prefix: string) => `ev-${prefix}-${counter++}`;

    // 1. Process and deterministically classify Gemini "facts"
    for (const fact of raw.facts || []) {
      const text = fact.text.trim();
      if (!text) continue;

      // RULE 1: If claimed source is "text" but no external document was supplied,
      // it is a user assertion and CANNOT be classified as VERIFIED.
      if (fact.source === 'text' && !hasDocuments) {
        evidenceItems.push({
          id: generateId('user'),
          text,
          status: 'USER_REPORTED',
          source: 'text',
          confidence: null,
          verifiedBy: null,
          notes: 'User assertion from description without independent sensory or document verification',
        });
        continue;
      }

      // RULE 2: If claimed source is "image", only verify if an image was actually supplied.
      if (fact.source === 'image') {
        if (hasImages) {
          evidenceItems.push({
            id: generateId('img'),
            text,
            status: 'VERIFIED',
            source: 'image',
            confidence: 1.0,
            verifiedBy: 'Direct observable visual evidence',
            notes: 'Corroborated by attached photographic evidence',
          });
        } else {
          // Downgrade: Image was not supplied
          evidenceItems.push({
            id: generateId('inf'),
            text,
            status: 'INFERRED',
            source: 'system',
            confidence: 0.5,
            verifiedBy: null,
            notes: 'Downgraded: No image attachment was supplied to corroborate this claim',
          });
        }
        continue;
      }

      // RULE 3: If claimed source is "location", only verify if location context was actually supplied.
      if (fact.source === 'location') {
        if (hasLocation) {
          const accuracyStr = request.location?.accuracy ? ` (±${request.location.accuracy}m)` : '';
          evidenceItems.push({
            id: generateId('loc'),
            text,
            status: 'VERIFIED',
            source: 'location',
            confidence: 1.0,
            verifiedBy: `GPS location context${accuracyStr}`,
            notes: request.location?.label || 'GPS location sensor data',
          });
        } else {
          // Downgrade: Location was not supplied
          evidenceItems.push({
            id: generateId('user'),
            text,
            status: 'USER_REPORTED',
            source: 'text',
            confidence: null,
            verifiedBy: null,
            notes: 'Downgraded: GPS location was not attached in request',
          });
        }
        continue;
      }

      // RULE 4: If claimed source is "document", only verify if a document was actually attached.
      if (fact.source === 'document') {
        if (hasDocuments) {
          evidenceItems.push({
            id: generateId('doc'),
            text,
            status: 'VERIFIED',
            source: 'document',
            confidence: 1.0,
            verifiedBy: 'Attached document text/metadata',
            notes: 'Extracted from submitted document context',
          });
        } else {
          evidenceItems.push({
            id: generateId('user'),
            text,
            status: 'USER_REPORTED',
            source: 'text',
            confidence: null,
            verifiedBy: null,
            notes: 'Downgraded: No document attachment supplied',
          });
        }
        continue;
      }

      // Fallback
      evidenceItems.push({
        id: generateId('user'),
        text,
        status: 'USER_REPORTED',
        source: 'text',
        confidence: null,
        verifiedBy: null,
        notes: 'User-provided context',
      });
    }

    // 2. Process user-reported claims
    for (const claim of raw.userReported || []) {
      const text = claim.text.trim();
      if (!text) continue;

      evidenceItems.push({
        id: generateId('user'),
        text,
        status: 'USER_REPORTED',
        source: claim.source === 'image' && hasImages ? 'image' : 'text',
        confidence: null,
        verifiedBy: null,
        notes: 'Direct user statement awaiting independent verification',
      });
    }

    // 3. Process inferences (RULE: INFERENCES CAN NEVER BE MARKED AS VERIFIED)
    for (const inf of raw.inferences || []) {
      const text = inf.text.trim();
      if (!text) continue;

      evidenceItems.push({
        id: generateId('inf'),
        text,
        status: 'INFERRED',
        source: 'system',
        confidence: Math.min(Math.max(inf.confidence, 0), 1),
        verifiedBy: null,
        notes: 'Deduction derived from available evidence. Not a confirmed fact.',
      });
    }

    // 4. Process missing information as UNKNOWN evidence items
    for (const missing of raw.missingInformation || []) {
      const text = missing.trim();
      if (!text) continue;

      evidenceItems.push({
        id: generateId('unk'),
        text,
        status: 'UNKNOWN',
        source: 'system',
        confidence: null,
        verifiedBy: null,
        notes: 'Information required for complete certainty but currently unverified',
      });
    }

    // 5. Conflict Resolution & Detection
    // Check if user claimed an absolute fact that is explicitly uncertain or refuted by missing info
    const userStatements = evidenceItems.filter((e) => e.status === 'USER_REPORTED');
    const unknownStatements = evidenceItems.filter((e) => e.status === 'UNKNOWN');

    for (const userStmt of userStatements) {
      for (const unk of unknownStatements) {
        // If user asserts a closure/status that is declared as unknown/unverified
        const userLower = userStmt.text.toLowerCase();
        const unkLower = unk.text.toLowerCase();

        const sharesKeywords =
          (userLower.includes('clos') && unkLower.includes('clos')) ||
          (userLower.includes('flood') && unkLower.includes('flood')) ||
          (userLower.includes('power') && unkLower.includes('power')) ||
          (userLower.includes('leak') && unkLower.includes('leak')) ||
          (userLower.includes('injur') && unkLower.includes('injur'));

        if (sharesKeywords && (unkLower.includes('status') || unkLower.includes('whether') || unkLower.includes('official') || unkLower.includes('confirm'))) {
          conflicts.push({
            description: `Potential unverified discrepancy: User stated "${userStmt.text}" while verification status remains unconfirmed.`,
            competingClaims: [userStmt.text, unk.text],
            resolution:
              'Claim retained as USER_REPORTED. External confirmation required before escalating as verified fact.',
          });
        }
      }
    }

    // 6. Cross-reference External Context with User Statements
    for (const ctx of externalContext) {
      if (ctx.source === 'WEATHER') {
        const isClearOrNoRain = ctx.summary.toLowerCase().includes('precipitation: 0') || ctx.summary.toLowerCase().includes('clear sky');
        
        // Find user claims claiming rain or storm flooding
        for (const userItem of evidenceItems.filter((e) => e.status === 'USER_REPORTED')) {
          const lowerText = userItem.text.toLowerCase();
          if (
            (lowerText.includes('storm') ||
              lowerText.includes('heavy rain') ||
              lowerText.includes('rainfall') ||
              lowerText.includes('downpour') ||
              lowerText.includes('flood')) &&
            isClearOrNoRain
          ) {
            conflicts.push({
              description: `Meteorological telemetry conflict: User-reported storm flooding could not be independently confirmed by the available real-time meteorological context (${ctx.summary}).`,
              competingClaims: [userItem.text, ctx.summary],
              resolution:
                'User claim retained as USER_REPORTED. Water inundation may originate from internal plumbing rupture or localized drainage rather than active rainfall.',
            });
          }
        }
      }
    }

    // 7. Compute Verification Summary Metrics
    const verifiedCount = evidenceItems.filter((e) => e.status === 'VERIFIED').length;
    const userReportedCount = evidenceItems.filter((e) => e.status === 'USER_REPORTED').length;
    const inferredCount = evidenceItems.filter((e) => e.status === 'INFERRED').length;
    const unknownCount = evidenceItems.filter((e) => e.status === 'UNKNOWN').length;
    const totalEvidenceCount = evidenceItems.length;

    const verificationScore =
      totalEvidenceCount > 0 ? Number((verifiedCount / totalEvidenceCount).toFixed(2)) : 0;

    const verificationSummary: VerificationSummary = {
      verifiedCount,
      userReportedCount,
      inferredCount,
      unknownCount,
      totalEvidenceCount,
      verificationScore,
    };

    return {
      ...raw,
      evidence: evidenceItems,
      conflicts,
      verificationSummary,
      externalContext,
    };
  }
}

export const verificationEngine = new VerificationEngine();
