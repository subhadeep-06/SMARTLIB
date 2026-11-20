import React, { createContext, useContext, useEffect, useState } from 'react';
import { SmartLibApi, clearSession, getStoredSession, saveSession } from '../services/api';

const AuthContext = createContext(null);

export function getDefaultRouteForRole(role) {
  switch (role) {
    case 'SUPER_ADMIN':
      return '/super-admin';
    case 'BRANCH_ADMIN':
      return '/branch-admin';
    case 'LIBRARIAN':
      return '/librarian';
    default:
      return '/student';
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredSession().user);
  const [loading, setLoading] = useState(Boolean(getStoredSession().accessToken));

  useEffect(() => {
    const { accessToken } = getStoredSession();
    if (!accessToken) {
      setLoading(false);
      return;
    }
    SmartLibApi.getMe()
      .then((freshUser) => {
        setUser(freshUser);
        saveSession({ user: freshUser });
      })
      .catch(() => {
        clearSession();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const result = await SmartLibApi.login({ email, password });
    saveSession(result);
    setUser(result.user);
    return result.user;
  };

  const register = async (payload) => {
    const result = await SmartLibApi.register(payload);
    saveSession(result);
    setUser(result.user);
    return result.user;
  };

  const logout = async () => {
    const { refreshToken } = getStoredSession();
    try {
      if (refreshToken) await SmartLibApi.logout(refreshToken);
    } catch {
      // Ignore network errors on logout
    }
    clearSession();
    setUser(null);
  };

  const refreshUser = async () => {
    const fresh = await SmartLibApi.getMe();
    setUser(fresh);
    saveSession({ user: fresh });
    return fresh;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
