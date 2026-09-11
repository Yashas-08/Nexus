import { useState } from 'react';
import type { CaseItem, NavTab } from './types/cases';
import { AppHeader } from './components/AppHeader';
import { BottomNav } from './components/BottomNav';
import { HomeScreen } from './screens/HomeScreen';
import { CasesScreen } from './screens/CasesScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { AuthScreen } from './screens/AuthScreen';

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

export default function App() {
  // Authentication boundary state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [userEmail, setUserEmail] = useState<string>('alex.morgan@nexus.user');

  // Navigation state
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [cases] = useState<CaseItem[]>(INITIAL_CASES);

  // Authentication handlers
  const handleAuthenticate = (identifier?: string) => {
    if (identifier) {
      setUserEmail(identifier.includes('@') ? identifier : `${identifier}@mobile.user`);
    }
    setIsAuthenticated(true);
  };

  const handleSignOut = () => {
    setIsAuthenticated(false);
    setActiveTab('home');
  };

  // If unauthenticated, show AuthScreen boundary
  if (!isAuthenticated) {
    return <AuthScreen onAuthenticate={handleAuthenticate} />;
  }

  // Count cases needing approval for badge
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
                // In Phase 1 foundation, selecting case can remain visual or open details
              }}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileScreen
              onSignOut={handleSignOut}
              userEmail={userEmail}
              userName="Alex Morgan"
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
