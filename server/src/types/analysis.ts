import { z } from 'zod';

export const ImageContextSchema = z.object({
  name: z.string().min(1),
  mimeType: z.string().min(1),
  base64Data: z.string().min(1), // Base64 encoded string without data URI prefix
  size: z.number().optional(),
});

export const DocumentContextSchema = z.object({
  name: z.string().min(1),
  mimeType: z.string().min(1),
  textContent: z.string().optional(),
  base64Data: z.string().optional(),
  extension: z.string().optional(),
  size: z.number().optional(),
});

export const LocationContextSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  accuracy: z.number().optional(),
  timestamp: z.string().optional(),
  label: z.string().optional(),
});

export const IntentAnalyzeRequestSchema = z.object({
  text: z.string().default(''),
  images: z.array(ImageContextSchema).default([]),
  documents: z.array(DocumentContextSchema).default([]),
  location: LocationContextSchema.nullable().optional().default(null),
}).refine(
  (data) =>
    data.text.trim().length > 0 ||
    data.images.length > 0 ||
    data.documents.length > 0 ||
    data.location !== null,
  {
    message: 'At least one input modality (text, image, document, or location) is required.',
  }
);

export type IntentAnalyzeRequest = z.infer<typeof IntentAnalyzeRequestSchema>;

// Phase 4 Source of Truth for Gemini Raw Output
export const AnalysisResponseSchema = z.object({
  situation: z.string().min(1),
  userIntent: z.string().min(1),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  confidence: z.number().min(0).max(1),
  facts: z.array(
    z.object({
      text: z.string().min(1),
      source: z.enum(['text', 'image', 'document', 'location']),
    })
  ),
  userReported: z.array(
    z.object({
      text: z.string().min(1),
      source: z.enum(['text', 'image', 'document']),
    })
  ),
  inferences: z.array(
    z.object({
      text: z.string().min(1),
      confidence: z.number().min(0).max(1),
    })
  ),
  risks: z.array(
    z.object({
      text: z.string().min(1),
      priority: z.enum(['low', 'medium', 'high', 'critical']),
    })
  ),
  missingInformation: z.array(z.string()),
});

export type AnalysisResult = z.infer<typeof AnalysisResponseSchema>;

// Phase 5: Normalized Evidence & Verification Model
export const EvidenceStatusSchema = z.enum([
  'VERIFIED',
  'USER_REPORTED',
  'INFERRED',
  'UNKNOWN',
]);
export type EvidenceStatus = z.infer<typeof EvidenceStatusSchema>;

export const EvidenceSourceSchema = z.enum([
  'text',
  'image',
  'document',
  'location',
  'system',
]);
export type EvidenceSource = z.infer<typeof EvidenceSourceSchema>;

export const EvidenceItemSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
  status: EvidenceStatusSchema,
  source: EvidenceSourceSchema,
  confidence: z.number().min(0).max(1).nullable().optional(),
  verifiedBy: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

export const EvidenceConflictSchema = z.object({
  description: z.string(),
  competingClaims: z.array(z.string()),
  resolution: z.string(),
});
export type EvidenceConflict = z.infer<typeof EvidenceConflictSchema>;

export const VerificationSummarySchema = z.object({
  verifiedCount: z.number(),
  userReportedCount: z.number(),
  inferredCount: z.number(),
  unknownCount: z.number(),
  totalEvidenceCount: z.number(),
  verificationScore: z.number(), // Ratio between 0 and 1
});
export type VerificationSummary = z.infer<typeof VerificationSummarySchema>;

// Phase 8: Real-World Context Model
export const ExternalContextItemSchema = z.object({
  id: z.string(),
  source: z.enum(['WEB', 'MAP', 'WEATHER']),
  title: z.string().min(1),
  summary: z.string().min(1),
  retrievedAt: z.string(),
  relevance: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  verificationStatus: z.enum(['VERIFIED', 'CONTEXT_ONLY', 'UNAVAILABLE']),
  sourceReference: z.string().optional(),
});
export type ExternalContextItem = z.infer<typeof ExternalContextItemSchema>;

export const NormalizedAnalysisSchema = AnalysisResponseSchema.extend({
  evidence: z.array(EvidenceItemSchema),
  conflicts: z.array(EvidenceConflictSchema),
  verificationSummary: VerificationSummarySchema,
  externalContext: z.array(ExternalContextItemSchema).optional().default([]),
});
export type NormalizedAnalysis = z.infer<typeof NormalizedAnalysisSchema>;
