import { useState, useEffect, useCallback } from 'react';
import type { CaseRecord, NavTab } from './types/cases';
import { mapCaseRecordToCaseItem } from './types/cases';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppHeader } from './components/AppHeader';
import { BottomNav } from './components/BottomNav';
import { HomeScreen } from './screens/HomeScreen';
import { CasesScreen } from './screens/CasesScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { AuthScreen } from './screens/AuthScreen';
import { caseService } from './services/caseService';
import { RefreshCw } from 'lucide-react';

function NexusApp() {
  const { user, isLoading, isRecoveryMode, signOut } = useAuth();

  // Navigation state
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [savedCases, setSavedCases] = useState<CaseRecord[]>([]);
  const [activeCase, setActiveCase] = useState<CaseRecord | null>(null);
  const [isLoadingCases, setIsLoadingCases] = useState(false);
  const [casesError, setCasesError] = useState<string | null>(null);

  // Load cases for current authenticated user
  const loadCases = useCallback(async () => {
    setIsLoadingCases(true);
    setCasesError(null);
    try {
      const records = await caseService.fetchUserCases();
      setSavedCases(records);
    } catch (err: any) {
      console.error('[App] Failed to load cases:', err);
      setCasesError('Unable to load situations. Please refresh.');
    } finally {
      setIsLoadingCases(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadCases();
    }
  }, [user, loadCases]);

  const handleSelectCase = (record: CaseRecord) => {
    setActiveCase(record);
    setActiveTab('home');
  };

  const handleDeleteCase = async (caseId: string) => {
    await caseService.deleteCase(caseId);
    setSavedCases((prev) => prev.filter((c) => c.id !== caseId));
    if (activeCase?.id === caseId) {
      setActiveCase(null);
    }
  };

  const handleCaseSaved = (savedRecord: CaseRecord) => {
    setSavedCases((prev) => {
      const existingIdx = prev.findIndex((c) => c.id === savedRecord.id);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = savedRecord;
        return next;
      }
      return [savedRecord, ...prev];
    });
    setActiveCase(savedRecord);
  };

  const handleSignOut = async () => {
    await signOut();
    setActiveTab('home');
  };

  // 1. Initial Session Restoration Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 antialiased">
        <div className="w-14 h-14 rounded-2xl bg-stone-900 text-stone-50 flex items-center justify-center shadow-md">
          <span className="text-2xl font-bold tracking-tighter">N</span>
        </div>
        <div className="mt-5 flex items-center gap-2 text-xs text-stone-500 font-medium">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-stone-600" />
          <span>Restoring session...</span>
        </div>
      </div>
    );
  }

  // 2. Password Recovery View (triggered by reset-password email link)
  if (isRecoveryMode) {
    return <AuthScreen initialView="reset-password" />;
  }

  // 3. Unauthenticated State
  if (!user) {
    return <AuthScreen initialView="login" />;
  }

  // 4. Authenticated Application Shell
  const caseItems = savedCases.map(mapCaseRecordToCaseItem);
  const pendingActionCount = caseItems.filter((c) => c.status === 'needs_approval').length;

  return (
    <div className="min-h-screen bg-stone-100 flex justify-center antialiased">
      {/* Mobile-first viewport container */}
      <div className="w-full max-w-md min-h-screen bg-stone-50 flex flex-col relative shadow-lg sm:border-x sm:border-stone-200/80">
        {/* Compact Top App Header */}
        <AppHeader
          onNotificationClick={() => setActiveTab('cases')}
          unreadCount={pendingActionCount}
        />

        {/* Primary Screen Area */}
        <main className="flex-1 overflow-y-auto">
          {activeTab === 'home' && (
            <HomeScreen
              onNavigateToCases={() => setActiveTab('cases')}
              recentCases={caseItems}
              activeCase={activeCase}
              onClearActiveCase={() => setActiveCase(null)}
              onCaseSaved={handleCaseSaved}
            />
          )}

          {activeTab === 'cases' && (
            <CasesScreen
              cases={caseItems}
              isLoading={isLoadingCases}
              error={casesError}
              onRefresh={loadCases}
              onSelectCase={handleSelectCase}
              onDeleteCase={handleDeleteCase}
              onNavigateHome={() => setActiveTab('home')}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileScreen
              onSignOut={handleSignOut}
              userEmail={user.email}
              userName={user.user_metadata?.full_name as string}
            />
          )}
        </main>

        {/* Fixed Bottom Navigation */}
        <BottomNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          casesBadgeCount={pendingActionCount}
        />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NexusApp />
    </AuthProvider>
  );
}
