import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, hasToken, setToken, setUnauthorizedHandler, type User } from './api';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(hasToken());

  const logout = useCallback(() => { setToken(null); setUser(null); }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!hasToken()) return;
    api.me().then(setUser).catch(logout).finally(() => setLoading(false));
  }, [logout]);

  const value = useMemo<AuthState>(() => ({
    user, loading, logout,
    login: async (email, password) => { const r = await api.login({ email, password }); setToken(r.accessToken); setUser(r.user); },
    signup: async (name, email, password) => { const r = await api.signup({ name, email, password }); setToken(r.accessToken); setUser(r.user); },
  }), [user, loading, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
