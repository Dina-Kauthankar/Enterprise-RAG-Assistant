'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAuthCookie, setAuthCookie, clearAuthCookie, getAuthHeaders } from '@/lib/cookies';
import { getFullApiUrl } from '@/lib/config';

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'employee';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  backendConnected: boolean;
  login: (token: string, role: string) => Promise<void>;
  logout: () => void;
  checkBackend: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  backendConnected: false,
  login: async () => {},
  logout: () => {},
  checkBackend: async () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [backendConnected, setBackendConnected] = useState(false);

  const checkBackend = async (): Promise<boolean> => {
    try {
      const url = getFullApiUrl('/api/v1/health');
      const res = await fetch(url);
      if (res.ok) {
        setBackendConnected(true);
        return true;
      }
    } catch {
      setBackendConnected(false);
    }
    return false;
  };

  const fetchUser = async (authToken: string) => {
    try {
      const url = getFullApiUrl('/api/v1/auth/me');
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        setToken(authToken);
        setBackendConnected(true);
      } else {
        logout();
      }
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkBackend();
    const savedToken = getAuthCookie();
    if (savedToken) {
      fetchUser(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (newToken: string, _role: string) => {
    setAuthCookie(newToken);
    setToken(newToken);
    await fetchUser(newToken);
  };

  const logout = () => {
    clearAuthCookie();
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, backendConnected, login, logout, checkBackend }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
