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

// In-memory duplicate save prevention lock
const pendingSavePromises = new Map<string, Promise<CaseRecord>>();

// Local session store for offline/demo evaluation
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

function saveLocalCase(caseRecord: CaseRecord): void {
  try {
    const cases = getLocalCases();
    const existingIdx = cases.findIndex((c) => c.id === caseRecord.id);
    if (existingIdx >= 0) {
      cases[existingIdx] = caseRecord;
    } else {
      cases.unshift(caseRecord);
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cases));
  } catch (err) {
    console.warn('[caseService] Failed to persist to localStorage:', err);
  }
}

function deleteLocalCase(caseId: string): void {
  try {
    const cases = getLocalCases().filter((c) => c.id !== caseId);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cases));
  } catch (err) {
    console.warn('[caseService] Failed to delete from localStorage:', err);
  }
}

export class CaseService {
  /**
   * Saves or updates a situation case.
   * If caseId is provided, updates the existing row; otherwise creates a new row.
   * Includes duplicate save protection to prevent rapid double-click duplication.
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

    // Generate duplicate key
    const dedupeKey = caseId || `${situation.slice(0, 30)}_${riskAssessment.score}`;
    if (pendingSavePromises.has(dedupeKey)) {
      return pendingSavePromises.get(dedupeKey)!;
    }

    const savePromise = (async () => {
      // 1. Get current authenticated user
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user;
      const title = customTitle || generateCaseTitle(situation, analysis.facts);

      // If user is authenticated on Supabase
      if (user && user.id) {
        if (caseId) {
          // UPDATE existing case
          const { data, error } = await supabase
            .from('cases')
            .update({
              title,
              situation,
              intent,
              risk_level: riskAssessment.level,
              urgency: riskAssessment.urgency,
              analysis,
              external_context: externalContext,
              actions,
              updated_at: new Date().toISOString(),
            })
            .eq('id', caseId)
            .select()
            .single();

          if (error) {
            throw new Error(`Failed to update situation case: ${error.message}`);
          }

          const updatedCase = mapDatabaseRowToCase(data);
          saveLocalCase(updatedCase);
          return updatedCase;
        } else {
          // INSERT new case
          const { data, error } = await supabase
            .from('cases')
            .insert({
              user_id: user.id,
              title,
              situation,
              intent,
              risk_level: riskAssessment.level,
              urgency: riskAssessment.urgency,
              analysis,
              external_context: externalContext,
              actions,
            })
            .select()
            .single();

          if (error) {
            throw new Error(`Failed to save situation case: ${error.message}`);
          }

          const savedCase = mapDatabaseRowToCase(data);
          saveLocalCase(savedCase);
          return savedCase;
        }
      }

      // 2. Local session store fallback (when offline or unauthenticated)
      const now = new Date().toISOString();
      const localRecord: CaseRecord = {
        id: caseId || `case-local-${Date.now()}`,
        userId: user?.id || 'unauthenticated-user',
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

      saveLocalCase(localRecord);
      return localRecord;
    })();

    pendingSavePromises.set(dedupeKey, savePromise);

    try {
      return await savePromise;
    } finally {
      pendingSavePromises.delete(dedupeKey);
    }
  }

  /**
   * Fetches all cases belonging to the authenticated user, sorted newest first.
   */
  public async fetchUserCases(): Promise<CaseRecord[]> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const user = session?.user;

    // If authenticated, fetch from Supabase
    if (user && user.id) {
      try {
        const { data, error } = await supabase
          .from('cases')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.warn('[caseService] Supabase fetch error, falling back to local storage:', error.message);
          return getLocalCases();
        }

        if (data && Array.isArray(data)) {
          const remoteCases = data
            .map(mapDatabaseRowToCase)
            .map(validateAndSanitizeCase)
            .filter(Boolean) as CaseRecord[];

          // Sync local copy
          remoteCases.forEach(saveLocalCase);
          return remoteCases;
        }
      } catch (err) {
        console.warn('[caseService] Network exception fetching cases:', err);
      }
    }

    // Return local cases
    return getLocalCases();
  }

  /**
   * Deletes a case by ID.
   */
  public async deleteCase(caseId: string): Promise<void> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const user = session?.user;

    if (user && user.id) {
      const { error } = await supabase.from('cases').delete().eq('id', caseId);
      if (error) {
        throw new Error(`Failed to delete case: ${error.message}`);
      }
    }

    deleteLocalCase(caseId);
  }
}

export const caseService = new CaseService();
