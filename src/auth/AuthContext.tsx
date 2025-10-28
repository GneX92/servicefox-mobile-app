import { fetch, type FetchRequestInit } from "expo/fetch";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform } from 'react-native';
import { buildApiUrl } from "../config/api";
import { DEVICE_ID_KEY, PUSH_TOKEN_KEY } from "../utils/pushNotifications";
import { deleteItem, getItem, setItem } from "../utils/storage";

// ------------------------------------------------------------
// Hilfsfunktionen & Typen
// ------------------------------------------------------------

// Leichtgewichtiger Decoder nur für 'exp' (keine Verifikation des JWT!).
// Gibt Ablaufzeit (ms seit Epoch) oder null zurück.
const decodeJwtExp = (token: string): number | null => {
  try {
    const [, payloadB64] = token.split(".");
    if (!payloadB64) return null;
    const normalized = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    let json: string;
    if (typeof atob === "function") json = atob(normalized);
    else if (typeof Buffer !== "undefined") json = Buffer.from(normalized, "base64").toString("utf8");
    else return null; // Kein Decoder verfügbar
    const payload = JSON.parse(json);
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null; // Defensiv: ungültiges Token ignorieren
  }
};

// Sitzungstokens im Speicher / Kontext
type Session = {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
};

// Antwortstruktur vom Backend für Login/Refresh.
interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // Sekunden (nur für Scheduling genutzt, aktuell wird 'exp' direkt aus dem JWT gelesen)
  sessionId: string;
}

type AuthContextType = {
  isBootstrapping: boolean;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  apiFetch: (
    input: string | URL,
    init?: RequestInit & { skipAuth?: boolean }
  ) => Promise<Response>;
};

const AuthContext = createContext<AuthContextType | null>(null);

// Storage Schlüssel
const REFRESH_TOKEN_STORAGE_KEY = "refreshToken";
const ACCESS_TOKEN_STORAGE_KEY = "accessToken";
const SESSION_ID_STORAGE_KEY = "sessionId";


// Mindestvorlauf vor Ablauf (ms) für Refresh.
const REFRESH_LEAD_TIME_MS = 60_000; // 60s
// Minimaler Delay um Endlos-Loops bei sofortigem Refresh zu vermeiden.
const MIN_REFRESH_DELAY_MS = 5_000;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isBootstrapping, setIsBootstrapping] = useState(true); // true bis initiale Token-Prüfung fertig
  const [session, setSession] = useState<Session | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Geplanter Refresh
  const refreshInFlightRef = useRef<Promise<void> | null>(null); // Verhindert parallele Refresh-Calls

  // Löscht einen evtl. geplanten Refresh.
  const clearRefreshTimer = useCallback((): void => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  // Plant einen Refresh rechtzeitig vor Ablauf des Access Tokens.
  const scheduleRefresh = useCallback((accessToken: string, refreshFn: () => Promise<void>): void => {
    clearRefreshTimer();
    const expiresAt = decodeJwtExp(accessToken);
    if (!expiresAt) return;
    const now = Date.now();
    let delay = expiresAt - now - REFRESH_LEAD_TIME_MS;
    if (delay < MIN_REFRESH_DELAY_MS) delay = MIN_REFRESH_DELAY_MS;
    refreshTimerRef.current = setTimeout(() => {
      refreshFn().catch(() => {}); // Fehler hier bewusst ignoriert
    }, delay);
  }, [clearRefreshTimer]);

  // Liest Tokens aus persistentem Storage.
  const loadStoredTokens = useCallback(async () => {
    const [refreshToken, accessToken, sessionId] = await Promise.all([
      getItem(REFRESH_TOKEN_STORAGE_KEY),
      getItem(ACCESS_TOKEN_STORAGE_KEY),
      getItem(SESSION_ID_STORAGE_KEY),
    ]);
    return { refreshToken, accessToken, sessionId };
  }, []);

  // Speichert Tokens
  const persistTokens = useCallback(async (accessToken: string, refreshToken: string, sessionId?: string) => {
    const writes: Promise<void>[] = [
      setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken),
      setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken),
    ];
    if (sessionId) writes.push(setItem(SESSION_ID_STORAGE_KEY, sessionId));
    await Promise.all(writes);
  }, []);

  // Löscht alle sicherheitsrelevanten Tokens (inkl. Push Token).
  const clearTokens = useCallback(async () => {
    await Promise.all([
      deleteItem(ACCESS_TOKEN_STORAGE_KEY),
      deleteItem(REFRESH_TOKEN_STORAGE_KEY),
      deleteItem(SESSION_ID_STORAGE_KEY),
      deleteItem(PUSH_TOKEN_KEY), // Push Token zurücksetzen bei kompletter Abmeldung
    ]);
  }, []);

  // Führt einen Refresh mit gegebenem Refresh Token aus.
  const refreshWithToken = useCallback(async (refreshToken: string, providedSessionId?: string): Promise<void> => {
    const sid = providedSessionId || session?.sessionId || (await getItem(SESSION_ID_STORAGE_KEY)) || undefined;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (sid) headers["x-session-id"] = sid;
  const res = await fetch(buildApiUrl(`/v1/auth/refresh`), {
      method: "POST",
      headers,
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(msg || "Refresh failed");
    }
    const data: TokenResponse = await res.json();
    await persistTokens(data.accessToken, data.refreshToken, data.sessionId);
    setSession({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      sessionId: data.sessionId,
    });
    // Nächsten Refresh planen (rekursiver Verweis auf aktualisiertes Token)
    scheduleRefresh(data.accessToken, () => refreshWithToken(data.refreshToken));
  }, [persistTokens, scheduleRefresh, session?.sessionId]);

  // Öffentliche Refresh-Funktion (verhindert parallele Aufrufe).
  const refresh = useCallback(async (): Promise<void> => {
    if (refreshInFlightRef.current) return refreshInFlightRef.current; // Bereits laufend
    const refreshPromise = (async () => {
      const { refreshToken, sessionId } = await loadStoredTokens();
      if (!refreshToken) throw new Error("No refresh token");
      await refreshWithToken(refreshToken, sessionId || undefined);
    })();
    refreshInFlightRef.current = refreshPromise;
    try {
      await refreshPromise;
    } finally {
      refreshInFlightRef.current = null; // Freigeben
    }
  }, [loadStoredTokens, refreshWithToken]);

  // Login mit Credentials.
  const signIn = useCallback(async (email: string, password: string): Promise<void> => {
  const res = await fetch(buildApiUrl(`/v1/auth/login`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg || "Login failed");
    }
    const data: TokenResponse = await res.json();
    await persistTokens(data.accessToken, data.refreshToken, data.sessionId);
    setSession({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      sessionId: data.sessionId,
    });
    scheduleRefresh(data.accessToken, () => refreshWithToken(data.refreshToken));
  }, [persistTokens, scheduleRefresh, refreshWithToken]);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      const { refreshToken } = await loadStoredTokens();
      const accessToken = await getItem(ACCESS_TOKEN_STORAGE_KEY);
      const pushToken = await getItem(PUSH_TOKEN_KEY);
      const deviceId = await getItem(DEVICE_ID_KEY);

      // Push Token deregistrieren
      if (pushToken) {
  void fetch(buildApiUrl(`/push/register`), {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ token: pushToken, platform: Platform.OS, deviceId }),
        }).catch(() => {});
      }

      // Serverseitiges Logout
      if (refreshToken) {
  void fetch(buildApiUrl(`/v1/auth/logout`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch {
      // Schweigend ignorieren: lokaler Logout hat Vorrang.
    }
    await clearTokens();
    setSession(null);
    clearRefreshTimer();
  }, [clearTokens, loadStoredTokens, clearRefreshTimer]);

  // vorhandene Tokens prüfen & ggf. refreshen.
  useEffect(() => {
    let isCancelled = false;
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
        if (!isCancelled) setIsBootstrapping(false);
      }
    })();
    return () => { isCancelled = true; };
  }, [clearTokens, loadStoredTokens, refreshWithToken]);

  // Fetch Wrapper mit automatischer Auth & einmaligem Refresh-Versuch bei 401.
  const apiFetch = useCallback<AuthContextType["apiFetch"]>(async (input, init) => {
    const { skipAuth, ...restInit } = init ?? {};
    const currentAccess = session?.accessToken;
    const requestUrl = typeof input === "string" ? input : input.toString();

    const createInit = (): FetchRequestInit => {
      const clone: FetchRequestInit = { ...(restInit as FetchRequestInit) };
      if (clone.body == null) delete clone.body;
      return clone;
    };

    const performFetch = async (allowRefresh: boolean): Promise<Response> => {
      const baseInit = createInit();
      const headers = new Headers(baseInit.headers || {});
      if (!skipAuth && currentAccess) headers.set("Authorization", `Bearer ${currentAccess}`);
      if (!skipAuth && session?.sessionId) headers.set("x-session-id", session.sessionId);

      const response = await fetch(requestUrl, { ...baseInit, headers });

      if (response.status === 401 && !skipAuth && allowRefresh) {
        try {
          await refresh();
          const latestAccess = (await getItem(ACCESS_TOKEN_STORAGE_KEY)) || session?.accessToken;
          if (latestAccess) {
            const retryInit = createInit();
            const retryHeaders = new Headers(retryInit.headers || {});
            retryHeaders.set("Authorization", `Bearer ${latestAccess}`);
            if (session?.sessionId) retryHeaders.set("x-session-id", session.sessionId);
            return fetch(requestUrl, { ...retryInit, headers: retryHeaders });
          }
        } catch {
          // Silent: fehlgeschlagener Refresh -> ursprüngliche 401 weiterreichen.
        }
      }
      return response;
    };
    return performFetch(true);
  }, [session?.accessToken, session?.sessionId, refresh]);

  // Bei Token-Wechsel neu planen.
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
  const authContext = useContext(AuthContext);
  if (!authContext) throw new Error("useAuth must be used within AuthProvider");
  return authContext;
};