import { deleteItem, getItem, setItem } from "../utils/storage";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type User = {
  id: string;
  email: string;
  name?: string;
};

type Session = {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
};

type AuthContextType = {
  isBootstrapping: boolean;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const REFRESH_TOKEN_KEY = "refreshToken";
const ACCESS_TOKEN_KEY = "accessToken";

// Set this to your backend
const API_URL = process.env.EXPO_BACKEND_API_URL ?? "http://localhost:3000";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  const loadStoredTokens = useCallback(async () => {
    const [refreshToken, accessToken] = await Promise.all([
      getItem(REFRESH_TOKEN_KEY),
      getItem(ACCESS_TOKEN_KEY),
    ]);
    return { refreshToken, accessToken };
  }, []);

  const persistTokens = useCallback(
    async (accessToken: string, refreshToken: string) => {
      await Promise.all([
        setItem(ACCESS_TOKEN_KEY, accessToken),
        setItem(REFRESH_TOKEN_KEY, refreshToken),
      ]);
    },
    []
  );

  const clearTokens = useCallback(async () => {
    await Promise.all([
      deleteItem(ACCESS_TOKEN_KEY),
      deleteItem(REFRESH_TOKEN_KEY),
    ]);
  }, []);

  const refreshWithToken = useCallback(
    async (refreshToken: string) => {
      const res = await fetch(`${API_URL}/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) throw new Error("Refresh failed");
      const data = (await res.json()) as {
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
        sessionId: string;
      };
      await persistTokens(data.accessToken, data.refreshToken);
      setSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        sessionId: data.sessionId,
      });
    },
    [persistTokens]
  );

  const refresh = useCallback(async () => {
    const { refreshToken } = await loadStoredTokens();
    if (!refreshToken) throw new Error("No refresh token");
    await refreshWithToken(refreshToken);
  }, [loadStoredTokens, refreshWithToken]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await fetch(`${API_URL}/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Login failed");
      }
      const data = (await res.json()) as {
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
        sessionId: string;
      };
      await persistTokens(data.accessToken, data.refreshToken);
      setSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        sessionId: data.sessionId,
      });
    },
    [persistTokens]
  );

  const signOut = useCallback(async () => {
    try {
      const { refreshToken } = await loadStoredTokens();
      if (refreshToken) {
        // Optional: revoke on server
        void fetch(`${API_URL}/v1/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch {}
    await clearTokens();
    setSession(null);
  }, [clearTokens, loadStoredTokens]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { refreshToken } = await loadStoredTokens();
        if (refreshToken) {
          await refreshWithToken(refreshToken);
        }
      } catch {
        await clearTokens();
        setSession(null);
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clearTokens, loadStoredTokens, refreshWithToken]);

  const value = useMemo(
    () => ({ isBootstrapping, session, signIn, signOut, refresh }),
    [isBootstrapping, session, signIn, signOut, refresh]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};