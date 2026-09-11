export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/gif',
];

export const ALLOWED_DOCUMENT_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.txt',
  '.csv',
  '.rtf',
];

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
    return {
      valid: false,
      error: `Unsupported image format (${file.type || 'unknown'}). Please attach JPEG, PNG, WEBP, or HEIC.`,
    };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Image exceeds maximum allowed size of 10MB (${formatFileSize(file.size)}).`,
    };
  }

  return { valid: true };
}

export function validateDocumentFile(file: File): { valid: boolean; error?: string } {
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();

  const isAllowedExt = ALLOWED_DOCUMENT_EXTENSIONS.includes(extension);
  const isAllowedMime =
    file.type.includes('pdf') ||
    file.type.includes('word') ||
    file.type.includes('text') ||
    file.type.includes('csv') ||
    file.type === 'application/msword' ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  if (!isAllowedExt && !isAllowedMime) {
    return {
      valid: false,
      error: `Unsupported document format (${extension}). Please attach PDF, DOC, DOCX, TXT, or CSV.`,
    };
  }

  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return {
      valid: false,
      error: `Document exceeds maximum allowed size of 20MB (${formatFileSize(file.size)}).`,
    };
  }

  return { valid: true };
}
