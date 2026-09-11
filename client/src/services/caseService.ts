import { supabase } from '../lib/supabase';
import type { CaseRecord } from '../types/cases';
import type { NormalizedAnalysis, ExternalContextItem } from '../types/analysis';
import type { RiskAssessment } from '../types/risk';
import type { RecommendedAction } from '../types/actions';
import { mapDatabaseRowToCase } from '../types/cases';
import { validateAndSanitizeCase, generateCaseTitle } from '../utils/caseValidation';

export interface SaveCaseParams {
  caseId?: string;
  situation: string;
  intent: string;
  riskAssessment: RiskAssessment;
  analysis: NormalizedAnalysis;
  externalContext?: ExternalContextItem[];
  actions: RecommendedAction[];
  customTitle?: string;
}

// In-memory duplicate save prevention
const pendingSavePromises = new Map<string, Promise<CaseRecord>>();

const LOCAL_STORAGE_KEY = 'nexus_saved_cases_v1';

function getLocalCases(): CaseRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? (parsed.map(validateAndSanitizeCase).filter(Boolean) as CaseRecord[])
      : [];
  } catch {
    return [];
  }
}

function saveLocalCase(record: CaseRecord): void {
  try {
    const cases = getLocalCases();
    const idx = cases.findIndex((c) => c.id === record.id);
    if (idx >= 0) cases[idx] = record;
    else cases.unshift(record);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cases));
  } catch (err) {
    console.warn('[caseService] localStorage write failed:', err);
  }
}

function deleteLocalCase(caseId: string): void {
  try {
    const cases = getLocalCases().filter((c) => c.id !== caseId);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cases));
  } catch (err) {
    console.warn('[caseService] localStorage delete failed:', err);
  }
}

/** Shared helper — always resolves the current Supabase user. */
async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
}

export class CaseService {
  /**
   * Saves or updates a situation case.
   * Authenticated users persist to Supabase; unauthenticated fall back to localStorage.
   * Concurrent duplicate calls for the same key return the same in-flight promise.
   */
  public async saveCase(params: SaveCaseParams): Promise<CaseRecord> {
    const {
      caseId,
      situation,
      intent,
      riskAssessment,
      analysis,
      externalContext = [],
      actions,
      customTitle,
    } = params;

    const dedupeKey = caseId ?? `${situation.slice(0, 30)}_${riskAssessment.score}`;
    const existing = pendingSavePromises.get(dedupeKey);
    if (existing) return existing;

    const savePromise = (async (): Promise<CaseRecord> => {
      const user = await getCurrentUser();
      const title = customTitle ?? generateCaseTitle(situation, analysis.facts);

      if (user) {
        const commonPayload = {
          title,
          situation,
          intent,
          risk_level: riskAssessment.level,
          urgency: riskAssessment.urgency,
          analysis,
          external_context: externalContext,
          actions,
        };

        const query = caseId
          ? supabase
              .from('cases')
              .update({ ...commonPayload, updated_at: new Date().toISOString() })
              .eq('id', caseId)
              .select()
              .single()
          : supabase
              .from('cases')
              .insert({ user_id: user.id, ...commonPayload })
              .select()
              .single();

        const { data, error } = await query;
        if (error) throw new Error(`Failed to save situation: ${error.message}`);

        const saved = mapDatabaseRowToCase(data);
        saveLocalCase(saved);
        return saved;
      }

      // Unauthenticated: local-only fallback
      const now = new Date().toISOString();
      const local: CaseRecord = {
        id: caseId ?? `case-local-${Date.now()}`,
        userId: 'unauthenticated-user',
        title,
        situation,
        intent,
        riskLevel: riskAssessment.level,
        urgency: riskAssessment.urgency,
        analysis,
        externalContext,
        actions,
        createdAt: now,
        updatedAt: now,
      };
      saveLocalCase(local);
      return local;
    })();

    pendingSavePromises.set(dedupeKey, savePromise);
    try {
      return await savePromise;
    } finally {
      pendingSavePromises.delete(dedupeKey);
    }
  }

  /** Fetches all cases for the authenticated user, newest first. */
  public async fetchUserCases(): Promise<CaseRecord[]> {
    const user = await getCurrentUser();

    if (user) {
      try {
        const { data, error } = await supabase
          .from('cases')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.warn('[caseService] Supabase fetch failed, using local cache:', error.message);
          return getLocalCases();
        }

        if (Array.isArray(data)) {
          const records = data
            .map(mapDatabaseRowToCase)
            .map(validateAndSanitizeCase)
            .filter(Boolean) as CaseRecord[];
          records.forEach(saveLocalCase);
          return records;
        }
      } catch (err) {
        console.warn('[caseService] Network error fetching cases:', err);
      }
    }

    return getLocalCases();
  }

  /** Deletes a case by ID from Supabase and local cache. */
  public async deleteCase(caseId: string): Promise<void> {
    const user = await getCurrentUser();
    if (user) {
      const { error } = await supabase.from('cases').delete().eq('id', caseId);
      if (error) throw new Error(`Failed to delete case: ${error.message}`);
    }
    deleteLocalCase(caseId);
  }
}

export const caseService = new CaseService();
