export interface ImageAttachment {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl: string;
  type: string;
}

export interface DocumentAttachment {
  id: string;
  file: File;
  name: string;
  size: number;
  extension: string;
  type: string;
}

export interface LocationContext {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
  label?: string;
}

export interface IntentPayload {
  id: string;
  text: string;
  images: ImageAttachment[];
  documents: DocumentAttachment[];
  location: LocationContext | null;
  hasVoiceTranscribed: boolean;
  createdAt: string;
}
