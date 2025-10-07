import * as Notifications from "expo-notifications";
import { RelativePathString, Stack, useRouter } from "expo-router";
import React, { useEffect } from "react";
import { Text, View } from "react-native";
import ToastManager from "toastify-react-native/components/ToastManager";
import { NotificationProvider } from "../../context/NotificationContext";
import { useAuth } from "../../src/auth/AuthContext";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const toastConfig = {
  info: (props: any) => (
    <View style={{ padding: 16, backgroundColor: '#2196F3', borderRadius: 8 }}>
      <Text style={{ color: '#449F29', fontWeight: 'bold', marginBottom: 8 }}>{props.text1}</Text>
      {props.text2 && <Text style={{ color: '#555555' }}>{props.text2}</Text>}
    </View>
  ),
}

export default function AppLayout() {
  const { session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!session) router.replace("/(auth)/login" as RelativePathString);
  }, [session, router]);

  return (
    <NotificationProvider>
      <Stack
        screenOptions={{
          headerTitleAlign: "center",
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="appointment/[id]"
          options={{
            headerTitle: "Einsatzdetails",
            headerBackTitle: "Zurück",
            headerBackVisible: true,
            headerTitleAlign: "center",
          }}
        />
      </Stack>
      <ToastManager config={toastConfig} />
    </NotificationProvider>
  );
}