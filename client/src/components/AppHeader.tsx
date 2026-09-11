import { Bell, Shield } from 'lucide-react';

interface AppHeaderProps {
  onNotificationClick?: () => void;
  unreadCount?: number;
}

export function AppHeader({ onNotificationClick, unreadCount = 0 }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 w-full bg-stone-50/90 backdrop-blur-md border-b border-stone-200/70 px-4 py-3 transition-colors">
      <div className="flex items-center justify-between max-w-lg mx-auto">
        {/* Brand identity */}
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-stone-900 flex items-center justify-center text-stone-50 shadow-sm">
            <span className="font-semibold text-sm tracking-tighter">N</span>
          </div>
          <div>
            <span className="text-base font-semibold tracking-tight text-stone-900">
              nexus
            </span>
          </div>
        </div>

        {/* Right action area */}
        <div className="flex items-center space-x-1.5">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-stone-100 text-stone-600 text-[11px] font-medium border border-stone-200/60">
            <Shield className="w-3 h-3 text-stone-500" />
            <span>Secure</span>
          </div>

          <button
            type="button"
            onClick={onNotificationClick}
            aria-label="Notifications"
            className="relative w-9 h-9 flex items-center justify-center rounded-full text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors focus:outline-none focus:ring-2 focus:ring-stone-400"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-stone-900 ring-2 ring-stone-50" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
