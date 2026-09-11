import { Home, Layers, User } from 'lucide-react';
import type { NavTab } from '../types/cases';

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  casesBadgeCount?: number;
}

export function BottomNav({ activeTab, onTabChange, casesBadgeCount = 0 }: BottomNavProps) {
  const tabs: Array<{ id: NavTab; label: string; icon: typeof Home; badge?: number }> = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'cases', label: 'Cases', icon: Layers, badge: casesBadgeCount },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <nav
      aria-label="Main Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-stone-50/95 backdrop-blur-md border-t border-stone-200/80 pb-[env(safe-area-inset-bottom,12px)] pt-1.5"
    >
      <div className="max-w-md mx-auto px-6 flex items-center justify-around">
        {tabs.map(({ id, label, icon: Icon, badge }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              className={`flex flex-col items-center justify-center min-w-[64px] min-h-[48px] py-1 px-3 rounded-xl transition-all relative ${
                isActive
                  ? 'text-stone-900 font-semibold'
                  : 'text-stone-400 hover:text-stone-600 font-medium'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform duration-150 ${
                    isActive ? 'scale-110 text-stone-900 stroke-[2.25]' : 'stroke-[1.75]'
                  }`}
                />
                {Boolean(badge && badge > 0) && (
                  <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-stone-900 text-stone-50 text-[10px] font-bold flex items-center justify-center ring-2 ring-stone-50">
                    {badge}
                  </span>
                )}
              </div>
              <span className={`text-[11px] mt-1 tracking-tight ${isActive ? 'text-stone-900' : 'text-stone-500'}`}>
                {label}
              </span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-stone-900 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
