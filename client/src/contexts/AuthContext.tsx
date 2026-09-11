import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isRecoveryMode: boolean;
  setIsRecoveryMode: (active: boolean) => void;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<{ error: Error | null; user: User | null; requiresEmailConfirmation: boolean }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  requestPasswordReset: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRecoveryMode, setIsRecoveryMode] = useState<boolean>(false);

  useEffect(() => {
    // Check if initial URL contains a recovery hash (from email reset link)
    if (window.location.hash.includes('type=recovery') || window.location.hash.includes('reset-password')) {
      setIsRecoveryMode(true);
    }

    // If supabase is not configured, avoid restoring session to prevent network errors
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    // 1. Restore initial session on application mount
    const restoreSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('[NEXUS Auth] Session restoration notice:', error.message);
        } else if (data?.session) {
          setSession(data.session);
          setUser(data.session.user);
        }
      } catch (err) {
        console.warn('[NEXUS Auth] Could not restore existing session:', err);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();

    // 2. Set up single authoritative auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setIsLoading(false);

      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
      } else if (event === 'SIGNED_OUT') {
        setIsRecoveryMode(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return {
        error: new Error(
          'Supabase credentials are not detected. Please restart your Vite dev server (Ctrl+C then npm run dev).'
        ),
      };
    }
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      return { error };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Failed to sign in') };
    }
  };

  const signUpWithEmail = async (email: string, password: string, fullName: string) => {
    if (!isSupabaseConfigured) {
      return {
        error: new Error(
          'Supabase credentials are not detected. Please restart your Vite dev server (Ctrl+C then npm run dev).'
        ),
        user: null,
        requiresEmailConfirmation: false,
      };
    }
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (error) {
        return { error, user: null, requiresEmailConfirmation: false };
      }

      // If user was created but no session was returned, Supabase requires email confirmation
      const requiresEmailConfirmation = Boolean(data.user && !data.session);

      return {
        error: null,
        user: data.user,
        requiresEmailConfirmation,
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err : new Error('Failed to create account'),
        user: null,
        requiresEmailConfirmation: false,
      };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      return { error };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Google sign-in initiation failed') };
    }
  };

  const requestPasswordReset = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/#type=recovery`,
      });
      return { error };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Password reset request failed') };
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (!error) {
        setIsRecoveryMode(false);
      }
      return { error };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Password update failed') };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setIsRecoveryMode(false);
      return { error };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Sign out failed') };
    }
  };

  const value = useMemo(
    () => ({
      user,
      session,
      isLoading,
      isRecoveryMode,
      setIsRecoveryMode,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      requestPasswordReset,
      updatePassword,
      signOut,
    }),
    [user, session, isLoading, isRecoveryMode]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
