import React, { useState, useRef, useEffect } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Camera,
  CheckCircle2,
  FileText,
  MapPin,
  Mic,
  MicOff,
  Paperclip,
  RefreshCw,
  Trash2,
  X,
  FileCheck,
} from 'lucide-react';
import type { CaseItem } from '../types/cases';
import type {
  ImageAttachment,
  DocumentAttachment,
  LocationContext,
  IntentPayload,
} from '../types/intent';
import {
  validateImageFile,
  validateDocumentFile,
  formatFileSize,
} from '../utils/fileValidation';
import {
  isSpeechRecognitionSupported,
  SpeechTranscriber,
} from '../utils/speechRecognition';

const MAX_TEXT_LENGTH = 2500;

interface HomeScreenProps {
  onNavigateToCases: () => void;
  recentCases: CaseItem[];
  onIntentCaptured?: (payload: IntentPayload) => void;
}

export function HomeScreen({
  onNavigateToCases,
  recentCases,
  onIntentCaptured,
}: HomeScreenProps) {
  // Main Draft State
  const [situationText, setSituationText] = useState('');
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [documents, setDocuments] = useState<DocumentAttachment[]>([]);
  const [location, setLocation] = useState<LocationContext | null>(null);
  const [hasVoiceTranscribed, setHasVoiceTranscribed] = useState(false);

  // Interaction / Transient states
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [capturedPayload, setCapturedPayload] = useState<IntentPayload | null>(null);

  // Status and Error states
  const [validationError, setValidationError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Hidden File Inputs Refs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const transcriberRef = useRef<SpeechTranscriber | null>(null);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      if (transcriberRef.current) {
        transcriberRef.current.stop();
      }
    };
  }, [images]);

  // Derived state: Is draft ready for "Understand"?
  const hasContent =
    situationText.trim().length > 0 ||
    images.length > 0 ||
    documents.length > 0 ||
    location !== null;

  // Clear transient error when user modifies content
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length <= MAX_TEXT_LENGTH) {
      setSituationText(val);
      if (validationError) setValidationError(null);
    }
  };

  // --- IMAGE ATTACHMENT HANDLERS ---
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAttachmentError(null);
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    const validation = validateImageFile(file);

    if (!validation.valid) {
      setAttachmentError(validation.error || 'Failed to attach image');
      e.target.value = '';
      return;
    }

    const newImage: ImageAttachment = {
      id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      file,
      name: file.name,
      size: file.size,
      previewUrl: URL.createObjectURL(file),
      type: file.type,
    };

    setImages((prev) => [...prev, newImage]);
    e.target.value = '';
    if (validationError) setValidationError(null);
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((img) => img.id !== id);
    });
  };

  // --- DOCUMENT ATTACHMENT HANDLERS ---
  const handleDocumentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAttachmentError(null);
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    const validation = validateDocumentFile(file);

    if (!validation.valid) {
      setAttachmentError(validation.error || 'Failed to attach document');
      e.target.value = '';
      return;
    }

    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    const newDoc: DocumentAttachment = {
      id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      file,
      name: file.name,
      size: file.size,
      extension,
      type: file.type || 'application/octet-stream',
    };

    setDocuments((prev) => [...prev, newDoc]);
    e.target.value = '';
    if (validationError) setValidationError(null);
  };

  const removeDocument = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  // --- LOCATION CONTEXT HANDLER ---
  const handleToggleLocation = () => {
    setLocationNotice(null);

    // If already attached, remove it
    if (location) {
      setLocation(null);
      return;
    }

    if (!('geolocation' in navigator)) {
      setLocationNotice('Location services are not supported by this browser.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const loc: LocationContext = {
          latitude: Number(pos.coords.latitude.toFixed(5)),
          longitude: Number(pos.coords.longitude.toFixed(5)),
          accuracy: Math.round(pos.coords.accuracy),
          timestamp: new Date().toISOString(),
          label: `GPS accurate to ±${Math.round(pos.coords.accuracy)}m`,
        };
        setLocation(loc);
        if (validationError) setValidationError(null);
      },
      (err) => {
        setIsLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationNotice(
            'Location permission was denied. You can continue describing your situation without location.'
          );
        } else {
          setLocationNotice('Unable to retrieve current location.');
        }
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  // --- VOICE-TO-TEXT HANDLER ---
  const handleToggleVoice = () => {
    setVoiceNotice(null);

    if (!isSpeechRecognitionSupported()) {
      setVoiceNotice('Voice recognition is not supported in this browser environment.');
      return;
    }

    if (isRecording) {
      if (transcriberRef.current) {
        transcriberRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    // Start recognition
    const transcriber = new SpeechTranscriber({
      onTranscript: (chunk) => {
        setSituationText((prev) => {
          const separator = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
          const nextVal = (prev + separator + chunk).slice(0, MAX_TEXT_LENGTH);
          return nextVal;
        });
        setHasVoiceTranscribed(true);
        if (validationError) setValidationError(null);
      },
      onError: (errMsg) => {
        setVoiceNotice(errMsg);
        setIsRecording(false);
      },
      onEnd: () => {
        setIsRecording(false);
      },
    });

    transcriberRef.current = transcriber;
    const started = transcriber.start();
    if (started) {
      setIsRecording(true);
    } else {
      setVoiceNotice('Could not access microphone. Please check browser permissions.');
      setIsRecording(false);
    }
  };

  // --- UNDERSTAND SUBMISSION ---
  const handleUnderstand = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!hasContent) {
      setValidationError('Please describe your situation or attach relevant context.');
      return;
    }

    // Stop active recording if running
    if (isRecording && transcriberRef.current) {
      transcriberRef.current.stop();
      setIsRecording(false);
    }

    setIsSubmitting(true);

    // Build structured internal intent payload
    const payload: IntentPayload = {
      id: `intent-${Date.now()}`,
      text: situationText.trim(),
      images,
      documents,
      location,
      hasVoiceTranscribed,
      createdAt: new Date().toISOString(),
    };

    // Simulate clean state transition boundary (prepared for Phase 4 Gemini intelligence)
    setTimeout(() => {
      setIsSubmitting(false);
      setCapturedPayload(payload);
      if (onIntentCaptured) {
        onIntentCaptured(payload);
      }
    }, 600);
  };

  const handleResetIntent = () => {
    setCapturedPayload(null);
    setSituationText('');
    setImages([]);
    setDocuments([]);
    setLocation(null);
    setHasVoiceTranscribed(false);
    setValidationError(null);
    setAttachmentError(null);
    setVoiceNotice(null);
    setLocationNotice(null);
  };

  // If intent was understood and is in analysis boundary:
  if (capturedPayload) {
    return (
      <div className="w-full px-4 pt-6 pb-28 max-w-md mx-auto space-y-6 animate-in fade-in duration-200">
        <header className="space-y-1">
          <span className="text-[11px] font-semibold tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Intent Captured
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900 pt-1">
            Situation Structured
          </h1>
          <p className="text-xs sm:text-sm text-stone-500">
            NEXUS has received and structured your context. Ready for analysis.
          </p>
        </header>

        {/* Structured Context Summary Card */}
        <div className="p-4 rounded-2xl bg-white border border-stone-200/90 shadow-xs space-y-4">
          <div className="space-y-1.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Described Situation
            </h2>
            <p className="text-sm text-stone-900 leading-relaxed bg-stone-50 p-3 rounded-xl border border-stone-100">
              {capturedPayload.text || '(No text description provided — attachments only)'}
            </p>
          </div>

          {/* Context attachments summary */}
          <div className="pt-2 border-t border-stone-100 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Verified Context Elements
            </h3>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {capturedPayload.images.length > 0 && (
                <span className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 font-medium inline-flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-stone-600" />
                  <span>{capturedPayload.images.length} photo(s) attached</span>
                </span>
              )}
              {capturedPayload.documents.length > 0 && (
                <span className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 font-medium inline-flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-stone-600" />
                  <span>{capturedPayload.documents.length} document(s) attached</span>
                </span>
              )}
              {capturedPayload.location && (
                <span className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 font-medium inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-stone-600" />
                  <span>{capturedPayload.location.label || 'Location attached'}</span>
                </span>
              )}
              {capturedPayload.hasVoiceTranscribed && (
                <span className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 font-medium inline-flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-stone-600" />
                  <span>Voice transcribed</span>
                </span>
              )}
            </div>
          </div>

          {/* Next phase notice */}
          <div className="p-3 rounded-xl bg-stone-100 text-stone-600 text-xs flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-stone-500" />
            <span>Payload packaged. Awaiting Phase 4 Gemini intelligence pipeline.</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleResetIntent}
            className="w-full h-12 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-sm font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
          >
            <Trash2 className="w-4 h-4 text-stone-500" />
            <span>Submit Another Situation</span>
          </button>
          <button
            type="button"
            onClick={onNavigateToCases}
            className="w-full h-12 rounded-xl bg-stone-900 text-stone-50 text-sm font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            <span>View Active Cases</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 pt-6 pb-28 max-w-md mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Hidden File Pickers */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/gif"
        onChange={handleImageSelect}
        className="hidden"
        aria-label="Upload photo"
      />
      <input
        ref={docInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,.csv,.rtf"
        onChange={handleDocumentSelect}
        className="hidden"
        aria-label="Upload document"
      />

      {/* Central inquiry */}
      <header className="space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-stone-900">
          What do you need help with?
        </h1>
        <p className="text-xs sm:text-sm text-stone-500 leading-relaxed">
          Describe any situation, disruption, or document. Add photos, records, or voice notes for context.
        </p>
      </header>

      {/* Error & Non-blocking Notice Banners */}
      {validationError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-in fade-in duration-150">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />
          <span className="flex-1">{validationError}</span>
        </div>
      )}

      {attachmentError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-in fade-in duration-150">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />
          <span className="flex-1">{attachmentError}</span>
          <button
            type="button"
            onClick={() => setAttachmentError(null)}
            className="text-rose-500 hover:text-rose-800"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {voiceNotice && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2 animate-in fade-in duration-150">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-700" />
          <span className="flex-1">{voiceNotice}</span>
          <button
            type="button"
            onClick={() => setVoiceNotice(null)}
            className="text-amber-600 hover:text-amber-900"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {locationNotice && (
        <div className="p-3 rounded-xl bg-stone-100 border border-stone-200 text-stone-700 text-xs flex items-start gap-2 animate-in fade-in duration-150">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-stone-500" />
          <span className="flex-1">{locationNotice}</span>
          <button
            type="button"
            onClick={() => setLocationNotice(null)}
            className="text-stone-400 hover:text-stone-700"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Primary Unified Intent Composer */}
      <form
        onSubmit={handleUnderstand}
        className="rounded-2xl bg-white border border-stone-200/90 shadow-sm focus-within:border-stone-400 focus-within:ring-2 focus-within:ring-stone-900/5 transition-all p-4 space-y-3"
      >
        {/* Active Voice Listening Banner */}
        {isRecording && (
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-800 text-xs animate-pulse">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-600" />
              <span className="font-medium">Listening to your voice...</span>
            </div>
            <button
              type="button"
              onClick={handleToggleVoice}
              className="font-semibold text-rose-900 hover:underline inline-flex items-center gap-1"
            >
              <MicOff className="w-3 h-3" />
              <span>Stop</span>
            </button>
          </div>
        )}

        {/* Text Area */}
        <div className="min-h-[130px]">
          <textarea
            value={situationText}
            onChange={handleTextChange}
            placeholder="Describe what happened or what you need to resolve..."
            rows={5}
            className="w-full resize-none bg-transparent border-0 p-0 text-stone-900 placeholder:text-stone-400 text-sm sm:text-base leading-relaxed focus:outline-none focus:ring-0"
          />
        </div>

        {/* Attached Context Review Area (Images, Documents, Location) */}
        {(images.length > 0 || documents.length > 0 || location) && (
          <div className="pt-2 pb-1 border-t border-stone-100 space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Attached Context ({images.length + documents.length + (location ? 1 : 0)})
            </span>

            {/* Images Grid */}
            {images.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className="relative group rounded-xl border border-stone-200 overflow-hidden bg-stone-50 flex items-center p-1.5 gap-2"
                  >
                    <img
                      src={img.previewUrl}
                      alt={img.name}
                      className="w-10 h-10 object-cover rounded-lg shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-stone-800 truncate">{img.name}</p>
                      <p className="text-[10px] text-stone-400">{formatFileSize(img.size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeImage(img.id)}
                      aria-label={`Remove ${img.name}`}
                      className="p-1 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-200/60"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Documents List */}
            {documents.length > 0 && (
              <div className="space-y-1.5">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-stone-50 border border-stone-200 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileCheck className="w-4 h-4 text-stone-500 shrink-0" />
                      <div className="truncate">
                        <span className="font-medium text-stone-800">{doc.name}</span>
                        <span className="text-[10px] text-stone-400 ml-1.5">
                          ({formatFileSize(doc.size)})
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDocument(doc.id)}
                      aria-label={`Remove ${doc.name}`}
                      className="p-1 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 shrink-0 ml-2"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Location Pill */}
            {location && (
              <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-stone-100 border border-stone-200 text-xs text-stone-800">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-stone-600 shrink-0" />
                  <span className="font-medium">{location.label}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLocation(null)}
                  aria-label="Remove location"
                  className="p-1 text-stone-400 hover:text-stone-700"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Character Count & Bottom Attachment Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-stone-100">
          {/* Attachment Context Entry Points */}
          <div className="flex items-center gap-1 text-stone-500">
            {/* Voice Input */}
            <button
              type="button"
              onClick={handleToggleVoice}
              title={isRecording ? 'Stop recording' : 'Speak situation'}
              aria-label={isRecording ? 'Stop recording' : 'Speak situation'}
              className={`p-2.5 rounded-xl transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center cursor-pointer ${
                isRecording
                  ? 'bg-rose-600 text-white'
                  : 'hover:bg-stone-100 text-stone-500 hover:text-stone-900'
              }`}
            >
              <Mic className="w-4 h-4" />
            </button>

            {/* Image Picker */}
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              title="Attach photo"
              aria-label="Attach photo"
              className={`p-2.5 rounded-xl transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center cursor-pointer ${
                images.length > 0
                  ? 'bg-stone-900 text-stone-50'
                  : 'hover:bg-stone-100 text-stone-500 hover:text-stone-900'
              }`}
            >
              <Camera className="w-4 h-4" />
            </button>

            {/* Document Picker */}
            <button
              type="button"
              onClick={() => docInputRef.current?.click()}
              title="Attach document"
              aria-label="Attach document"
              className={`p-2.5 rounded-xl transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center cursor-pointer ${
                documents.length > 0
                  ? 'bg-stone-900 text-stone-50'
                  : 'hover:bg-stone-100 text-stone-500 hover:text-stone-900'
              }`}
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Location Context */}
            <button
              type="button"
              onClick={handleToggleLocation}
              disabled={isLocating}
              title={location ? 'Remove location' : 'Attach location'}
              aria-label={location ? 'Remove location' : 'Attach location'}
              className={`p-2.5 rounded-xl transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center cursor-pointer ${
                location
                  ? 'bg-stone-900 text-stone-50'
                  : 'hover:bg-stone-100 text-stone-500 hover:text-stone-900'
              }`}
            >
              {isLocating ? (
                <RefreshCw className="w-4 h-4 animate-spin text-stone-400" />
              ) : (
                <MapPin className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Character counter (shows when typing) */}
          {situationText.length > 0 && (
            <span
              className={`text-[11px] font-mono ${
                situationText.length > MAX_TEXT_LENGTH - 100
                  ? 'text-rose-600 font-semibold'
                  : 'text-stone-400'
              }`}
            >
              {situationText.length}/{MAX_TEXT_LENGTH}
            </span>
          )}
        </div>

        {/* Primary Action Button: "Understand" */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={!hasContent || isSubmitting}
            className="w-full h-12 rounded-xl bg-stone-900 text-stone-50 font-medium text-sm flex items-center justify-center gap-2 hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Structuring situation...</span>
              </>
            ) : (
              <>
                <span>Understand</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Contextual Recent Activity */}
      {recentCases.length > 0 && (
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Recent Activity
            </h2>
            <button
              type="button"
              onClick={onNavigateToCases}
              className="text-xs font-medium text-stone-600 hover:text-stone-900 transition-colors"
            >
              View all cases
            </button>
          </div>

          <div className="space-y-2.5">
            {recentCases.slice(0, 2).map((item) => (
              <div
                key={item.id}
                onClick={onNavigateToCases}
                className="group p-4 rounded-xl bg-white border border-stone-200/80 hover:border-stone-300 transition-all cursor-pointer shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-stone-100 text-stone-600">
                      {item.situationType}
                    </span>
                    <h3 className="text-sm font-medium text-stone-900 group-hover:text-stone-700 truncate">
                      {item.title}
                    </h3>
                  </div>
                  <span className="text-[11px] text-stone-400 shrink-0">
                    {item.updatedAt}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
