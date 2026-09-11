import { useState } from 'react';
import type { CaseItem, NavTab } from './types/cases';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppHeader } from './components/AppHeader';
import { BottomNav } from './components/BottomNav';
import { HomeScreen } from './screens/HomeScreen';
import { CasesScreen } from './screens/CasesScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { AuthScreen } from './screens/AuthScreen';
import { RefreshCw } from 'lucide-react';

const INITIAL_CASES: CaseItem[] = [
  {
    id: 'case-1',
    title: 'Street flooding & drainage backup near residence',
    situationType: 'Infrastructure & Safety',
    priority: 'high',
    status: 'needs_approval',
    summary:
      'Storm drain blockage causing street-level water accumulation near 14th Ave. Municipal dispatch notified.',
    updatedAt: '2h ago',
    contextSources: ['location', 'photo', 'text'],
    locationHint: '14th Ave & Oak St',
    actionRequired: 'Review municipal hazard filing & authorize dispatch inquiry',
  },
  {
    id: 'case-2',
    title: 'Unsafe crosswalk signal timing on Elm Street',
    situationType: 'Community & Road Safety',
    priority: 'medium',
    status: 'in_progress',
    summary:
      'Pedestrian crossing interval insufficient for senior transit access. Ticket #4921 logged with Dept of Transportation.',
    updatedAt: 'Yesterday',
    contextSources: ['photo', 'location'],
    locationHint: 'Elm St crosswalk',
  },
  {
    id: 'case-3',
    title: 'Prescription formulary claim clarification',
    situationType: 'Medical & Healthcare Admin',
    priority: 'low',
    status: 'verified',
    summary:
      'Pharmacy benefit denial reconciled against formulary tier exceptions. Co-pay reimbursement documented.',
    updatedAt: '3 days ago',
    contextSources: ['document'],
  },
  {
    id: 'case-4',
    title: 'Connecting flight cancellation & accommodation compensation',
    situationType: 'Travel Disruption',
    priority: 'high',
    status: 'needs_approval',
    summary:
      'Overnight delay in Chicago. Airline issued partial food voucher but did not provide mandatory hotel accommodation receipt.',
    updatedAt: 'Oct 12',
    contextSources: ['document', 'text'],
    actionRequired: 'Authorize automatic claim submission to aviation regulator',
  },
];

function NexusApp() {
  const { user, isLoading, isRecoveryMode, signOut } = useAuth();

  // Navigation state
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [cases] = useState<CaseItem[]>(INITIAL_CASES);

  // Optional local demo access state for prototyping & evaluation
  const [isDemoUser, setIsDemoUser] = useState<boolean>(false);

  // Handle Sign Out from either demo mode or Supabase session
  const handleSignOut = async () => {
    setIsDemoUser(false);
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
  const isAuthenticated = Boolean(user || isDemoUser);
  if (!isAuthenticated) {
    return (
      <AuthScreen
        initialView="login"
        onDemoAccess={() => setIsDemoUser(true)}
      />
    );
  }

  // 4. Authenticated Application Shell
  const pendingActionCount = cases.filter((c) => c.status === 'needs_approval').length;

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
              recentCases={cases}
            />
          )}

          {activeTab === 'cases' && (
            <CasesScreen
              cases={cases}
              onSelectCase={() => {
                // Future phase will bind to case details
              }}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileScreen
              onSignOut={handleSignOut}
              userEmail={user?.email || (isDemoUser ? 'demo.user@nexus.app' : undefined)}
              userName={
                (user?.user_metadata?.full_name as string) ||
                (isDemoUser ? 'Demo User' : undefined)
              }
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
