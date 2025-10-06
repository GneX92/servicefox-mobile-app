import { deleteItem, getItem, setItem } from "../utils/storage";

import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
// Lightweight JWT exp decoder (no validation) for scheduling refresh.
const decodeJwtExp = (token: string): number | null => {
  try {
    const [, payloadB64] = token.split(".");
    if (!payloadB64) return null;
    const b64 = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    let json: string;
    if (typeof atob === "function") json = atob(b64);
    else if (typeof Buffer !== "undefined") json = Buffer.from(b64, "base64").toString("utf8");
    else return null;
    const payload = JSON.parse(json);
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
};

// (User type removed; not presently used.)

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
  // Generic authenticated fetch helper; auto refresh + retry once.
  apiFetch: (
    input: RequestInfo | URL,
    init?: RequestInit & { skipAuth?: boolean }
  ) => Promise<Response>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const REFRESH_TOKEN_KEY = "refreshToken";
const ACCESS_TOKEN_KEY = "accessToken";
const SESSION_ID_KEY = "sessionId";

// Set this to your backend
const API_URL = process.env.EXPO_PUBLIC_BACKEND_API_URL; 
// ?? "http://localhost:3000";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  // Timer stored in ref to avoid re-render loops when scheduling.
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Prevent parallel refresh calls that can invalidate a rotating refresh token.
  const refreshInFlightRef = useRef<Promise<void> | null>(null);

    const clearRefreshTimer = useCallback((): void => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    }, []);

  const scheduleRefresh = useCallback((accessToken: string, refresher: () => Promise<void>): void => {
    clearRefreshTimer();
    const expMs = decodeJwtExp(accessToken);
    if (!expMs) return; // Can't schedule without exp
    const now = Date.now();
    const lead = 60_000; // refresh 60s before expiry
    let delay = expMs - now - lead;
    if (delay < 5_000) delay = 5_000; // minimum 5s to avoid loops
    refreshTimerRef.current = setTimeout(() => {
      refresher().catch(() => {});
    }, delay);
  }, [clearRefreshTimer]);

  const loadStoredTokens = useCallback(async () => {
    const [refreshToken, accessToken, sessionId] = await Promise.all([
      getItem(REFRESH_TOKEN_KEY),
      getItem(ACCESS_TOKEN_KEY),
      getItem(SESSION_ID_KEY),
    ]);
    return { refreshToken, accessToken, sessionId };
  }, []);

  const persistTokens = useCallback(
    async (accessToken: string, refreshToken: string, sessionId?: string) => {
      const writes: Promise<void>[] = [
        setItem(ACCESS_TOKEN_KEY, accessToken),
        setItem(REFRESH_TOKEN_KEY, refreshToken),
      ];
      if (sessionId) writes.push(setItem(SESSION_ID_KEY, sessionId));
      await Promise.all(writes);
    },
    []
  );

  const clearTokens = useCallback(async () => {
    await Promise.all([
      deleteItem(ACCESS_TOKEN_KEY),
      deleteItem(REFRESH_TOKEN_KEY),
      deleteItem(SESSION_ID_KEY),
    ]);
  }, []);

  const refreshWithToken = useCallback(async (refreshToken: string, providedSessionId?: string): Promise<void> => {
      const sid = providedSessionId || session?.sessionId || (await getItem(SESSION_ID_KEY)) || undefined;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (sid) headers["x-session-id"] = sid;
      const res = await fetch(`${API_URL}/v1/auth/refresh`, {
        method: "POST",
        headers,
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        // Surface textual server error if present for easier debugging.
        const msg = await res.text().catch(() => "");
        throw new Error(msg || "Refresh failed");
      }
      const data = (await res.json()) as {
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
        sessionId: string;
      };
      await persistTokens(data.accessToken, data.refreshToken, data.sessionId);
      setSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        sessionId: data.sessionId,
      });
      // Schedule next refresh using the newly returned refresh token directly.
      scheduleRefresh(data.accessToken, () => refreshWithToken(data.refreshToken));
  }, [persistTokens, scheduleRefresh, session?.sessionId]);

  const refresh = useCallback(async (): Promise<void> => {
    // Reuse in-flight promise to avoid double refresh with rotating tokens.
    if (refreshInFlightRef.current) return refreshInFlightRef.current;
    const p = (async () => {
      const { refreshToken, sessionId } = await loadStoredTokens();
      if (!refreshToken) throw new Error("No refresh token");
      await refreshWithToken(refreshToken, sessionId || undefined);
    })();
    refreshInFlightRef.current = p;
    try {
      await p;
    } finally {
      // Small delay to allow any awaiting apiFetch 401 retries to read new token before clearing.
      refreshInFlightRef.current = null;
    }
  }, [loadStoredTokens, refreshWithToken]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<void> => {
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
      await persistTokens(data.accessToken, data.refreshToken, data.sessionId);
      setSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        sessionId: data.sessionId,
      });
      scheduleRefresh(data.accessToken, () => refreshWithToken(data.refreshToken));
    },
    [persistTokens, scheduleRefresh, refreshWithToken]
  );

  const signOut = useCallback(async (): Promise<void> => {
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
    clearRefreshTimer();
  }, [clearTokens, loadStoredTokens, clearRefreshTimer]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { refreshToken, sessionId } = await loadStoredTokens();
        if (refreshToken) {
          await refreshWithToken(refreshToken, sessionId || undefined);
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

  // Helper to wrap fetch with automatic header injection & refresh-on-401.
  const apiFetch = useCallback<AuthContextType["apiFetch"]>(async (input, init) => {
    const skipAuth = init?.skipAuth;
    const token = session?.accessToken;
    const doFetch = async (attemptRefresh: boolean): Promise<Response> => {
      const headers = new Headers(init?.headers || {});
  if (!skipAuth && token) headers.set("Authorization", `Bearer ${token}`);
  if (!skipAuth && session?.sessionId) headers.set("x-session-id", session.sessionId);
      const res = await fetch(input, { ...init, headers });
      if (res.status === 401 && !skipAuth && attemptRefresh) {
        try {
          await refresh();
          const newToken = (await getItem(ACCESS_TOKEN_KEY)) || session?.accessToken;
          if (newToken) {
            const retryHeaders = new Headers(init?.headers || {});
            retryHeaders.set("Authorization", `Bearer ${newToken}`);
            return fetch(input, { ...init, headers: retryHeaders });
          }
        } catch {
          // If refresh failed due to race (e.g., rotating token invalid), allow fall-through.
        }
      }
      return res;
    };
    return doFetch(true);
  }, [session?.accessToken, session?.sessionId, refresh]);

  // If session changes (e.g., after a manual refresh outside signIn), reschedule.
  useEffect(() => {
    if (session?.accessToken && session.refreshToken) {
      scheduleRefresh(session.accessToken, () => refreshWithToken(session.refreshToken));
    }
  }, [session?.accessToken, session?.refreshToken, scheduleRefresh, refreshWithToken]);

  const value = useMemo(
    () => ({ isBootstrapping, session, signIn, signOut, refresh, apiFetch }),
    [isBootstrapping, session, signIn, signOut, refresh, apiFetch]
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