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
import { Platform } from 'react-native';
import { Toast } from 'toastify-react-native';
import { useAuth } from "../src/auth/AuthContext";
import { getDeviceId, PUSH_TOKEN_FAILED_KEY, PUSH_TOKEN_KEY } from "../src/utils/pushNotifications";
import { registerForPushNotificationsAsync } from "../src/utils/registerForPushNotificationsAsync";
import { deleteItem, getItem, setItem } from "../src/utils/storage";

interface NotificationContextType {
    expoPushToken: string | null;
    notification: Notifications.Notification | null;
    err: Error | null;
    pushRegistration: {
        status: 'idle' | 'registering' | 'registered' | 'failed' | 'paused';
        lastSuccessAt: number | null;
        lastFailureAt: number | null;
        failureMessage?: string;
        attempts: number;
        maxWindowExceeded: boolean;
    };
    retryPushRegistration: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = (): NotificationContextType => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error("useNotification must be used within a NotificationProvider");
    }
    return context;
};

interface NotificationProviderProps {
    children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
    const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
    const [notification, setNotification] = useState<Notifications.Notification | null>(null);
    const [err, setError] = useState<Error | null>(null);
    const notificationListener = useRef<Notifications.EventSubscription | null>(null);
    const responseListener = useRef<Notifications.EventSubscription | null>(null);
    const router = useRouter();
    const { session, apiFetch } = useAuth();
    const registeringRef = useRef(false);
    const [registrationState, setRegistrationState] = useState<NotificationContextType['pushRegistration']>({
        status: 'idle',
        lastSuccessAt: null,
        lastFailureAt: null,
        attempts: 0,
        maxWindowExceeded: false,
    });

    // Maximum wall-clock window (e.g., 24h) after first failure to keep retrying automatically
    const MAX_RETRY_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
    const RETRY_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
    const firstFailureRef = useRef<number | null>(null);

    const API_URL = process.env.EXPO_PUBLIC_BACKEND_API_URL;

    useEffect(() => {

        const navigateToDetail = (appointmentId: string | number) => {
        if ( !appointmentId ) return;       
        router.push(`/appointment/${appointmentId}`);
        Toast.hide(); // Hide the toast after navigation
    }

        registerForPushNotificationsAsync().then(
            (token) => setExpoPushToken(token ?? null),
            (err) => setError(err)
        );

        notificationListener.current = 
            Notifications.addNotificationReceivedListener((notification) => {
                setNotification(notification); 
                const toastTitle = notification.request.content.title || "Notification";
                const toastBody = notification.request.content.body || "";
                const appointmentId : any = notification.request.content.data?.appointmentId;
                Toast.show({
                    type: 'info',
                    text1: toastTitle,
                    text2: toastBody,
                    position: 'bottom',
                    visibilityTime: 4000,
                    autoHide: true,
                    onPress: () => { 
                        Toast.hide(); 
                        navigateToDetail(appointmentId); // Route to Detail View here
                    },
                    onShow: () => console.log('Toast shown'), // Refresh Appointment list here
                })
            });

        responseListener.current = 
            Notifications.addNotificationResponseReceivedListener((response) => {
                console.log(response);
                // Handle the response to the notification if needed
                const appointmentId : any = response.notification.request.content.data?.appointmentId;
                navigateToDetail(appointmentId); // Route to Detail View here
            });
        
        // Handle cold start (app opened by tapping a notification)
        // ( () => {
        // const last = Notifications.getLastNotificationResponse();
        // if (last) {
        //     const data: any = last.notification.request.content.data || {};
        //     const appointmentId = data.appointmentId ?? data.id;
        //     // Delay a tick to ensure router is ready
        //     setTimeout(() => navigateToDetail(appointmentId), 50);
        // }
        // })();
        
        return () => {
            if (notificationListener.current) {
                notificationListener.current.remove();
            }

            if (responseListener.current) {
                responseListener.current.remove();
            }

        };
    }, [router]);

    // Helper to attempt registration with exponential backoff (up to 5 attempts in one cycle)
    const attemptRegisterWithBackoff = React.useCallback(async (token: string): Promise<boolean> => {
        const stored = await getItem(PUSH_TOKEN_KEY);
        if (stored === token) return true; // already registered
        const deviceId = await getDeviceId();
        const maxRetries = 5;
        let attempt = 0;
        let delay = 1000;
        setRegistrationState(s => ({ ...s, status: 'registering' }));
        while (attempt < maxRetries) {
            attempt += 1;
            setRegistrationState(s => ({ ...s, attempts: s.attempts + 1 }));
            try {
                const res = await apiFetch(`${API_URL}/push/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, platform: Platform.OS, deviceId }),
                });
                if (res.ok) {
                    await setItem(PUSH_TOKEN_KEY, token);
                    await deleteItem(PUSH_TOKEN_FAILED_KEY);
                    setRegistrationState(s => ({ ...s, status: 'registered', lastSuccessAt: Date.now(), failureMessage: undefined, maxWindowExceeded: false }));
                    return true;
                } else {
                    const msg = await res.text();
                    console.warn(`Push token registration failed (attempt ${attempt}/${maxRetries}):`, msg || res.status);
                    setRegistrationState(s => ({ ...s, status: 'registering', lastFailureAt: Date.now(), failureMessage: msg || String(res.status) }));
                }
            } catch (e) {
                console.warn(`Push token registration error (attempt ${attempt}/${maxRetries}):`, (e as Error).message);
                setRegistrationState(s => ({ ...s, status: 'registering', lastFailureAt: Date.now(), failureMessage: (e as Error).message }));
            }
            if (attempt < maxRetries) {
                const jitter = Math.random() * 250;
                await new Promise(r => setTimeout(r, delay + jitter));
                delay *= 2;
            }
        }
        // Persist failure meta for later scheduled retries
        const failureMeta = { token, lastAttempt: Date.now() };
        await setItem(PUSH_TOKEN_FAILED_KEY, JSON.stringify(failureMeta));
        if (firstFailureRef.current === null) firstFailureRef.current = Date.now();
        setRegistrationState(s => ({ ...s, status: 'failed', lastFailureAt: Date.now() }));
        return false;
    }, [apiFetch, API_URL]);

    // Initial registration attempt effect
    useEffect(() => {
        if (!expoPushToken || !session?.accessToken || !API_URL) return;
        if (registeringRef.current) return;
        registeringRef.current = true;
        (async () => {
            await attemptRegisterWithBackoff(expoPushToken);
        })().finally(() => {
            registeringRef.current = false;
        });
    }, [expoPushToken, session?.accessToken, API_URL, attemptRegisterWithBackoff, MAX_RETRY_WINDOW_MS, RETRY_INTERVAL_MS]);

    // Background periodic retry every 15 minutes if we still haven't registered successfully.
    useEffect(() => {
        if (!expoPushToken || !session?.accessToken || !API_URL) return;
        let interval: ReturnType<typeof setInterval> | null = null;
        const start = async () => {
            const stored = await getItem(PUSH_TOKEN_KEY);
            if (stored === expoPushToken) return; // success
            interval = setInterval(async () => {
                const withinWindow = firstFailureRef.current === null || (Date.now() - firstFailureRef.current) < MAX_RETRY_WINDOW_MS;
                if (!withinWindow) {
                    if (interval) {
                        clearInterval(interval);
                        interval = null;
                    }
                    setRegistrationState(s => s.status === 'registered' ? s : { ...s, status: 'paused', maxWindowExceeded: true });
                    return;
                }
                if (registeringRef.current) return;
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
        start();
        return () => { if (interval) clearInterval(interval); };
    }, [expoPushToken, session?.accessToken, API_URL, attemptRegisterWithBackoff, MAX_RETRY_WINDOW_MS, RETRY_INTERVAL_MS]);

    // Manual retry exposed to UI. Resets window if previously paused.
    const retryPushRegistration = React.useCallback(async () => {
        if (!expoPushToken || !session?.accessToken || !API_URL) return;
        firstFailureRef.current = null; // reset window
        setRegistrationState(s => ({ ...s, maxWindowExceeded: false, status: 'registering' }));
        if (registeringRef.current) return;
        registeringRef.current = true;
        try {
            await attemptRegisterWithBackoff(expoPushToken);
        } finally {
            registeringRef.current = false;
        }
    }, [expoPushToken, session?.accessToken, API_URL, attemptRegisterWithBackoff]);
    return (
        <NotificationContext.Provider value={{ expoPushToken, notification, err, pushRegistration: registrationState, retryPushRegistration }}>
            {children}
        </NotificationContext.Provider>
    );
};

            