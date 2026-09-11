import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Layers,
  MapPin,
  FileText,
  Camera,
  Mic,
} from 'lucide-react';
import type { CaseItem, CaseStatus } from '../types/cases';

interface CasesScreenProps {
  cases: CaseItem[];
  onSelectCase?: (caseItem: CaseItem) => void;
}

export function CasesScreen({ cases, onSelectCase }: CasesScreenProps) {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  const filteredCases = cases.filter((item) => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'action') return item.status === 'needs_approval';
    if (selectedFilter === 'active') return item.status === 'in_progress' || item.status === 'verified';
    if (selectedFilter === 'resolved') return item.status === 'resolved';
    return true;
  });

  const getStatusBadge = (status: CaseStatus) => {
    switch (status) {
      case 'needs_approval':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200/80">
            <AlertCircle className="w-3 h-3" />
            Action Required
          </span>
        );
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/80">
            <CheckCircle2 className="w-3 h-3" />
            Verified
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-stone-100 text-stone-700 border border-stone-200">
            <Clock className="w-3 h-3" />
            In Progress
          </span>
        );
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-stone-100 text-stone-500">
            Resolved
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: CaseItem['priority']) => {
    switch (priority) {
      case 'urgent':
      case 'high':
        return <span className="text-[11px] font-semibold text-rose-700">High priority</span>;
      case 'medium':
        return <span className="text-[11px] font-medium text-stone-600">Medium</span>;
      case 'low':
        return <span className="text-[11px] font-medium text-stone-400">Low</span>;
    }
  };

  return (
    <div className="w-full px-4 pt-6 pb-28 max-w-md mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Your Cases
          </h1>
          <span className="text-xs font-medium text-stone-500 px-2.5 py-0.5 rounded-full bg-stone-100">
            {cases.length} total
          </span>
        </div>
        <p className="text-xs sm:text-sm text-stone-500">
          Situations organized, verified, and tracked through resolution.
        </p>
      </div>

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
        {filteredCases.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-stone-200 bg-stone-50/50">
            <Layers className="w-8 h-8 text-stone-400 mx-auto mb-2 stroke-[1.5]" />
            <p className="text-sm font-medium text-stone-700">No cases found</p>
            <p className="text-xs text-stone-500 mt-1">
              New situations submitted from Home will appear here.
            </p>
          </div>
        ) : (
          filteredCases.map((item) => (
            <article
              key={item.id}
              onClick={() => onSelectCase?.(item)}
              className="p-4 rounded-2xl bg-white border border-stone-200/90 hover:border-stone-300 transition-all shadow-xs cursor-pointer space-y-3"
            >
              {/* Top metadata row */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-stone-600 uppercase tracking-wider">
                  {item.situationType}
                </span>
                <div className="flex items-center gap-2">
                  {getPriorityBadge(item.priority)}
                  {getStatusBadge(item.status)}
                </div>
              </div>

              {/* Title & Summary */}
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-stone-900 leading-snug">
                  {item.title}
                </h2>
                <p className="text-xs text-stone-500 leading-relaxed line-clamp-2">
                  {item.summary}
                </p>
              </div>

              {/* Action Required Banner if applicable */}
              {item.actionRequired && item.status === 'needs_approval' && (
                <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/60 flex items-start gap-2 text-xs text-amber-900">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 text-amber-700 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-amber-950">Approval Needed</p>
                    <p className="text-[11px] text-amber-800 leading-normal mt-0.5">
                      {item.actionRequired}
                    </p>
                  </div>
                </div>
              )}

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
                <div className="flex items-center gap-1 text-stone-500 font-medium">
                  <span>{item.updatedAt}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
