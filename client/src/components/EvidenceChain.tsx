import React, { useState } from 'react';
import {
  Layers,
  ShieldCheck,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Camera,
  FileText,
  MapPin,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  HelpCircle,
} from 'lucide-react';
import type {
  NormalizedAnalysis,
  EvidenceItem,
  EvidenceStatus,
  EvidenceSource,
} from '../types/analysis';
import type { RiskAssessment, RiskFactor, RiskLevel, UrgencyLevel, FactorImpact } from '../types/risk';
import type { RecommendedAction, ActionPriority, ActionCategory } from '../types/actions';

export interface EvidenceChainInput {
  text?: string;
  imageCount?: number;
  documentCount?: number;
  location?: { latitude: number; longitude: number; label?: string } | null;
}

export interface EvidenceChainProps {
  input: EvidenceChainInput;
  analysis: NormalizedAnalysis;
  riskAssessment?: RiskAssessment | null;
  actions?: RecommendedAction[];
  className?: string;
}

export const EvidenceChain: React.FC<EvidenceChainProps> = ({
  input,
  analysis,
  riskAssessment,
  actions = [],
  className = '',
}) => {
  const [showAllEvidence, setShowAllEvidence] = useState(false);
  const [showAllFactors, setShowAllFactors] = useState(false);
  const [showAllActions, setShowAllActions] = useState(false);

  // ── 1. Derive & Organize Evidence ──────────────────────────────────────────
  const evidenceList: EvidenceItem[] = React.useMemo(() => {
    if (analysis.evidence && analysis.evidence.length > 0) {
      return [...analysis.evidence].sort((a, b) => {
        const order: Record<EvidenceStatus, number> = {
          VERIFIED: 0,
          USER_REPORTED: 1,
          INFERRED: 2,
          UNKNOWN: 3,
        };
        return (order[a.status] ?? 4) - (order[b.status] ?? 4);
      });
    }

    // Fallback: construct from raw Gemini output if evidence array is empty
    const synthesized: EvidenceItem[] = [];
    (analysis.facts || []).forEach((f, idx) => {
      synthesized.push({
        id: `fact-${idx}`,
        text: f.text,
        status: f.source === 'image' || f.source === 'document' || f.source === 'location' ? 'VERIFIED' : 'USER_REPORTED',
        source: f.source as EvidenceSource,
      });
    });
    (analysis.userReported || []).forEach((u, idx) => {
      synthesized.push({
        id: `ur-${idx}`,
        text: u.text,
        status: 'USER_REPORTED',
        source: u.source as EvidenceSource,
      });
    });
    (analysis.inferences || []).forEach((inf, idx) => {
      synthesized.push({
        id: `inf-${idx}`,
        text: inf.text,
        status: 'INFERRED',
        source: 'system',
        confidence: inf.confidence,
      });
    });
    (analysis.missingInformation || []).forEach((m, idx) => {
      synthesized.push({
        id: `unk-${idx}`,
        text: m,
        status: 'UNKNOWN',
        source: 'system',
      });
    });
    return synthesized;
  }, [analysis]);

  // Evidence to display based on progressive disclosure
  const visibleEvidence = showAllEvidence ? evidenceList : evidenceList.slice(0, 2);

  // ── 2. Derive Risk Factors & Decision ──────────────────────────────────────
  const riskFactors: RiskFactor[] = React.useMemo(() => {
    if (riskAssessment?.factors && riskAssessment.factors.length > 0) {
      return riskAssessment.factors;
    }
    // Fallback to analysis.risks if risk engine factors are empty
    return (analysis.risks || []).map((r) => ({
      label: r.text,
      impact: r.priority === 'critical' || r.priority === 'high' ? 'HIGH' : r.priority === 'medium' ? 'MEDIUM' : 'LOW',
    }));
  }, [riskAssessment, analysis.risks]);

  const visibleFactors = showAllFactors ? riskFactors : riskFactors.slice(0, 2);

  // ── 3. Derive Actions ──────────────────────────────────────────────────────
  const activeActions = React.useMemo(() => {
    return actions.filter((a) => a.status !== 'DISMISSED');
  }, [actions]);

  const primaryAction = activeActions.length > 0 ? activeActions[0] : null;
  const secondaryActions = activeActions.slice(1);

  // ── Helper Badge Renderers ────────────────────────────────────────────────
  const renderSourceBadge = (source: EvidenceSource | string) => {
    switch (source) {
      case 'image':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
            <Camera className="w-2.5 h-2.5" />
            Photo
          </span>
        );
      case 'document':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100">
            <FileText className="w-2.5 h-2.5" />
            Doc
          </span>
        );
      case 'location':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
            <MapPin className="w-2.5 h-2.5" />
            GPS
          </span>
        );
      case 'system':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-100">
            <Sparkles className="w-2.5 h-2.5" />
            System
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200">
            Text
          </span>
        );
    }
  };

  const renderEvidenceStatusBadge = (status: EvidenceStatus, confidence?: number | null) => {
    switch (status) {
      case 'VERIFIED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
            VERIFIED
          </span>
        );
      case 'USER_REPORTED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
            <Info className="w-2.5 h-2.5 text-stone-500" />
            USER_REPORTED
          </span>
        );
      case 'INFERRED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
            <Sparkles className="w-2.5 h-2.5 text-violet-600" />
            INFERRED{confidence != null ? ` (${Math.round(confidence * 100)}%)` : ''}
          </span>
        );
      case 'UNKNOWN':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <HelpCircle className="w-2.5 h-2.5 text-amber-600" />
            UNKNOWN
          </span>
        );
    }
  };

  const renderImpactBadge = (impact: FactorImpact) => {
    switch (impact) {
      case 'HIGH':
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-tight">
            High Impact
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-tight">
            Medium Impact
          </span>
        );
      case 'LOW':
        return (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200 uppercase tracking-tight">
            Low Impact
          </span>
        );
    }
  };

  const renderRiskLevelBadge = (level: RiskLevel) => {
    switch (level) {
      case 'CRITICAL':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200 inline-flex items-center gap-1">
            <ShieldAlert className="w-3 h-3 text-rose-600" />
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            HIGH
          </span>
        );
      case 'MODERATE':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-stone-100 text-stone-700 border border-stone-200 inline-flex items-center gap-1">
            <Info className="w-3 h-3 text-stone-500" />
            MODERATE
          </span>
        );
      case 'LOW':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-stone-100 text-stone-600 border border-stone-200 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-stone-500" />
            LOW
          </span>
        );
    }
  };

  const renderUrgencyBadge = (urgency: UrgencyLevel) => {
    switch (urgency) {
      case 'IMMEDIATE':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-900 border border-rose-300">
            IMMEDIATE
          </span>
        );
      case 'URGENT':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">
            URGENT
          </span>
        );
      case 'SOON':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 text-stone-800 border border-stone-300">
            SOON
          </span>
        );
      case 'ROUTINE':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 text-stone-600 border border-stone-200">
            ROUTINE
          </span>
        );
    }
  };

  const renderActionCategoryBadge = (category: ActionCategory) => {
    switch (category) {
      case 'SAFETY':
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-tight">
            Safety
          </span>
        );
      case 'CONTACT':
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-tight">
            Contact
          </span>
        );
      case 'INFORMATION':
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-tight">
            Information
          </span>
        );
      case 'DOCUMENT':
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 uppercase tracking-tight">
            Document
          </span>
        );
      case 'FOLLOW_UP':
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200 uppercase tracking-tight">
            Follow Up
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200 uppercase tracking-tight">
            {category}
          </span>
        );
    }
  };

  const renderActionPriorityBadge = (priority: ActionPriority) => {
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

  // Determine which input modalities are present
  const hasInputText = Boolean(input.text && input.text.trim().length > 0);
  const imageCount = input.imageCount ?? 0;
  const documentCount = input.documentCount ?? 0;
  const hasLocation = Boolean(input.location);

  // Concise text snippet
  const inputSnippet = hasInputText
    ? input.text!.length > 110
      ? `${input.text!.slice(0, 110).trim()}...`
      : input.text!.trim()
    : null;

  return (
    <section
      className={`p-4 sm:p-5 rounded-2xl bg-white border border-stone-200/90 shadow-xs space-y-4 ${className}`}
      aria-label="Evidence and Decision Chain"
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-stone-100">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-stone-900" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-700">
              Evidence Chain
            </h2>
          </div>
          <p className="text-[11px] text-stone-400">
            Deterministic trace from input modalities to recommended actions
          </p>
        </div>
        <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200 shrink-0">
          5-Stage Pipeline
        </span>
      </div>

      {/* Sequential Chain List */}
      <ol className="space-y-0" aria-label="Pipeline stages">
        {/* ── STAGE 1: INPUT ────────────────────────────────────────────── */}
        <li className="flex items-start gap-3">
          {/* Step indicator and vertical connector */}
          <div className="flex flex-col items-center self-stretch shrink-0">
            <div
              className="w-6 h-6 rounded-full border border-stone-200 bg-stone-50 flex items-center justify-center text-[10px] font-bold text-stone-700 shadow-2xs"
              aria-label="Step 1: Input"
            >
              1
            </div>
            <div className="w-0.5 flex-1 bg-stone-200 my-1 min-h-6" aria-hidden="true" />
          </div>

          {/* Node Content */}
          <div className="flex-1 pb-4 min-w-0 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-stone-400" />
                Input
              </span>
              <div className="flex items-center gap-1 flex-wrap justify-end">
                {hasInputText && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200">
                    Text
                  </span>
                )}
                {imageCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    <Camera className="w-2.5 h-2.5" />
                    {imageCount} {imageCount === 1 ? 'Photo' : 'Photos'}
                  </span>
                )}
                {documentCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                    <FileText className="w-2.5 h-2.5" />
                    {documentCount} {documentCount === 1 ? 'Doc' : 'Docs'}
                  </span>
                )}
                {hasLocation && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <MapPin className="w-2.5 h-2.5" />
                    GPS
                  </span>
                )}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-stone-50/80 border border-stone-200/70 text-xs text-stone-700 space-y-1">
              {inputSnippet ? (
                <p className="italic text-stone-800 leading-relaxed font-serif text-[12px] break-words">
                  &ldquo;{inputSnippet}&rdquo;
                </p>
              ) : (
                <p className="text-stone-500 text-[11px] italic">
                  Multimodal telemetry input provided (attachments / location coordinates).
                </p>
              )}

              {hasLocation && input.location && (
                <div className="flex items-center gap-1 text-[10px] text-stone-500 pt-0.5 font-mono">
                  <MapPin className="w-3 h-3 text-stone-400 shrink-0" />
                  <span className="truncate">
                    {input.location.label ||
                      `${input.location.latitude.toFixed(4)}°, ${input.location.longitude.toFixed(4)}°`}
                  </span>
                </div>
              )}
            </div>
          </div>
        </li>

        {/* ── STAGE 2: EVIDENCE ─────────────────────────────────────────── */}
        <li className="flex items-start gap-3">
          <div className="flex flex-col items-center self-stretch shrink-0">
            <div
              className="w-6 h-6 rounded-full border border-stone-200 bg-stone-50 flex items-center justify-center text-[10px] font-bold text-stone-700 shadow-2xs"
              aria-label="Step 2: Evidence"
            >
              2
            </div>
            <div className="w-0.5 flex-1 bg-stone-200 my-1 min-h-6" aria-hidden="true" />
          </div>

          <div className="flex-1 pb-4 min-w-0 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-stone-400" />
                Evidence
              </span>
              <span className="text-[10px] text-stone-400 font-medium">
                {evidenceList.length} Item{evidenceList.length === 1 ? '' : 's'}
              </span>
            </div>

            {evidenceList.length > 0 ? (
              <div className="space-y-1.5">
                {visibleEvidence.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl bg-white border border-stone-200/80 shadow-2xs space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        {renderSourceBadge(item.source)}
                        {renderEvidenceStatusBadge(item.status, item.confidence)}
                      </div>
                      {item.verifiedBy && (
                        <span className="text-[10px] text-emerald-700 font-medium truncate">
                          via {item.verifiedBy}
                        </span>
                      )}
                    </div>
                    <p className="text-stone-800 leading-snug break-words">
                      {item.text}
                    </p>
                  </div>
                ))}

                {/* Progressive disclosure toggle */}
                {evidenceList.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setShowAllEvidence(!showAllEvidence)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-600 hover:text-stone-900 transition-colors pt-0.5 cursor-pointer"
                  >
                    {showAllEvidence ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" />
                        <span>Show fewer evidence items</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" />
                        <span>Show {evidenceList.length - 2} more evidence items</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-500 italic">
                No distinct evidence claims extracted from input.
              </div>
            )}
          </div>
        </li>

        {/* ── STAGE 3: RISK FACTOR ──────────────────────────────────────── */}
        <li className="flex items-start gap-3">
          <div className="flex flex-col items-center self-stretch shrink-0">
            <div
              className="w-6 h-6 rounded-full border border-stone-200 bg-stone-50 flex items-center justify-center text-[10px] font-bold text-stone-700 shadow-2xs"
              aria-label="Step 3: Risk Factor"
            >
              3
            </div>
            <div className="w-0.5 flex-1 bg-stone-200 my-1 min-h-6" aria-hidden="true" />
          </div>

          <div className="flex-1 pb-4 min-w-0 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-stone-400" />
                Risk Factors
              </span>
              {riskFactors.length > 0 && (
                <span className="text-[10px] text-stone-400 font-medium">
                  {riskFactors.length} Factor{riskFactors.length === 1 ? '' : 's'}
                </span>
              )}
            </div>

            {riskFactors.length > 0 ? (
              <div className="space-y-1.5">
                {visibleFactors.map((factor, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-stone-50/70 border border-stone-200/80 flex items-start justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <span className="font-medium text-stone-800 block break-words">
                        {factor.label}
                      </span>
                      {factor.detail && (
                        <p className="text-[10px] text-stone-500 break-words">
                          {factor.detail}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0">{renderImpactBadge(factor.impact)}</div>
                  </div>
                ))}

                {riskFactors.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setShowAllFactors(!showAllFactors)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-600 hover:text-stone-900 transition-colors pt-0.5 cursor-pointer"
                  >
                    {showAllFactors ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" />
                        <span>Show fewer risk factors</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" />
                        <span>Show {riskFactors.length - 2} more risk factors</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-500 flex items-center justify-between">
                <span>Direct low-risk profile — no elevated risk hazards identified.</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200 font-medium">
                  Routine
                </span>
              </div>
            )}
          </div>
        </li>

        {/* ── STAGE 4: DECISION ─────────────────────────────────────────── */}
        <li className="flex items-start gap-3">
          <div className="flex flex-col items-center self-stretch shrink-0">
            <div
              className="w-6 h-6 rounded-full border border-stone-200 bg-stone-50 flex items-center justify-center text-[10px] font-bold text-stone-700 shadow-2xs"
              aria-label="Step 4: Decision"
            >
              4
            </div>
            <div className="w-0.5 flex-1 bg-stone-200 my-1 min-h-6" aria-hidden="true" />
          </div>

          <div className="flex-1 pb-4 min-w-0 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-stone-400" />
                Decision
              </span>
              {riskAssessment && (
                <span className="text-[10px] font-mono font-semibold text-stone-700">
                  {riskAssessment.score}
                  <span className="text-stone-400 font-normal">/100 Score</span>
                </span>
              )}
            </div>

            <div className="p-2.5 rounded-xl bg-white border border-stone-200/90 shadow-2xs space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  {riskAssessment ? (
                    <>
                      {renderRiskLevelBadge(riskAssessment.level)}
                      {renderUrgencyBadge(riskAssessment.urgency)}
                    </>
                  ) : (
                    <span className="text-xs font-semibold text-stone-800 uppercase">
                      {analysis.severity} Severity
                    </span>
                  )}
                </div>
                {riskAssessment && (
                  <span className="text-[10px] text-stone-400">
                    Confidence: <span className="font-semibold text-stone-600">{riskAssessment.evidenceConfidence}</span>
                  </span>
                )}
              </div>

              {/* Primary Assessment Reasoning */}
              {riskAssessment?.reasoning && riskAssessment.reasoning.length > 0 ? (
                <div className="pt-1 border-t border-stone-100 text-[11px] text-stone-600 space-y-1">
                  <span className="font-medium text-stone-700 block">Assessment Rationale:</span>
                  <p className="leading-relaxed break-words">
                    {riskAssessment.reasoning[0]}
                  </p>
                </div>
              ) : (
                <p className="text-[11px] text-stone-600 leading-relaxed break-words">
                  Situation assessed as {analysis.severity} severity with {Math.round(analysis.confidence * 100)}% model certainty.
                </p>
              )}
            </div>
          </div>
        </li>

        {/* ── STAGE 5: NEXT ACTION ──────────────────────────────────────── */}
        <li className="flex items-start gap-3">
          <div className="flex flex-col items-center shrink-0">
            <div
              className="w-6 h-6 rounded-full border border-stone-900 bg-stone-900 flex items-center justify-center text-[10px] font-bold text-stone-50 shadow-2xs"
              aria-label="Step 5: Next Action"
            >
              5
            </div>
          </div>

          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-stone-900" />
                Next Action
              </span>
              {activeActions.length > 0 && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
                  {activeActions.length} Action{activeActions.length === 1 ? '' : 's'} Ready
                </span>
              )}
            </div>

            {primaryAction ? (
              <div className="space-y-2">
                {/* Primary Action Card */}
                <div className="p-3 rounded-xl bg-stone-50/90 border border-stone-300 shadow-2xs space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      {renderActionCategoryBadge(primaryAction.category)}
                      {renderActionPriorityBadge(primaryAction.priority)}
                    </div>
                    {primaryAction.requiresApproval && (
                      <span className="text-[10px] font-medium text-stone-400">
                        Requires Approval
                      </span>
                    )}
                  </div>

                  <h4 className="text-xs font-semibold text-stone-900 leading-snug break-words">
                    {primaryAction.title}
                  </h4>
                  <p className="text-[11px] text-stone-600 leading-relaxed break-words">
                    {primaryAction.description}
                  </p>

                  <div className="p-1.5 rounded-lg bg-white border border-stone-200 text-[10px] text-stone-600 leading-normal">
                    <span className="font-semibold text-stone-700">Rationale: </span>
                    <span className="break-words">{primaryAction.rationale}</span>
                  </div>
                </div>

                {/* Secondary Actions Progressive Disclosure */}
                {secondaryActions.length > 0 && (
                  <div className="pt-0.5 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => setShowAllActions(!showAllActions)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
                    >
                      {showAllActions ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" />
                          <span>Show fewer actions</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
                          <span>Show {secondaryActions.length} secondary action{secondaryActions.length === 1 ? '' : 's'}</span>
                        </>
                      )}
                    </button>

                    {showAllActions && (
                      <div className="space-y-1.5 pt-1">
                        {secondaryActions.map((sec) => (
                          <div
                            key={sec.id}
                            className="p-2.5 rounded-xl bg-white border border-stone-200 text-xs space-y-1"
                          >
                            <div className="flex items-center gap-1.5">
                              {renderActionCategoryBadge(sec.category)}
                              {renderActionPriorityBadge(sec.priority)}
                            </div>
                            <h5 className="font-medium text-stone-800 text-[11px] leading-snug break-words">
                              {sec.title}
                            </h5>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-500 italic">
                No immediate active intervention required.
              </div>
            )}
          </div>
        </li>
      </ol>
    </section>
  );
};
