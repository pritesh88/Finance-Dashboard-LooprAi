import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi } from '../api/endpoints';
import { SESSION_EXPIRED_EVENT, tokenStore } from '../api/client';
import type { AuthUser } from '../api/types';
import { useAlerts } from './AlertContext';

interface AuthContextValue {
  user: AuthUser | null;
  status: 'checking' | 'signed-out' | 'signed-in';
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthContextValue['status']>('checking');
  const { pushAlert } = useAlerts();

  useEffect(() => {
    let cancelled = false;
    if (!tokenStore.get()) {
      setStatus('signed-out');
      return;
    }
    authApi
      .me()
      .then((res) => {
        if (cancelled) return;
        setUser(res.user);
        setStatus('signed-in');
      })
      .catch(() => {
        if (cancelled) return;
        tokenStore.clear();
        setStatus('signed-out');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = useCallback(async (opts?: { silent?: boolean }) => {
    const hadToken = !!tokenStore.get();
    tokenStore.clear();
    setUser(null);
    setStatus('signed-out');
    if (hadToken && !opts?.silent) {
      try {
        await authApi.logout();
      } catch {
        // best-effort: the client-side session is already cleared either way
      }
    }
  }, []);

  useEffect(() => {
    const onExpired = () => {
      tokenStore.clear();
      setUser(null);
      setStatus('signed-out');
      pushAlert('warning', 'Your session has expired. Please sign in again.');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [pushAlert]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    tokenStore.set(res.token);
    setUser(res.user);
    setStatus('signed-in');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, logout: () => logout() }),
    [user, status, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
