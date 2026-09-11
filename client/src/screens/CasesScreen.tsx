import { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  Layers,
  MapPin,
  FileText,
  Camera,
  Mic,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { CaseItem, CaseRecord, CaseStatus } from '../types/cases';

interface CasesScreenProps {
  cases: CaseItem[];
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onSelectCase?: (caseRecord: CaseRecord) => void;
  onDeleteCase?: (caseId: string) => Promise<void>;
  onNavigateHome?: () => void;
}

export function CasesScreen({
  cases,
  isLoading = false,
  error = null,
  onRefresh,
  onSelectCase,
  onDeleteCase,
  onNavigateHome,
}: CasesScreenProps) {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredCases = cases.filter((item) => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'action') return item.status === 'needs_approval';
    if (selectedFilter === 'active') return item.status === 'in_progress' || item.status === 'verified';
    if (selectedFilter === 'resolved') return item.status === 'resolved';
    return true;
  });

  const handleDeleteClick = (e: React.MouseEvent, caseId: string) => {
    e.stopPropagation();
    setConfirmDeleteId(caseId);
  };

  const handleConfirmDelete = async (e: React.MouseEvent, caseId: string) => {
    e.stopPropagation();
    if (!onDeleteCase || deletingId) return;

    setDeletingId(caseId);
    try {
      await onDeleteCase(caseId);
      setConfirmDeleteId(null);
    } catch (err) {
      console.error('Failed to delete case:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(null);
  };

  const getStatusBadge = (status: CaseStatus) => {
    switch (status) {
      case 'needs_approval':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80 uppercase tracking-tight">
            <AlertCircle className="w-2.5 h-2.5" />
            Action Required
          </span>
        );
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80 uppercase tracking-tight">
            <CheckCircle2 className="w-2.5 h-2.5" />
            Verified
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 text-stone-700 border border-stone-200">
            <Clock className="w-2.5 h-2.5" />
            In Progress
          </span>
        );
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 text-stone-500">
            Resolved
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: CaseItem['priority']) => {
    switch (priority) {
      case 'urgent':
        return (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
            Immediate
          </span>
        );
      case 'high':
        return (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
            High Priority
          </span>
        );
      case 'medium':
        return <span className="text-[10px] font-medium text-stone-600">Medium</span>;
      case 'low':
        return <span className="text-[10px] font-medium text-stone-400">Low</span>;
    }
  };

  return (
    <div className="w-full px-4 pt-6 pb-28 max-w-md mx-auto space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Your Cases
          </h1>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                aria-label="Refresh cases list"
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-stone-700' : ''}`} />
              </button>
            )}
            <span className="text-xs font-medium text-stone-500 px-2.5 py-0.5 rounded-full bg-stone-100 border border-stone-200/60">
              {cases.length} total
            </span>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-stone-500">
          Situations organized, verified, and tracked through resolution.
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="text-xs font-semibold text-rose-900 underline hover:no-underline shrink-0"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
        <button
          type="button"
          onClick={() => setSelectedFilter('all')}
          className={`px-3 py-1.5 rounded-full font-medium transition-colors shrink-0 ${
            selectedFilter === 'all'
              ? 'bg-stone-900 text-stone-50'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          All Cases
        </button>
        <button
          type="button"
          onClick={() => setSelectedFilter('action')}
          className={`px-3 py-1.5 rounded-full font-medium transition-colors shrink-0 ${
            selectedFilter === 'action'
              ? 'bg-stone-900 text-stone-50'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          Action Required
        </button>
        <button
          type="button"
          onClick={() => setSelectedFilter('active')}
          className={`px-3 py-1.5 rounded-full font-medium transition-colors shrink-0 ${
            selectedFilter === 'active'
              ? 'bg-stone-900 text-stone-50'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          Active
        </button>
        <button
          type="button"
          onClick={() => setSelectedFilter('resolved')}
          className={`px-3 py-1.5 rounded-full font-medium transition-colors shrink-0 ${
            selectedFilter === 'resolved'
              ? 'bg-stone-900 text-stone-50'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          Resolved
        </button>
      </div>

      {/* Cases List */}
      <div className="space-y-3">
        {isLoading && cases.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl border border-stone-200 bg-white shadow-2xs space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-stone-400 mx-auto" />
            <p className="text-xs font-medium text-stone-500">Loading your saved situations...</p>
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-stone-200 bg-stone-50/50 space-y-3">
            <Layers className="w-8 h-8 text-stone-400 mx-auto stroke-[1.5]" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-stone-800">No saved cases</p>
              <p className="text-xs text-stone-500 max-w-xs mx-auto leading-relaxed">
                Situations you describe and understand on the Home screen can be saved here to track progress.
              </p>
            </div>
            {onNavigateHome && (
              <button
                type="button"
                onClick={onNavigateHome}
                className="h-9 px-4 rounded-xl bg-stone-900 text-stone-50 text-xs font-medium hover:bg-stone-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <span>Describe a Situation</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          filteredCases.map((item) => (
            <article
              key={item.id}
              onClick={() => item.rawRecord && onSelectCase?.(item.rawRecord)}
              className="p-4 rounded-2xl bg-white border border-stone-200/90 hover:border-stone-300 transition-all shadow-xs cursor-pointer space-y-3 relative group"
            >
              {/* Top metadata row */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">
                  {item.situationType}
                </span>
                <div className="flex items-center gap-1.5">
                  {getPriorityBadge(item.priority)}
                  {getStatusBadge(item.status)}
                </div>
              </div>

              {/* Title & Summary */}
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-stone-900 leading-snug group-hover:text-stone-700 transition-colors">
                  {item.title}
                </h2>
                <p className="text-xs text-stone-600 leading-relaxed line-clamp-2">
                  {item.summary}
                </p>
              </div>

              {/* Action Required Banner if applicable */}
              {item.actionRequired && item.status === 'needs_approval' && (
                <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/60 flex items-start gap-2 text-xs text-amber-900">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 text-amber-700 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-amber-950">Approval Needed</p>
                    <p className="text-[11px] text-amber-800 leading-normal mt-0.5">
                      {item.actionRequired}
                    </p>
                  </div>
                </div>
              )}

              {/* Delete Confirmation Bar */}
              {confirmDeleteId === item.id ? (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs flex items-center justify-between gap-2 animate-in fade-in duration-150"
                >
                  <span className="text-rose-900 font-medium text-[11px]">Delete this case permanently?</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleConfirmDelete(e, item.id)}
                      disabled={deletingId === item.id}
                      className="px-2.5 py-1 rounded-lg bg-rose-700 text-white font-medium text-[11px] hover:bg-rose-800 disabled:opacity-60 cursor-pointer"
                    >
                      {deletingId === item.id ? 'Deleting...' : 'Delete'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelDelete}
                      className="px-2 py-1 rounded-lg text-stone-600 text-[11px] hover:text-stone-900 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Footer metadata */}
              <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-[11px] text-stone-400">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {item.contextSources.includes('location') && <MapPin className="w-3 h-3" />}
                    {item.contextSources.includes('photo') && <Camera className="w-3 h-3" />}
                    {item.contextSources.includes('document') && <FileText className="w-3 h-3" />}
                    {item.contextSources.includes('voice') && <Mic className="w-3 h-3" />}
                  </div>
                  {item.locationHint && <span>&bull; {item.locationHint}</span>}
                </div>

                <div className="flex items-center gap-2 text-stone-500 font-medium">
                  <span>{item.updatedAt}</span>
                  {confirmDeleteId !== item.id && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteClick(e, item.id)}
                      title="Delete case"
                      className="p-1 rounded text-stone-300 hover:text-rose-600 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                  <ChevronRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-stone-700 transition-colors" />
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
