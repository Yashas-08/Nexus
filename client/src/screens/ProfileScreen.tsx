import { useState } from 'react';
import { Bell, ChevronRight, Lock, LogOut, Shield, Smartphone } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface ProfileScreenProps {
  onSignOut?: () => void;
  userEmail?: string;
  userName?: string;
}

export function ProfileScreen({
  onSignOut,
  userEmail: propEmail,
  userName: propName,
}: ProfileScreenProps) {
  const { user, signOut } = useAuth();

  const [urgentAlerts, setUrgentAlerts] = useState(true);
  const [resolutionUpdates, setResolutionUpdates] = useState(true);
  const [locationContext, setLocationContext] = useState(true);

  // Derive user info from Supabase session or props
  const userEmail = propEmail || user?.email || 'alex.morgan@nexus.user';
  const userName =
    propName ||
    (user?.user_metadata?.full_name as string) ||
    (user?.email ? user.email.split('@')[0].replace('.', ' ') : 'Alex Morgan');

  const handleSignOut = async () => {
    if (onSignOut) {
      onSignOut();
    } else {
      await signOut();
    }
  };

  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="w-full px-4 pt-6 pb-28 max-w-md mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Account & Settings
        </h1>
        <p className="text-xs sm:text-sm text-stone-500">
          Manage your personal verification identity and preferences.
        </p>
      </div>

      {/* Account Identity Card */}
      <section className="p-4 rounded-2xl bg-white border border-stone-200/90 shadow-xs flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-full bg-stone-900 text-stone-100 font-semibold flex items-center justify-center text-base tracking-tight shrink-0">
          {initials || 'NX'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-stone-900 truncate capitalize">
              {userName}
            </h2>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
              Personal
            </span>
          </div>
          <p className="text-xs text-stone-500 truncate mt-0.5">{userEmail}</p>
        </div>
      </section>

      {/* Notification Preferences */}
      <section className="rounded-2xl bg-white border border-stone-200/90 shadow-xs divide-y divide-stone-100 overflow-hidden">
        <div className="px-4 py-3 bg-stone-50/50">
          <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            Notifications
          </h3>
        </div>

        {/* Toggle 1 */}
        <label className="px-4 py-3.5 flex items-center justify-between cursor-pointer hover:bg-stone-50/50 transition-colors">
          <div className="space-y-0.5 pr-4">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-stone-600" />
              <span className="text-xs sm:text-sm font-medium text-stone-800">
                Urgent Situation Alerts
              </span>
            </div>
            <p className="text-xs text-stone-500 pl-6">
              Instant alerts when safety or time-critical cases require attention.
            </p>
          </div>
          <input
            type="checkbox"
            checked={urgentAlerts}
            onChange={(e) => setUrgentAlerts(e.target.checked)}
            className="w-4 h-4 rounded text-stone-900 focus:ring-stone-900 border-stone-300 accent-stone-900"
          />
        </label>

        {/* Toggle 2 */}
        <label className="px-4 py-3.5 flex items-center justify-between cursor-pointer hover:bg-stone-50/50 transition-colors">
          <div className="space-y-0.5 pr-4">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-stone-600" />
              <span className="text-xs sm:text-sm font-medium text-stone-800">
                Resolution Updates
              </span>
            </div>
            <p className="text-xs text-stone-500 pl-6">
              Notifications when documents verify or external parties respond.
            </p>
          </div>
          <input
            type="checkbox"
            checked={resolutionUpdates}
            onChange={(e) => setResolutionUpdates(e.target.checked)}
            className="w-4 h-4 rounded text-stone-900 focus:ring-stone-900 border-stone-300 accent-stone-900"
          />
        </label>
      </section>

      {/* Privacy & Safety */}
      <section className="rounded-2xl bg-white border border-stone-200/90 shadow-xs divide-y divide-stone-100 overflow-hidden">
        <div className="px-4 py-3 bg-stone-50/50">
          <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            Privacy & Permissions
          </h3>
        </div>

        <label className="px-4 py-3.5 flex items-center justify-between cursor-pointer hover:bg-stone-50/50 transition-colors">
          <div className="space-y-0.5 pr-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-stone-600" />
              <span className="text-xs sm:text-sm font-medium text-stone-800">
                Location Context
              </span>
            </div>
            <p className="text-xs text-stone-500 pl-6">
              Allows linking municipal sensors & incident reports to your area.
            </p>
          </div>
          <input
            type="checkbox"
            checked={locationContext}
            onChange={(e) => setLocationContext(e.target.checked)}
            className="w-4 h-4 rounded text-stone-900 focus:ring-stone-900 border-stone-300 accent-stone-900"
          />
        </label>

        <div className="px-4 py-3.5 flex items-center justify-between hover:bg-stone-50/50 transition-colors cursor-pointer">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-stone-600" />
            <span className="text-xs sm:text-sm font-medium text-stone-800">
              Data Retention Policy
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-stone-500">
            <span>30 days post-resolution</span>
            <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
          </div>
        </div>
      </section>

      {/* Sign Out & Session */}
      <section className="space-y-3 pt-2">
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full py-3 px-4 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-sm font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
        >
          <LogOut className="w-4 h-4 text-stone-500" />
          <span>Sign Out</span>
        </button>

        <p className="text-center text-[11px] text-stone-400">
          NEXUS Consumer App &bull; Version 1.0 Foundation
        </p>
      </section>
    </div>
  );
}
