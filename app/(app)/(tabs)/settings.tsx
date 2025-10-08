import Constants from 'expo-constants';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from "react-native";
import { Button, ButtonText } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Text } from "../../../components/ui/text";
import { useNotification } from "../../../context/NotificationContext";

const statusColorMap: Record<string, string> = {
    registered: '#2e7d32',
    registering: '#0277bd',
    failed: '#c62828',
    paused: '#6d4c41',
    idle: '#555555',
};

export default function Settings() {
    const [showDetails, setShowDetails] = useState(false);
    const { pushRegistration, retryPushRegistration, expoPushToken } = useNotification();
    const { status, lastSuccessAt, lastFailureAt, failureMessage, maxWindowExceeded } = pushRegistration;
    const color = statusColorMap[status] || '#444';
    const dateFmt = (ts: number | null) => ts ? new Date(ts).toLocaleString() : '—';
    const showRetry = status !== 'registered';
    // Prefer explicit env var override, else fall back to app.json version via expo-constants
    const appVersion = (process.env.EXPO_PUBLIC_APP_VERSION || Constants.expoConfig?.version || 'unknown').trim();

    return (
        <Pressable style={styles.container} onLongPress={() => setShowDetails(v => !v)} accessibilityRole="button" accessibilityLabel="Toggle diagnostic details" accessibilityHint="Long press to show or hide push registration diagnostic information">
            <Card className="bg-background-0 mb-4 p-0" style={{ overflow: 'hidden', width: '90%' }}>
                <View style={styles.cardTitlebar}>
                    <Text size="md" className="text-typography-700 font-semibold" style={{ color: '#45A02A' }}>Über Servicefox Mobile</Text>
                </View>
                <View style={styles.cardBody}>
                    <Text className="text-typography-800 mb-2">Version {appVersion}</Text>
                    <Text className="text-typography-800" style={{ color }}>Push Status: {status}</Text>
                    {showDetails && (
                        <View style={{ gap: 8 }}>
                            {expoPushToken && <Text className="text-typography-600 break-all">Token: {expoPushToken}</Text>}
                            <Text className="text-typography-600">Last Success: {dateFmt(lastSuccessAt)}</Text>
                            <Text className="text-typography-600">Last Failure: {dateFmt(lastFailureAt)}</Text>
                            {failureMessage && status !== 'registered' && (
                                <Text className="text-typography-600">Grund: {failureMessage}</Text>
                            )}
                            {maxWindowExceeded && status === 'paused' && (
                                <Text className="text-typography-600">Automatische Wiederholungen pausiert nach 24h. Tippe auf Wiederholen, um fortzufahren.</Text>
                            )}
                            {showRetry && (
                                <View style={{ marginTop: 12 }}>
                                    <Button action={status === 'failed' || status === 'paused' ? 'negative' : 'primary'} onPress={() => retryPushRegistration()} disabled={status === 'registering'}>
                                        <ButtonText style={{ color: "white" }}>{status === 'registering' ? 'Registering…' : 'Retry Registration'}</ButtonText>
                                    </Button>
                                </View>
                            )}
                        </View>
                    )}
                    {!showDetails && (
                        <Text className="text-typography-500" style={{ fontSize: 12 }}>Long press anywhere to {showDetails ? 'hide' : 'show'} details</Text>
                    )}
                </View>
            </Card>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'center',
        marginTop: 20,
        backgroundColor: "#F1F2F5",
    },
    cardTitlebar: {
    backgroundColor: '#f8f9fc',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    textAlign: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#CCCED9',
    borderWidth: 1,
  },
  cardBody: {
    padding: 16,
    gap: 32,
    borderColor: '#CCCED9',
    borderWidth: 1,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderTopWidth: 0,
  },
});