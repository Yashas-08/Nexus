import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Mail,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type AuthView = 'login' | 'register' | 'forgot-password' | 'reset-password' | 'email-sent';

interface AuthScreenProps {
  initialView?: AuthView;
}

export function AuthScreen({ initialView = 'login' }: AuthScreenProps) {
  const {
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    requestPasswordReset,
    updatePassword,
  } = useAuth();

  const [view, setView] = useState<AuthView>(initialView);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [emailConfirmationAddress, setEmailConfirmationAddress] = useState<string>('');

  // Field-specific validation errors
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const clearErrors = () => {
    setFormError(null);
    setFieldErrors({});
  };

  const switchView = (newView: AuthView) => {
    clearErrors();
    setFormSuccess(null);
    setView(newView);
  };

  // Basic validation helpers
  const validateEmail = (val: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  };

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();

    const errors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      errors.email = 'Email address is required';
    } else if (!validateEmail(email)) {
      errors.email = 'Enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);
    const { error } = await signInWithEmail(email, password);
    setIsLoading(false);

    if (error) {
      // Map Supabase error message to calm user message
      if (error.message.toLowerCase().includes('invalid login credentials')) {
        setFormError('Invalid email or password. Please verify and try again.');
      } else if (error.message.toLowerCase().includes('email not confirmed')) {
        setFormError('Please verify your email address before signing in.');
      } else {
        setFormError(error.message);
      }
    }
  };

  // Handle Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();

    const errors: { name?: string; email?: string; password?: string; confirmPassword?: string } = {};

    if (!fullName.trim()) {
      errors.name = 'Full name is required';
    }

    if (!email.trim()) {
      errors.email = 'Email address is required';
    } else if (!validateEmail(email)) {
      errors.email = 'Enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);
    const { error, requiresEmailConfirmation } = await signUpWithEmail(email, password, fullName);
    setIsLoading(false);

    if (error) {
      setFormError(error.message);
    } else if (requiresEmailConfirmation) {
      setEmailConfirmationAddress(email.trim());
      setView('email-sent');
    }
  };

  // Handle Forgot Password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();

    if (!email.trim()) {
      setFieldErrors({ email: 'Email address is required' });
      return;
    }
    if (!validateEmail(email)) {
      setFieldErrors({ email: 'Enter a valid email address' });
      return;
    }

    setIsLoading(true);
    const { error } = await requestPasswordReset(email);
    setIsLoading(false);

    if (error) {
      setFormError(error.message);
    } else {
      setFormSuccess(`Password reset link sent to ${email.trim()}. Please check your inbox.`);
    }
  };

  // Handle Password Update (Reset Password flow)
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();

    const errors: { password?: string; confirmPassword?: string } = {};
    if (!password) {
      errors.password = 'New password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);
    const { error } = await updatePassword(password);
    setIsLoading(false);

    if (error) {
      setFormError(error.message);
    } else {
      setFormSuccess('Password successfully updated. You may now continue.');
      setTimeout(() => {
        setView('login');
      }, 1500);
    }
  };

  // Handle Google OAuth
  const handleGoogleSignIn = async () => {
    clearErrors();
    setIsLoading(true);
    const { error } = await signInWithGoogle();
    setIsLoading(false);

    if (error) {
      if (
        error.message.toLowerCase().includes('not enabled') ||
        error.message.toLowerCase().includes('unsupported provider')
      ) {
        setFormError(
          'Google authentication is not yet enabled on your Supabase project. Enable Google under Authentication > Providers in your Supabase dashboard.'
        );
      } else {
        setFormError(error.message);
      }
    }
  };

  return (
    <div className="min-h-screen w-full bg-stone-50 text-stone-900 flex flex-col justify-between px-6 py-8 max-w-md mx-auto antialiased">
      {/* Top Header & Brand */}
      <header className="pt-6 pb-4 space-y-4 text-center">
        {/* Back button for non-login views */}
        {view !== 'login' && view !== 'reset-password' && (
          <div className="flex justify-start">
            <button
              type="button"
              onClick={() => switchView('login')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-900 transition-colors p-1 -ml-1 rounded-lg focus:outline-none"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Sign In</span>
            </button>
          </div>
        )}

        {/* Brand Icon */}
        <div className="w-14 h-14 rounded-2xl bg-stone-900 text-stone-50 mx-auto flex items-center justify-center shadow-md">
          <span className="text-2xl font-bold tracking-tighter">N</span>
        </div>

        {/* Wordmark & Contextual Titles */}
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">
            {view === 'login' && 'Sign in to NEXUS'}
            {view === 'register' && 'Create your NEXUS account'}
            {view === 'forgot-password' && 'Reset your password'}
            {view === 'reset-password' && 'Set new password'}
            {view === 'email-sent' && 'Verify your email'}
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 max-w-xs mx-auto leading-relaxed">
            {view === 'login' && 'A calm bridge between human intent and complex systems.'}
            {view === 'register' && 'Start resolving real-world situations with structured clarity.'}
            {view === 'forgot-password' && 'Enter your registered email and we will send a reset link.'}
            {view === 'reset-password' && 'Enter your new secure password below.'}
            {view === 'email-sent' && 'Confirmation link dispatched to your inbox.'}
          </p>
        </div>
      </header>

      {/* Main Form Area */}
      <main className="w-full my-auto space-y-4">
        {/* Global Error Banner */}
        {formError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />
            <span className="leading-relaxed flex-1">{formError}</span>
          </div>
        )}

        {/* Global Success Banner */}
        {formSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
            <span className="leading-relaxed flex-1">{formSuccess}</span>
          </div>
        )}

        {/* VIEW: LOGIN */}
        {view === 'login' && (
          <form onSubmit={handleLogin} noValidate className="space-y-3.5">
            {/* Email field */}
            <div className="space-y-1">
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold uppercase tracking-wider text-stone-600 pl-0.5"
              >
                Email
              </label>
              <div className="relative">
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined });
                  }}
                  placeholder="name@example.com"
                  className={`w-full h-12 px-4 rounded-xl bg-white border text-stone-900 placeholder:text-stone-400 text-sm focus:outline-none focus:ring-2 transition-all shadow-xs ${
                    fieldErrors.email
                      ? 'border-rose-300 focus:ring-rose-500 focus:border-rose-500'
                      : 'border-stone-200 focus:ring-stone-900 focus:border-stone-900'
                  }`}
                />
              </div>
              {fieldErrors.email && (
                <p className="text-[11px] text-rose-600 pl-1 pt-0.5">{fieldErrors.email}</p>
              )}
            </div>

            {/* Password field */}
            <div className="space-y-1">
              <div className="flex items-center justify-between pl-0.5">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold uppercase tracking-wider text-stone-600"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => switchView('forgot-password')}
                  className="text-xs text-stone-500 hover:text-stone-900 font-medium transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: undefined });
                  }}
                  placeholder="Enter your password"
                  className={`w-full h-12 pl-4 pr-11 rounded-xl bg-white border text-stone-900 placeholder:text-stone-400 text-sm focus:outline-none focus:ring-2 transition-all shadow-xs ${
                    fieldErrors.password
                      ? 'border-rose-300 focus:ring-rose-500 focus:border-rose-500'
                      : 'border-stone-200 focus:ring-stone-900 focus:border-stone-900'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-1 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-[11px] text-rose-600 pl-1 pt-0.5">{fieldErrors.password}</p>
              )}
            </div>

            {/* Primary Sign In Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-stone-900 text-stone-50 font-medium text-sm flex items-center justify-center gap-2 hover:bg-stone-800 disabled:opacity-50 transition-all shadow-sm cursor-pointer mt-1"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* OAuth Separator */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-stone-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-stone-50 px-2.5 text-stone-400 font-medium">or continue with</span>
              </div>
            </div>

            {/* Google OAuth Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full h-12 rounded-xl border border-stone-200 bg-white hover:bg-stone-100/80 text-stone-700 font-medium text-sm transition-colors shadow-xs flex items-center justify-center gap-3 cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Switch to Register */}
            <div className="pt-2 text-center">
              <p className="text-xs text-stone-500">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchView('register')}
                  className="font-semibold text-stone-900 hover:underline"
                >
                  Create account
                </button>
              </p>
            </div>
          </form>
        )}

        {/* VIEW: REGISTER */}
        {view === 'register' && (
          <form onSubmit={handleRegister} noValidate className="space-y-3">
            {/* Full Name */}
            <div className="space-y-1">
              <label
                htmlFor="register-name"
                className="block text-xs font-semibold uppercase tracking-wider text-stone-600 pl-0.5"
              >
                Full Name
              </label>
              <div className="relative">
                <input
                  id="register-name"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: undefined });
                  }}
                  placeholder="First and last name"
                  className={`w-full h-12 px-4 rounded-xl bg-white border text-stone-900 placeholder:text-stone-400 text-sm focus:outline-none focus:ring-2 transition-all shadow-xs ${
                    fieldErrors.name
                      ? 'border-rose-300 focus:ring-rose-500 focus:border-rose-500'
                      : 'border-stone-200 focus:ring-stone-900 focus:border-stone-900'
                  }`}
                />
              </div>
              {fieldErrors.name && (
                <p className="text-[11px] text-rose-600 pl-1 pt-0.5">{fieldErrors.name}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label
                htmlFor="register-email"
                className="block text-xs font-semibold uppercase tracking-wider text-stone-600 pl-0.5"
              >
                Email
              </label>
              <div className="relative">
                <input
                  id="register-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined });
                  }}
                  placeholder="name@example.com"
                  className={`w-full h-12 px-4 rounded-xl bg-white border text-stone-900 placeholder:text-stone-400 text-sm focus:outline-none focus:ring-2 transition-all shadow-xs ${
                    fieldErrors.email
                      ? 'border-rose-300 focus:ring-rose-500 focus:border-rose-500'
                      : 'border-stone-200 focus:ring-stone-900 focus:border-stone-900'
                  }`}
                />
              </div>
              {fieldErrors.email && (
                <p className="text-[11px] text-rose-600 pl-1 pt-0.5">{fieldErrors.email}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label
                htmlFor="register-password"
                className="block text-xs font-semibold uppercase tracking-wider text-stone-600 pl-0.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: undefined });
                  }}
                  placeholder="Minimum 6 characters"
                  className={`w-full h-12 pl-4 pr-11 rounded-xl bg-white border text-stone-900 placeholder:text-stone-400 text-sm focus:outline-none focus:ring-2 transition-all shadow-xs ${
                    fieldErrors.password
                      ? 'border-rose-300 focus:ring-rose-500 focus:border-rose-500'
                      : 'border-stone-200 focus:ring-stone-900 focus:border-stone-900'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-1 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-[11px] text-rose-600 pl-1 pt-0.5">{fieldErrors.password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1">
              <label
                htmlFor="register-confirm-password"
                className="block text-xs font-semibold uppercase tracking-wider text-stone-600 pl-0.5"
              >
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="register-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (fieldErrors.confirmPassword)
                      setFieldErrors({ ...fieldErrors, confirmPassword: undefined });
                  }}
                  placeholder="Re-enter password"
                  className={`w-full h-12 pl-4 pr-11 rounded-xl bg-white border text-stone-900 placeholder:text-stone-400 text-sm focus:outline-none focus:ring-2 transition-all shadow-xs ${
                    fieldErrors.confirmPassword
                      ? 'border-rose-300 focus:ring-rose-500 focus:border-rose-500'
                      : 'border-stone-200 focus:ring-stone-900 focus:border-stone-900'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-1 focus:outline-none"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <p className="text-[11px] text-rose-600 pl-1 pt-0.5">{fieldErrors.confirmPassword}</p>
              )}
            </div>

            {/* Create Account Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-stone-900 text-stone-50 font-medium text-sm flex items-center justify-center gap-2 hover:bg-stone-800 disabled:opacity-50 transition-all shadow-sm cursor-pointer mt-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Creating account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Link back to login */}
            <div className="pt-2 text-center">
              <p className="text-xs text-stone-500">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchView('login')}
                  className="font-semibold text-stone-900 hover:underline"
                >
                  Sign in
                </button>
              </p>
            </div>
          </form>
        )}

        {/* VIEW: FORGOT PASSWORD */}
        {view === 'forgot-password' && (
          <form onSubmit={handleForgotPassword} noValidate className="space-y-4">
            <div className="space-y-1">
              <label
                htmlFor="forgot-email"
                className="block text-xs font-semibold uppercase tracking-wider text-stone-600 pl-0.5"
              >
                Registered Email
              </label>
              <div className="relative">
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined });
                  }}
                  placeholder="name@example.com"
                  className={`w-full h-12 px-4 rounded-xl bg-white border text-stone-900 placeholder:text-stone-400 text-sm focus:outline-none focus:ring-2 transition-all shadow-xs ${
                    fieldErrors.email
                      ? 'border-rose-300 focus:ring-rose-500 focus:border-rose-500'
                      : 'border-stone-200 focus:ring-stone-900 focus:border-stone-900'
                  }`}
                />
              </div>
              {fieldErrors.email && (
                <p className="text-[11px] text-rose-600 pl-1 pt-0.5">{fieldErrors.email}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-stone-900 text-stone-50 font-medium text-sm flex items-center justify-center gap-2 hover:bg-stone-800 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Sending link...</span>
                </>
              ) : (
                <>
                  <span>Send Reset Link</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => switchView('login')}
              className="w-full h-11 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 font-medium text-xs transition-colors flex items-center justify-center"
            >
              Return to Sign In
            </button>
          </form>
        )}

        {/* VIEW: RESET PASSWORD (from recovery link) */}
        {view === 'reset-password' && (
          <form onSubmit={handleUpdatePassword} noValidate className="space-y-3.5">
            <div className="space-y-1">
              <label
                htmlFor="new-password"
                className="block text-xs font-semibold uppercase tracking-wider text-stone-600 pl-0.5"
              >
                New Password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: undefined });
                  }}
                  placeholder="Minimum 6 characters"
                  className={`w-full h-12 pl-4 pr-11 rounded-xl bg-white border text-stone-900 placeholder:text-stone-400 text-sm focus:outline-none focus:ring-2 transition-all shadow-xs ${
                    fieldErrors.password
                      ? 'border-rose-300 focus:ring-rose-500 focus:border-rose-500'
                      : 'border-stone-200 focus:ring-stone-900 focus:border-stone-900'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-1 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-[11px] text-rose-600 pl-1 pt-0.5">{fieldErrors.password}</p>
              )}
            </div>

            <div className="space-y-1">
              <label
                htmlFor="confirm-new-password"
                className="block text-xs font-semibold uppercase tracking-wider text-stone-600 pl-0.5"
              >
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="confirm-new-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (fieldErrors.confirmPassword)
                      setFieldErrors({ ...fieldErrors, confirmPassword: undefined });
                  }}
                  placeholder="Confirm new password"
                  className={`w-full h-12 pl-4 pr-11 rounded-xl bg-white border text-stone-900 placeholder:text-stone-400 text-sm focus:outline-none focus:ring-2 transition-all shadow-xs ${
                    fieldErrors.confirmPassword
                      ? 'border-rose-300 focus:ring-rose-500 focus:border-rose-500'
                      : 'border-stone-200 focus:ring-stone-900 focus:border-stone-900'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-1 focus:outline-none"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <p className="text-[11px] text-rose-600 pl-1 pt-0.5">{fieldErrors.confirmPassword}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-stone-900 text-stone-50 font-medium text-sm flex items-center justify-center gap-2 hover:bg-stone-800 disabled:opacity-50 transition-all shadow-sm cursor-pointer mt-1"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Updating password...</span>
                </>
              ) : (
                <>
                  <span>Save New Password</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* VIEW: EMAIL CONFIRMATION PENDING */}
        {view === 'email-sent' && (
          <div className="space-y-4 text-center py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center">
              <Mail className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h2 className="text-base font-semibold text-stone-900">Check your inbox</h2>
              <p className="text-xs text-stone-600 leading-relaxed max-w-xs mx-auto">
                We sent a confirmation link to{' '}
                <span className="font-semibold text-stone-900">{emailConfirmationAddress}</span>.
                Tap the link inside to activate your account.
              </p>
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={() => switchView('login')}
                className="w-full h-12 rounded-xl bg-stone-900 text-stone-50 font-medium text-sm flex items-center justify-center gap-2 hover:bg-stone-800 transition-colors cursor-pointer"
              >
                <span>Proceed to Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer / Legal Notes */}
      <footer className="pt-6 text-center space-y-1">
        <p className="text-[11px] text-stone-400 max-w-xs mx-auto leading-normal">
          By signing in or registering, you agree to our{' '}
          <span className="underline hover:text-stone-600 cursor-pointer">Terms</span> &{' '}
          <span className="underline hover:text-stone-600 cursor-pointer">Privacy Policy</span>.
        </p>
      </footer>
    </div>
  );
}
