import type { IntentPayload } from '../types/intent';
import type { NormalizedAnalysis } from '../types/analysis';

export interface HealthStatus {
  status: string;
  message: string;
  timestamp: string;
  uptime: number;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export async function checkHealth(): Promise<HealthStatus> {
  const response = await fetch(`${API_BASE_URL}/api/health`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`API health check failed with status ${response.status}`);
  }

  return response.json();
}

/**
 * Utility: Convert a File into a clean Base64 string without data URI prefix.
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Utility: Extract text content from text/csv files when readable.
 */
export async function fileToText(file: File): Promise<string | undefined> {
  if (
    file.type.includes('text') ||
    file.type.includes('csv') ||
    file.name.endsWith('.txt') ||
    file.name.endsWith('.csv')
  ) {
    try {
      return await file.text();
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Sends structured intent draft to the backend Gemini service for multimodal analysis.
 */
export async function analyzeIntent(payload: IntentPayload): Promise<NormalizedAnalysis> {
  // 1. Process images into base64 payloads
  const images = await Promise.all(
    payload.images.map(async (img) => ({
      name: img.name,
      mimeType: img.type || 'image/jpeg',
      base64Data: await fileToBase64(img.file),
      size: img.size,
    }))
  );

  // 2. Process documents
  const documents = await Promise.all(
    payload.documents.map(async (doc) => {
      const textContent = await fileToText(doc.file);
      return {
        name: doc.name,
        mimeType: doc.type || 'application/octet-stream',
        textContent,
        extension: doc.extension,
        size: doc.size,
      };
    })
  );

  // 3. Format location context
  const location = payload.location
    ? {
        latitude: payload.location.latitude,
        longitude: payload.location.longitude,
        accuracy: payload.location.accuracy,
        timestamp: payload.location.timestamp,
        label: payload.location.label,
      }
    : null;

  const requestBody = {
    text: payload.text,
    images,
    documents,
    location,
  };

  const response = await fetch(`${API_BASE_URL}/api/intent/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const responseJson = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg =
      responseJson?.message ||
      `Analysis request failed with status ${response.status}. Please check your connection and try again.`;
    throw new Error(errorMsg);
  }

  if (!responseJson || responseJson.status !== 'success' || !responseJson.data) {
    throw new Error('Received unexpected or malformed response from analysis service.');
  }

  return responseJson.data as NormalizedAnalysis;
}
