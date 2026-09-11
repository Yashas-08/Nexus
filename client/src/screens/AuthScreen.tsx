import { useState } from 'react';
import { ArrowRight, Shield } from 'lucide-react';

interface AuthScreenProps {
  onAuthenticate: (identifier?: string) => void;
}

export function AuthScreen({ onAuthenticate }: AuthScreenProps) {
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Please enter a valid phone number or email address');
      return;
    }
    setError(null);
    onAuthenticate(identifier.trim());
  };

  const handleDemoAccess = () => {
    onAuthenticate('alex.morgan@nexus.user');
  };

  return (
    <div className="min-h-screen w-full bg-stone-50 text-stone-900 flex flex-col justify-between px-6 py-10 max-w-md mx-auto antialiased">
      {/* Top Branding Section */}
      <div className="pt-12 pb-8 space-y-6 text-center">
        {/* Brand Icon */}
        <div className="w-16 h-16 rounded-2xl bg-stone-900 text-stone-50 mx-auto flex items-center justify-center shadow-md">
          <span className="text-2xl font-bold tracking-tighter">N</span>
        </div>

        {/* Brand Wordmark & Tagline */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-stone-900">
            nexus
          </h1>
          <p className="text-sm text-stone-500 max-w-xs mx-auto leading-relaxed">
            A calm bridge between human intent and complex real-world systems.
          </p>
        </div>
      </div>

      {/* Main Authentication Form */}
      <div className="w-full space-y-4 my-auto">
        <form onSubmit={handleContinue} className="space-y-3">
          <div className="space-y-1.5 text-left">
            <label
              htmlFor="auth-input"
              className="text-xs font-semibold uppercase tracking-wider text-stone-600 pl-1"
            >
              Sign In or Register
            </label>
            <input
              id="auth-input"
              type="text"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Enter phone number or email"
              className="w-full h-12 px-4 rounded-xl bg-white border border-stone-200 text-stone-900 placeholder:text-stone-400 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-stone-900 transition-all shadow-xs"
            />
            {error && (
              <p className="text-xs text-rose-600 pl-1 pt-0.5">{error}</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full h-12 rounded-xl bg-stone-900 text-stone-50 font-medium text-sm flex items-center justify-center gap-2 hover:bg-stone-800 transition-colors shadow-sm cursor-pointer"
          >
            <span>Continue</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-stone-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-stone-50 px-2 text-stone-400">or</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDemoAccess}
          className="w-full h-12 rounded-xl border border-stone-200 bg-white hover:bg-stone-100 text-stone-700 font-medium text-sm transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
        >
          <Shield className="w-4 h-4 text-stone-500" />
          <span>Enter with Demo Account</span>
        </button>
      </div>

      {/* Footer / Legal notes */}
      <div className="pt-8 text-center space-y-2">
        <p className="text-[11px] text-stone-400 max-w-xs mx-auto leading-normal">
          By tapping Continue, you accept our{' '}
          <span className="underline hover:text-stone-600 cursor-pointer">Privacy Policy</span>{' '}
          &{' '}
          <span className="underline hover:text-stone-600 cursor-pointer">Terms of Service</span>.
        </p>
      </div>
    </div>
  );
}
