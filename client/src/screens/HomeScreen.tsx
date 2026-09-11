import React, { useState, useRef, useEffect } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  CloudRain,
  ExternalLink,
  FileCheck,
  FileText,
  Globe,
  HelpCircle,
  Info,
  MapPin,
  Mic,
  MicOff,
  Paperclip,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { CaseItem } from '../types/cases';
import type {
  ImageAttachment,
  DocumentAttachment,
  LocationContext,
  IntentPayload,
} from '../types/intent';
import type { NormalizedAnalysis, SeverityLevel } from '../types/analysis';
import type { RiskLevel, UrgencyLevel } from '../types/risk';
import type { ActionCategory, ActionPriority, ActionStatus } from '../types/actions';
import { assessRisk } from '../services/riskEngine';
import { generateActionGraph } from '../services/actionEngine';
import {
  validateImageFile,
  validateDocumentFile,
  formatFileSize,
} from '../utils/fileValidation';
import {
  isSpeechRecognitionSupported,
  SpeechTranscriber,
} from '../utils/speechRecognition';
import { analyzeIntent } from '../services/api';

const MAX_TEXT_LENGTH = 2500;

interface HomeScreenProps {
  onNavigateToCases: () => void;
  recentCases: CaseItem[];
}

export function HomeScreen({
  onNavigateToCases,
  recentCases,
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
  const [analysisResult, setAnalysisResult] = useState<NormalizedAnalysis | null>(null);
  const [actionOverrides, setActionOverrides] = useState<Record<string, ActionStatus>>({});

  // Status and Error states
  const [validationError, setValidationError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
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
      if (submitError) setSubmitError(null);
    }
  };

  // --- IMAGE ATTACHMENT HANDLERS ---
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAttachmentError(null);
    setSubmitError(null);
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
    setSubmitError(null);
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
    setSubmitError(null);

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
    setSubmitError(null);

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

  // --- UNDERSTAND SUBMISSION (CALLS GEMINI BACKEND) ---
  const handleUnderstand = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setSubmitError(null);

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

    // Construct client intent payload
    const payload: IntentPayload = {
      id: `intent-${Date.now()}`,
      text: situationText.trim(),
      images,
      documents,
      location,
      hasVoiceTranscribed,
      createdAt: new Date().toISOString(),
    };

    try {
      const result = await analyzeIntent(payload);
      setAnalysisResult(result);
    } catch (err: any) {
      console.error('[Understand] Analysis error:', err);
      setSubmitError(
        err?.message || 'Failed to analyze situation. Please check your connection and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartFresh = () => {
    setAnalysisResult(null);
    setActionOverrides({});
    setSituationText('');
    setImages([]);
    setDocuments([]);
    setLocation(null);
    setHasVoiceTranscribed(false);
    setValidationError(null);
    setAttachmentError(null);
    setVoiceNotice(null);
    setLocationNotice(null);
    setSubmitError(null);
  };

  const handleEditSituation = () => {
    // Returns to composer while keeping all draft fields intact
    setAnalysisResult(null);
    setActionOverrides({});
    setSubmitError(null);
  };

  const handleApproveAction = (id: string) => {
    setActionOverrides((prev) => ({ ...prev, [id]: 'APPROVED' }));
  };

  const handleDismissAction = (id: string) => {
    setActionOverrides((prev) => ({ ...prev, [id]: 'DISMISSED' }));
  };

  const handleResetAction = (id: string) => {
    setActionOverrides((prev) => ({ ...prev, [id]: 'RECOMMENDED' }));
  };

  const getSeverityBadge = (severity: SeverityLevel) => {
    switch (severity) {
      case 'critical':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200 inline-flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" />
            Critical Severity
          </span>
        );
      case 'high':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            High Severity
          </span>
        );
      case 'medium':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-700 border border-stone-200 inline-flex items-center gap-1">
            <Info className="w-3 h-3" />
            Medium Severity
          </span>
        );
      case 'low':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-600 border border-stone-200 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Low Severity
          </span>
        );
    }
  };

  const getRiskLevelBadge = (level: RiskLevel) => {
    switch (level) {
      case 'CRITICAL':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200 inline-flex items-center gap-1">
            <ShieldAlert className="w-3 h-3 text-rose-600" />
            Critical Risk
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            High Risk
          </span>
        );
      case 'MODERATE':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-700 border border-stone-200 inline-flex items-center gap-1">
            <Info className="w-3 h-3 text-stone-500" />
            Moderate Risk
          </span>
        );
      case 'LOW':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-600 border border-stone-200 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-stone-500" />
            Low Risk
          </span>
        );
    }
  };

  const getUrgencyBadge = (urgency: UrgencyLevel) => {
    switch (urgency) {
      case 'IMMEDIATE':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-900 border border-rose-300">
            Immediate Action
          </span>
        );
      case 'URGENT':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
            Urgent Priority
          </span>
        );
      case 'SOON':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-800 border border-stone-300">
            Soon
          </span>
        );
      case 'ROUTINE':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-600 border border-stone-200">
            Routine
          </span>
        );
    }
  };

  const getActionCategoryBadge = (category: ActionCategory) => {
    switch (category) {
      case 'SAFETY':
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-tight">
            Safety
          </span>
        );
      case 'CONTACT':
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-tight">
            Contact
          </span>
        );
      case 'INFORMATION':
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-tight">
            Information
          </span>
        );
      case 'DOCUMENT':
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 uppercase tracking-tight">
            Document
          </span>
        );
      case 'FOLLOW_UP':
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200 uppercase tracking-tight">
            Follow Up
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200 uppercase tracking-tight">
            {category}
          </span>
        );
    }
  };

  const getActionPriorityBadge = (priority: ActionPriority) => {
    switch (priority) {
      case 'CRITICAL':
        return (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
            Critical
          </span>
        );
      case 'HIGH':
        return (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
            High
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200">
            Medium
          </span>
        );
      case 'LOW':
        return (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 border border-stone-200">
            Low
          </span>
        );
    }
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'image':
        return (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 inline-flex items-center gap-1">
            <Camera className="w-2.5 h-2.5" />
            Photo
          </span>
        );
      case 'document':
        return (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100 inline-flex items-center gap-1">
            <FileText className="w-2.5 h-2.5" />
            Doc
          </span>
        );
      case 'location':
        return (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 inline-flex items-center gap-1">
            <MapPin className="w-2.5 h-2.5" />
            GPS
          </span>
        );
      case 'system':
        return (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-100 inline-flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5" />
            System
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200">
            Text
          </span>
        );
    }
  };

  const getExternalSourceBadge = (source: string) => {
    switch (source) {
      case 'WEATHER':
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 inline-flex items-center gap-1">
            <CloudRain className="w-3 h-3 text-sky-600" />
            Weather Telemetry
          </span>
        );
      case 'MAP':
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
            <MapPin className="w-3 h-3 text-emerald-600" />
            Civic Map
          </span>
        );
      case 'WEB':
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 inline-flex items-center gap-1">
            <Globe className="w-3 h-3 text-purple-600" />
            Public Web
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 border border-stone-200 inline-flex items-center gap-1">
            <Globe className="w-3 h-3 text-stone-600" />
            {source}
          </span>
        );
    }
  };

  const getExternalVerificationBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
            Verified
          </span>
        );
      case 'PARTIALLY_CORROBORATED':
        return (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
            Partially Corroborated
          </span>
        );
      case 'CONFLICTING':
        return (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
            Discrepancy
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200">
            Unverified
          </span>
        );
    }
  };

  // --- RENDER ANALYSIS PRESENTATION (AFTER SUCCESSFUL UNDERSTANDING) ---
  if (analysisResult) {
    const riskAssessment = assessRisk(analysisResult);
    const rawActionGraph = generateActionGraph(analysisResult, riskAssessment);
    const actions = rawActionGraph.actions.map((act) => ({
      ...act,
      status: actionOverrides[act.id] || act.status,
    }));
    const activeActions = actions.filter((a) => a.status !== 'DISMISSED');
    const dismissedActions = actions.filter((a) => a.status === 'DISMISSED');

    const verifiedItems = analysisResult.evidence
      ? analysisResult.evidence.filter((e) => e.status === 'VERIFIED')
      : [];
    const userReportedItems = analysisResult.evidence
      ? analysisResult.evidence.filter((e) => e.status === 'USER_REPORTED')
      : [];
    const inferredItems = analysisResult.evidence
      ? analysisResult.evidence.filter((e) => e.status === 'INFERRED')
      : [];
    const unknownItems = analysisResult.evidence
      ? analysisResult.evidence.filter((e) => e.status === 'UNKNOWN')
      : [];

    return (
      <div className="w-full px-4 pt-6 pb-28 max-w-md mx-auto space-y-5 animate-in fade-in duration-200">
        {/* Header with Classification Status & Confidence */}
        <header className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Verified Understanding
            </span>
            <span className="text-xs font-medium text-stone-500">
              {Math.round(analysisResult.confidence * 100)}% Confidence
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Situation Understood
          </h1>
          <p className="text-xs sm:text-sm text-stone-500">
            Evidence classified deterministically into verified facts, claims, inferences, and unknowns.
          </p>
        </header>

        {/* Situation Overview Card */}
        <section className="p-4 rounded-2xl bg-white border border-stone-200/90 shadow-xs space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 flex-1">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                Identified Situation
              </h2>
              <p className="text-base font-semibold text-stone-900 leading-snug">
                {analysisResult.situation}
              </p>
            </div>
            <div className="shrink-0">{getSeverityBadge(analysisResult.severity)}</div>
          </div>

          <div className="pt-2 border-t border-stone-100 space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              User Intent
            </h3>
            <p className="text-xs sm:text-sm text-stone-700 leading-relaxed">
              {analysisResult.userIntent}
            </p>
          </div>
        </section>

        {/* Risk & Priority Assessment Card */}
        {riskAssessment && (
          <section className="p-4 rounded-2xl bg-white border border-stone-200/90 shadow-xs space-y-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-stone-700" />
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-700">
                    Risk & Priority Assessment
                  </h2>
                </div>
                <div className="flex items-center gap-2 pt-0.5">
                  {getRiskLevelBadge(riskAssessment.level)}
                  {getUrgencyBadge(riskAssessment.urgency)}
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="block text-lg font-bold text-stone-900 font-mono">
                  {riskAssessment.score}
                  <span className="text-xs font-normal text-stone-400">/100</span>
                </span>
                <span className="block text-[10px] uppercase tracking-wider text-stone-400 font-medium">
                  Risk Score
                </span>
              </div>
            </div>

            {/* Evidence Confidence Tag & Context */}
            <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/80 flex items-center justify-between text-xs gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Info className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                <span className="text-stone-600 text-[11px] truncate">
                  Evidence Confidence:
                </span>
                <span className="font-semibold text-stone-800 text-[11px]">
                  {riskAssessment.evidenceConfidence}
                </span>
              </div>
              <span className="text-[10px] text-stone-400 shrink-0">
                {riskAssessment.evidenceConfidence === 'CONFIRMED'
                  ? 'Sensor & Document Backed'
                  : riskAssessment.evidenceConfidence === 'LIMITED'
                  ? 'User-Reported Narrative'
                  : riskAssessment.evidenceConfidence === 'SUBSTANTIAL'
                  ? 'Partially Corroborated'
                  : 'Incomplete Information'}
              </span>
            </div>

            {/* Key Risk Factors */}
            {riskAssessment.factors.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                  Identified Risk Factors ({riskAssessment.factors.length})
                </h3>
                <div className="space-y-1.5">
                  {riskAssessment.factors.map((factor, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-xl bg-stone-50/70 border border-stone-200/70 flex items-start justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <span className="font-medium text-stone-800 block">
                          {factor.label}
                        </span>
                        {factor.detail && (
                          <p className="text-[10px] text-stone-500 truncate">
                            {factor.detail}
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md shrink-0 uppercase tracking-tight ${
                          factor.impact === 'HIGH'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : factor.impact === 'MEDIUM'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-stone-100 text-stone-600 border border-stone-200'
                        }`}
                      >
                        {factor.impact} Impact
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Concise Reasoning */}
            {riskAssessment.reasoning.length > 0 && (
              <div className="space-y-1.5 pt-1 border-t border-stone-100">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                  Assessment Reasoning
                </h3>
                <ul className="space-y-1 text-xs text-stone-700">
                  {riskAssessment.reasoning.map((r, idx) => (
                    <li key={idx} className="flex items-start gap-1.5 leading-relaxed">
                      <span className="text-stone-400 font-bold mt-0.5">&bull;</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Restrained Safety Advisory Footnote */}
            <p className="text-[10px] text-stone-400 pt-1 leading-normal border-t border-stone-100">
              Assessment derived deterministically from available reported context. For active life threats or hazards, contact local emergency services directly.
            </p>
          </section>
        )}

        {/* Next Steps: Prioritized Decision Action Graph */}
        {actions.length > 0 && (
          <section className="p-4 rounded-2xl bg-white border border-stone-200/90 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-stone-800" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-700">
                  Next Steps
                </h2>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
                {activeActions.length} Recommended Action{activeActions.length === 1 ? '' : 's'}
              </span>
            </div>

            <p className="text-[11px] text-stone-500 leading-relaxed -mt-1">
              Prioritized decision flow based on risk level and available evidence.
            </p>

            {/* Active Actions Flow */}
            <div className="space-y-3">
              {activeActions.map((action, idx) => {
                const isPrimary = idx === 0 && action.priority !== 'LOW';
                const isApproved = action.status === 'APPROVED';

                return (
                  <div
                    key={action.id}
                    className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                      isApproved
                        ? 'bg-emerald-50/40 border-emerald-200/90'
                        : isPrimary
                        ? 'bg-stone-50/90 border-stone-300 shadow-2xs'
                        : 'bg-white border-stone-200/90'
                    }`}
                  >
                    {/* Header line: Category & Priority */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {getActionCategoryBadge(action.category)}
                        {getActionPriorityBadge(action.priority)}
                      </div>
                      {action.requiresApproval && !isApproved && (
                        <span className="text-[10px] font-medium text-stone-400">
                          Requires Approval
                        </span>
                      )}
                    </div>

                    {/* Action Title & Description */}
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-stone-900 leading-snug">
                        {action.title}
                      </h3>
                      <p className="text-xs text-stone-600 leading-relaxed">
                        {action.description}
                      </p>
                    </div>

                    {/* Rationale Disclosure */}
                    <div className="p-2 rounded-lg bg-stone-100/70 border border-stone-200/60 text-[11px] text-stone-600 leading-normal">
                      <span className="font-medium text-stone-700">Rationale: </span>
                      <span>{action.rationale}</span>
                    </div>

                    {/* Interaction & Approval State */}
                    <div className="pt-1 flex items-center justify-between gap-2 border-t border-stone-100">
                      {isApproved ? (
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-1.5 text-emerald-800 text-xs font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Approved &mdash; Ready to proceed</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleResetAction(action.id)}
                            className="text-[11px] text-stone-400 hover:text-stone-700 cursor-pointer underline"
                          >
                            Reset
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between w-full">
                          {action.requiresApproval ? (
                            <button
                              type="button"
                              onClick={() => handleApproveAction(action.id)}
                              className="h-8 px-3 rounded-lg bg-stone-900 text-stone-50 text-xs font-medium hover:bg-stone-800 transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5"
                            >
                              <span>Approve</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          ) : (
                            <span className="text-[11px] text-stone-400 italic">
                              Precautionary guideline
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDismissAction(action.id)}
                            className="h-8 px-2.5 rounded-lg text-stone-400 hover:text-stone-700 text-xs transition-colors cursor-pointer"
                          >
                            Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Dismissed Actions Accordion / Recovery */}
            {dismissedActions.length > 0 && (
              <div className="pt-2 border-t border-stone-100 text-xs space-y-1.5">
                <span className="text-[11px] text-stone-400 block font-medium">
                  Dismissed Actions ({dismissedActions.length})
                </span>
                <div className="space-y-1">
                  {dismissedActions.map((action) => (
                    <div
                      key={action.id}
                      className="p-2 rounded-lg bg-stone-50 border border-stone-200/60 flex items-center justify-between gap-2 text-stone-500 text-xs"
                    >
                      <span className="line-through truncate flex-1">{action.title}</span>
                      <button
                        type="button"
                        onClick={() => handleResetAction(action.id)}
                        className="text-[11px] font-medium text-stone-600 hover:text-stone-900 cursor-pointer shrink-0 underline"
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Real-World Context & External Verification Card */}
        {analysisResult.externalContext && analysisResult.externalContext.length > 0 && (
          <section className="p-4 rounded-2xl bg-white border border-stone-200/90 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-stone-800" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-700">
                  Real-World Context
                </h2>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
                {analysisResult.externalContext.length} Source{analysisResult.externalContext.length === 1 ? '' : 's'}
              </span>
            </div>

            <p className="text-[11px] text-stone-500 leading-relaxed -mt-1">
              Live independent context retrieved to verify situation conditions and surroundings.
            </p>

            <div className="space-y-2.5">
              {analysisResult.externalContext.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl border border-stone-200/80 bg-stone-50/50 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {getExternalSourceBadge(item.source)}
                      {getExternalVerificationBadge(item.verificationStatus)}
                    </div>
                    <span className="text-[10px] text-stone-400 font-mono shrink-0">
                      {new Date(item.retrievedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <h3 className="text-xs font-semibold text-stone-900 leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-xs text-stone-600 leading-relaxed">
                      {item.summary}
                    </p>
                  </div>

                  {item.sourceReference && (
                    <div className="pt-1 border-t border-stone-200/50 flex items-center justify-between text-[10px] text-stone-400">
                      <span className="truncate pr-2">Ref: {item.sourceReference}</span>
                      <ExternalLink className="w-2.5 h-2.5 shrink-0 text-stone-400" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Verification Summary Audit Bar */}
        {analysisResult.verificationSummary && (
          <section className="p-4 rounded-2xl bg-white border border-stone-200/90 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-700">
                  Verification Audit
                </h2>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
                {Math.round(analysisResult.verificationSummary.verificationScore * 100)}% Verified
              </span>
            </div>

            {/* Segmented Distribution Bar */}
            <div className="h-2 w-full rounded-full bg-stone-100 overflow-hidden flex">
              {analysisResult.verificationSummary.totalEvidenceCount > 0 ? (
                <>
                  <div
                    style={{
                      width: `${(analysisResult.verificationSummary.verifiedCount / analysisResult.verificationSummary.totalEvidenceCount) * 100}%`,
                    }}
                    className="bg-emerald-500 h-full transition-all"
                    title={`Verified: ${analysisResult.verificationSummary.verifiedCount}`}
                  />
                  <div
                    style={{
                      width: `${(analysisResult.verificationSummary.userReportedCount / analysisResult.verificationSummary.totalEvidenceCount) * 100}%`,
                    }}
                    className="bg-stone-400 h-full transition-all"
                    title={`User-Reported: ${analysisResult.verificationSummary.userReportedCount}`}
                  />
                  <div
                    style={{
                      width: `${(analysisResult.verificationSummary.inferredCount / analysisResult.verificationSummary.totalEvidenceCount) * 100}%`,
                    }}
                    className="bg-violet-400 h-full transition-all"
                    title={`Inferred: ${analysisResult.verificationSummary.inferredCount}`}
                  />
                  <div
                    style={{
                      width: `${(analysisResult.verificationSummary.unknownCount / analysisResult.verificationSummary.totalEvidenceCount) * 100}%`,
                    }}
                    className="bg-amber-300 h-full transition-all"
                    title={`Unknown: ${analysisResult.verificationSummary.unknownCount}`}
                  />
                </>
              ) : (
                <div className="w-full bg-stone-200 h-full" />
              )}
            </div>

            {/* Counts grid */}
            <div className="grid grid-cols-4 gap-1.5 pt-1 text-center">
              <div className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-100">
                <span className="block text-base font-bold text-emerald-800">
                  {analysisResult.verificationSummary.verifiedCount}
                </span>
                <span className="block text-[10px] font-medium text-emerald-700 uppercase tracking-tight">
                  Verified
                </span>
              </div>
              <div className="p-2 rounded-xl bg-stone-50 border border-stone-200">
                <span className="block text-base font-bold text-stone-800">
                  {analysisResult.verificationSummary.userReportedCount}
                </span>
                <span className="block text-[10px] font-medium text-stone-600 uppercase tracking-tight">
                  Reported
                </span>
              </div>
              <div className="p-2 rounded-xl bg-violet-50/70 border border-violet-100">
                <span className="block text-base font-bold text-violet-800">
                  {analysisResult.verificationSummary.inferredCount}
                </span>
                <span className="block text-[10px] font-medium text-violet-700 uppercase tracking-tight">
                  Inferred
                </span>
              </div>
              <div className="p-2 rounded-xl bg-amber-50/70 border border-amber-100">
                <span className="block text-base font-bold text-amber-800">
                  {analysisResult.verificationSummary.unknownCount}
                </span>
                <span className="block text-[10px] font-medium text-amber-700 uppercase tracking-tight">
                  Unknown
                </span>
              </div>
            </div>
          </section>
        )}

        {/* Conflicts Banner (Discrepancies identified) */}
        {analysisResult.conflicts && analysisResult.conflicts.length > 0 && (
          <section className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200/90 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <h3 className="text-xs font-semibold uppercase tracking-wider">
                Discrepancies Identified ({analysisResult.conflicts.length})
              </h3>
            </div>
            <div className="space-y-2.5">
              {analysisResult.conflicts.map((conflict, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-white border border-amber-200/70 text-xs space-y-1.5">
                  <p className="font-semibold text-amber-900">{conflict.description}</p>
                  {conflict.competingClaims.length > 0 && (
                    <div className="space-y-0.5 text-stone-600 pl-2 border-l border-amber-300">
                      {conflict.competingClaims.map((claim, cIdx) => (
                        <p key={cIdx} className="text-[11px]">&bull; {claim}</p>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-amber-800 font-medium pt-0.5">
                    Recommended Resolution: {conflict.resolution}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Tier 1: VERIFIED Evidence */}
        {verifiedItems.length > 0 && (
          <section className="p-4 rounded-2xl bg-white border border-stone-200/90 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-800">
                  Verified Evidence ({verifiedItems.length})
                </h3>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Corroborated
              </span>
            </div>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              Objectively corroborated by files, telemetry sensors, or verified records.
            </p>
            <ul className="space-y-2 text-xs text-stone-700">
              {verifiedItems.map((item) => (
                <li
                  key={item.id}
                  className="p-2.5 rounded-xl bg-emerald-50/30 border border-emerald-100/80 space-y-1"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="leading-relaxed font-medium text-stone-900">{item.text}</span>
                    <span className="shrink-0">{getSourceBadge(item.source)}</span>
                  </div>
                  {item.verifiedBy && (
                    <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-medium">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>Verified via {item.verifiedBy}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Tier 2: USER_REPORTED Claims */}
        {userReportedItems.length > 0 && (
          <section className="p-4 rounded-2xl bg-white border border-stone-200/90 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Info className="w-4 h-4 text-stone-500" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-800">
                  User-Reported Information ({userReportedItems.length})
                </h3>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
                Unverified
              </span>
            </div>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              Direct assertions from your situation narrative; pending independent corroboration.
            </p>
            <ul className="space-y-2 text-xs text-stone-700">
              {userReportedItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-stone-50/70 border border-stone-200/80"
                >
                  <div className="space-y-0.5 min-w-0">
                    <span className="leading-relaxed text-stone-800">{item.text}</span>
                    {item.notes && (
                      <p className="text-[10px] text-stone-500">{item.notes}</p>
                    )}
                  </div>
                  <span className="shrink-0 mt-0.5">{getSourceBadge(item.source)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Tier 3: INFERRED Logic */}
        {inferredItems.length > 0 && (
          <section className="p-4 rounded-2xl bg-white border border-stone-200/90 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-violet-600" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-800">
                  Logical Inferences ({inferredItems.length})
                </h3>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                Deductions
              </span>
            </div>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              System inferences derived from context patterns; not established as verified facts.
            </p>
            <ul className="space-y-2 text-xs text-stone-700">
              {inferredItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-violet-50/30 border border-violet-100/80"
                >
                  <div className="space-y-0.5 min-w-0">
                    <span className="leading-relaxed text-stone-800">{item.text}</span>
                    {item.notes && (
                      <p className="text-[10px] text-stone-500">{item.notes}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] font-mono px-2 py-0.5 rounded bg-white text-violet-700 border border-violet-200 font-medium">
                    {Math.round((item.confidence ?? 0.7) * 100)}% prob
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Tier 4: UNKNOWN Missing Information */}
        {unknownItems.length > 0 && (
          <section className="p-4 rounded-2xl bg-stone-50/90 border border-stone-200/90 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-stone-600" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-800">
                  Missing Information ({unknownItems.length})
                </h3>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-200/80 text-stone-700">
                Unknown
              </span>
            </div>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              Key details needed to establish full certainty and proceed with resolution.
            </p>
            <ul className="space-y-1.5 text-xs text-stone-700">
              {unknownItems.map((item) => (
                <li key={item.id} className="flex items-start gap-2 p-2 rounded-lg bg-white border border-stone-200/70">
                  <span className="text-stone-400 font-bold">&bull;</span>
                  <span className="leading-relaxed text-stone-800">{item.text}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Potential Risks & Complications */}
        {analysisResult.risks && analysisResult.risks.length > 0 && (
          <section className="p-4 rounded-2xl bg-white border border-stone-200/90 shadow-xs space-y-2.5">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-800">
                Potential Risks & Complications ({analysisResult.risks.length})
              </h3>
            </div>
            <ul className="space-y-2 text-xs text-stone-700">
              {analysisResult.risks.map((risk, idx) => (
                <li key={idx} className="flex items-start justify-between gap-2 pl-1 border-l-2 border-amber-400">
                  <span className="leading-relaxed">{risk.text}</span>
                  <span className="shrink-0 capitalize font-medium text-[10px] text-amber-700">
                    {risk.priority} priority
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Primary Action Controls */}
        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={onNavigateToCases}
            className="w-full h-12 rounded-xl bg-stone-900 text-stone-50 text-sm font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:bg-stone-800"
          >
            <span>Track in Cases</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleEditSituation}
              className="h-11 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <RotateCcw className="w-3.5 h-3.5 text-stone-500" />
              <span>Edit Situation</span>
            </button>

            <button
              type="button"
              onClick={handleStartFresh}
              className="h-11 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5 text-stone-500" />
              <span>Start New</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER INTENT COMPOSER ---
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

      {/* Validation & Server Error Banners */}
      {validationError && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-in fade-in duration-150">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />
          <span className="flex-1">{validationError}</span>
        </div>
      )}

      {submitError && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-in fade-in duration-150">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />
          <div className="flex-1 space-y-1">
            <p className="font-semibold text-rose-900">Analysis Error</p>
            <p className="leading-relaxed text-rose-700">{submitError}</p>
          </div>
          <button
            type="button"
            onClick={() => setSubmitError(null)}
            className="text-rose-500 hover:text-rose-800"
          >
            <X className="w-3.5 h-3.5" />
          </button>
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
                <span>Analyzing with Gemini...</span>
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
