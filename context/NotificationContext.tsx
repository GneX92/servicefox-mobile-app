import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import React, {
    createContext,
    ReactNode,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import { Platform } from "react-native";
import { Toast } from "toastify-react-native";
import { useAuth } from "../src/auth/AuthContext";
import { API_BASE_URL, buildApiUrl } from "../src/config/api";
import {
    getDeviceId,
    PUSH_TOKEN_FAILED_KEY,
    PUSH_TOKEN_KEY,
} from "../src/utils/pushNotifications";
import { registerForPushNotificationsAsync } from "../src/utils/registerForPushNotificationsAsync";
import { deleteItem, getItem, setItem } from "../src/utils/storage";

interface NotificationContextType {
    expoPushToken: string | null;
    notification: Notifications.Notification | null;
    err: Error | null; // öffentlicher Fehlerzustand (API unverändert lassen)
    pushRegistration: {
        status: "idle" | "registering" | "registered" | "failed" | "paused";
        lastSuccessAt: number | null;
        lastFailureAt: number | null;
        failureMessage?: string;
        attempts: number; // Anzahl aller Einzel-Versuche (Summiert Backoff-Retries)
        maxWindowExceeded: boolean; // Ob Retry-Fenster (z.B. 24h) überschritten
    };
    retryPushRegistration: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
    undefined
);

export const useNotification = (): NotificationContextType => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error(
            "useNotification must be used within a NotificationProvider"
        );
    }
    return context;
};

interface NotificationProviderProps {
    children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
    children,
}) => {
    // --------------------------- Lokale Zustände ---------------------------------
    const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
    const [notification, setNotification] =
        useState<Notifications.Notification | null>(null);
    const [err, setError] = useState<Error | null>(null);
    const notificationSubscriptionRef =
        useRef<Notifications.EventSubscription | null>(null);
    const responseSubscriptionRef =
        useRef<Notifications.EventSubscription | null>(null);
    const { session, apiFetch } = useAuth();
    const router = useRouter();
    const registeringRef = useRef(false); // Flag um parallele Registrierungen zu verhindern
    const [registrationState, setRegistrationState] =
        useState<NotificationContextType["pushRegistration"]>({
            status: "idle",
            lastSuccessAt: null,
            lastFailureAt: null,
            attempts: 0,
            maxWindowExceeded: false,
        });

    // --------------------------- Konstanten & Refs --------------------------------
    // Maximales Zeitfenster (24h) für automatische Retries ab erster Fehlregistrierung
    const MAX_RETRY_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 Stunden
    const RETRY_INTERVAL_MS = 15 * 60 * 1000; // 15 Minuten
    const firstFailureRef = useRef<number | null>(null); // Zeitstempel der ersten Fehlregistrierung
    const API_URL = API_BASE_URL; // Zentralisierte Backend Basis-URL

    // --------------------------- Navigationshelfer --------------------------------
            const navigateToAppointmentDetail = React.useCallback(
                (appointmentId: string | number) => {
                    if (!appointmentId) return; // kein Ziel -> Abbruch
                    router.push(`/appointment/${appointmentId}`);
                    Toast.hide();
                },
                [router]
            );

    // --------------------------- Notification Handler -----------------------------
        const showToastForNotification = React.useCallback(
            (noti: Notifications.Notification) => {
                const { title, body, data } = noti.request.content;
                const appointmentId: any = (data as any)?.appointmentId;
                Toast.show({
                    type: "info",
                    text1: title || "Notification",
                    text2: body || "",
                    position: "bottom",
                    visibilityTime: 4000,
                    autoHide: true,
                    onPress: () => navigateToAppointmentDetail(appointmentId),
                    onShow: () => console.log("Toast shown"), // ggf. Liste / UI aktualisieren
                });
            },
            [navigateToAppointmentDetail]
        );

    // --------------------------- Initial Setup ------------------------------------
        useEffect(() => {
        // Push-Berechtigungen & Token holen
        registerForPushNotificationsAsync().then(
            (token) => setExpoPushToken(token ?? null),
            (error) => setError(error)
        );

        // Eingang von Notifications im Vordergrund
        notificationSubscriptionRef.current =
            Notifications.addNotificationReceivedListener((incoming) => {
                setNotification(incoming);
                showToastForNotification(incoming);
            });

        // Reaktion auf Anklicken (App im Hintergrund / geschlossen -> geöffnet)
        responseSubscriptionRef.current =
            Notifications.addNotificationResponseReceivedListener((response) => {
                const appointmentId: any =
                    response.notification.request.content.data?.appointmentId;
                navigateToAppointmentDetail(appointmentId);
            });

        // Cleanup
        return () => {
            notificationSubscriptionRef.current?.remove();
            responseSubscriptionRef.current?.remove();
        };
        }, [router, navigateToAppointmentDetail, showToastForNotification]);

    // Versucht die Server-Registrierung mit exponentiellem Backoff (max 5 Versuche)
    const attemptRegisterWithBackoff = React.useCallback(
        async (token: string): Promise<boolean> => {
            const alreadyStored = await getItem(PUSH_TOKEN_KEY);
            if (alreadyStored === token) return true; // Bereits registriert -> fertig

            const deviceId = await getDeviceId();
            const MAX_RETRIES = 5;
            let attempt = 0;
            let delayMs = 1000; // Start-Delay (wird verdoppelt)

            setRegistrationState((s) => ({ ...s, status: "registering" }));

            while (attempt < MAX_RETRIES) {
                attempt += 1;
                setRegistrationState((s) => ({ ...s, attempts: s.attempts + 1 }));
                try {
                    const response = await apiFetch(buildApiUrl(`/push/register`), {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            token,
                            platform: Platform.OS,
                            deviceId,
                        }),
                    });

                    if (response.ok) {
                        await setItem(PUSH_TOKEN_KEY, token);
                        await deleteItem(PUSH_TOKEN_FAILED_KEY);
                        setRegistrationState((s) => ({
                            ...s,
                            status: "registered",
                            lastSuccessAt: Date.now(),
                            failureMessage: undefined,
                            maxWindowExceeded: false,
                        }));
                        return true;
                    }

                    const bodyText = await response.text();
                    console.warn(
                        `Push token registration failed (attempt ${attempt}/${MAX_RETRIES}):`,
                        bodyText || response.status
                    );
                    setRegistrationState((s) => ({
                        ...s,
                        status: "registering",
                        lastFailureAt: Date.now(),
                        failureMessage: bodyText || String(response.status),
                    }));
                } catch (e) {
                    const msg = (e as Error).message;
                    console.warn(
                        `Push token registration error (attempt ${attempt}/${MAX_RETRIES}):`,
                        msg
                    );
                    setRegistrationState((s) => ({
                        ...s,
                        status: "registering",
                        lastFailureAt: Date.now(),
                        failureMessage: msg,
                    }));
                }

                if (attempt < MAX_RETRIES) {
                    const jitter = Math.random() * 250; // leichte Zufallskomponente
                    await new Promise((r) => setTimeout(r, delayMs + jitter));
                    delayMs *= 2; // Exponentielles Backoff
                }
            }

            // Dauerhaft gescheitert -> Metadaten speichern für spätere Retries
            const failureMeta = { token, lastAttempt: Date.now() };
            await setItem(PUSH_TOKEN_FAILED_KEY, JSON.stringify(failureMeta));
            if (firstFailureRef.current === null) firstFailureRef.current = Date.now();
            setRegistrationState((s) => ({
                ...s,
                status: "failed",
                lastFailureAt: Date.now(),
            }));
            return false;
        },
    [apiFetch]
    );

    // Erster Registrierungsversuch sobald Token & Session vorhanden
        useEffect(() => {
        if (!expoPushToken || !session?.accessToken || !API_URL) return;
        if (registeringRef.current) return; // schon im Gang

        registeringRef.current = true;
        attemptRegisterWithBackoff(expoPushToken).finally(() => {
            registeringRef.current = false;
        });
    }, [expoPushToken, session?.accessToken, API_URL, attemptRegisterWithBackoff]);

    // Hintergrund-Retry alle 15 Minuten solange nicht erfolgreich & Fenster aktiv
    useEffect(() => {
        if (!expoPushToken || !session?.accessToken || !API_URL) return;
        let interval: ReturnType<typeof setInterval> | null = null;

        const startInterval = async () => {
            const stored = await getItem(PUSH_TOKEN_KEY);
            if (stored === expoPushToken) return; // bereits registriert

            interval = setInterval(async () => {
                const withinWindow =
                    firstFailureRef.current === null ||
                    Date.now() - firstFailureRef.current < MAX_RETRY_WINDOW_MS;
                if (!withinWindow) {
                    // Zeitfenster abgelaufen -> pausieren
                    if (interval) {
                        clearInterval(interval);
                        interval = null;
                    }
                    setRegistrationState((s) =>
                        s.status === "registered"
                            ? s
                            : { ...s, status: "paused", maxWindowExceeded: true }
                    );
                    return;
                }

                if (registeringRef.current) return; // gerade ein Versuch aktiv
                registeringRef.current = true;
                try {
                    const success = await attemptRegisterWithBackoff(expoPushToken);
                    if (success && interval) {
                        clearInterval(interval);
                        interval = null;
                    }
                } finally {
                    registeringRef.current = false;
                }
            }, RETRY_INTERVAL_MS);
        };

        startInterval();
            return () => {
                if (interval) {
                    clearInterval(interval);
                }
            };
    }, [
        expoPushToken,
        session?.accessToken,
        API_URL,
        attemptRegisterWithBackoff,
        MAX_RETRY_WINDOW_MS,
        RETRY_INTERVAL_MS,
    ]);

    // Manueller Retry (UI) – setzt Zeitfenster zurück
    const retryPushRegistration = React.useCallback(async () => {
        if (!expoPushToken || !session?.accessToken || !API_URL) return;
        firstFailureRef.current = null; // Fenster resetten
        setRegistrationState((s) => ({
            ...s,
            maxWindowExceeded: false,
            status: "registering",
        }));
        if (registeringRef.current) return; // laufender Versuch

        registeringRef.current = true;
        try {
            await attemptRegisterWithBackoff(expoPushToken);
        } finally {
            registeringRef.current = false;
        }
    }, [expoPushToken, session?.accessToken, API_URL, attemptRegisterWithBackoff]);

    return (
        <NotificationContext.Provider
            value={{
                expoPushToken,
                notification,
                err,
                pushRegistration: registrationState,
                retryPushRegistration,
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
};

            