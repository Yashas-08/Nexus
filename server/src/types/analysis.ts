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

// Source of Truth for Gemini Analysis Output
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
