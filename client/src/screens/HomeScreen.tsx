import { useState } from 'react';
import { ArrowUp, Camera, FileText, MapPin, Mic, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import type { CaseItem, ContextSourceType } from '../types/cases';

interface HomeScreenProps {
  onNavigateToCases: () => void;
  recentCases: CaseItem[];
}

export function HomeScreen({ onNavigateToCases, recentCases }: HomeScreenProps) {
  const [situationText, setSituationText] = useState('');
  const [activeSources, setActiveSources] = useState<ContextSourceType[]>([]);
  const [locationNote, setLocationNote] = useState<string | null>(null);

  const toggleSource = (source: ContextSourceType) => {
    if (activeSources.includes(source)) {
      setActiveSources(activeSources.filter((s) => s !== source));
      if (source === 'location') setLocationNote(null);
    } else {
      setActiveSources([...activeSources, source]);
      if (source === 'location') setLocationNote('Current location attached');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!situationText.trim() && activeSources.length === 0) return;
    // In Phase 1 UI foundation, transitioning/submitting navigates to Cases
    onNavigateToCases();
  };

  return (
    <div className="w-full px-4 pt-6 pb-28 max-w-md mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Central inquiry */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-stone-900">
          What do you need help with?
        </h1>
        <p className="text-sm text-stone-500 leading-relaxed">
          Describe any situation, disruption, or document. NEXUS organizes the facts and maps the next step.
        </p>
      </div>

      {/* Primary Input Surface */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-white border border-stone-200/90 shadow-sm focus-within:border-stone-400 focus-within:ring-2 focus-within:ring-stone-950/5 transition-all p-4 space-y-3"
      >
        <div className="min-h-[120px]">
          <textarea
            value={situationText}
            onChange={(e) => setSituationText(e.target.value)}
            placeholder="Describe what happened or what you need to resolve..."
            rows={4}
            className="w-full resize-none bg-transparent border-0 p-0 text-stone-900 placeholder:text-stone-400 text-sm sm:text-base leading-relaxed focus:outline-none focus:ring-0"
          />
        </div>

        {/* Active context attachments pill tray */}
        {(activeSources.length > 0 || locationNote) && (
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-stone-100">
            {activeSources.map((source) => (
              <span
                key={source}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-700 capitalize"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-stone-500" />
                {source} context added
              </span>
            ))}
          </div>
        )}

        {/* Context entry points & submit */}
        <div className="flex items-center justify-between pt-2 border-t border-stone-100">
          <div className="flex items-center gap-1 text-stone-500">
            <button
              type="button"
              onClick={() => toggleSource('voice')}
              title="Add voice note"
              aria-label="Add voice note"
              className={`p-2 rounded-xl transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center ${
                activeSources.includes('voice')
                  ? 'bg-stone-900 text-stone-50'
                  : 'hover:bg-stone-100 text-stone-500 hover:text-stone-900'
              }`}
            >
              <Mic className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => toggleSource('photo')}
              title="Add photo"
              aria-label="Add photo"
              className={`p-2 rounded-xl transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center ${
                activeSources.includes('photo')
                  ? 'bg-stone-900 text-stone-50'
                  : 'hover:bg-stone-100 text-stone-500 hover:text-stone-900'
              }`}
            >
              <Camera className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => toggleSource('document')}
              title="Add document"
              aria-label="Add document"
              className={`p-2 rounded-xl transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center ${
                activeSources.includes('document')
                  ? 'bg-stone-900 text-stone-50'
                  : 'hover:bg-stone-100 text-stone-500 hover:text-stone-900'
              }`}
            >
              <FileText className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => toggleSource('location')}
              title="Add location"
              aria-label="Add location"
              className={`p-2 rounded-xl transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center ${
                activeSources.includes('location')
                  ? 'bg-stone-900 text-stone-50'
                  : 'hover:bg-stone-100 text-stone-500 hover:text-stone-900'
              }`}
            >
              <MapPin className="w-4 h-4" />
            </button>
          </div>

          <button
            type="submit"
            disabled={!situationText.trim() && activeSources.length === 0}
            aria-label="Submit situation"
            className="w-10 h-10 rounded-full bg-stone-900 text-stone-50 flex items-center justify-center hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-2"
          >
            <ArrowUp className="w-5 h-5 stroke-[2.25]" />
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
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-stone-100 text-stone-600">
                        {item.situationType}
                      </span>
                      {item.status === 'verified' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                          <CheckCircle2 className="w-3 h-3" />
                          Verified
                        </span>
                      )}
                      {item.status === 'needs_approval' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
                          <AlertCircle className="w-3 h-3" />
                          Action Required
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-medium text-stone-900 group-hover:text-stone-700 truncate">
                      {item.title}
                    </h3>
                  </div>
                  <div className="flex items-center text-[11px] text-stone-400 shrink-0 gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    <span>{item.updatedAt}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
