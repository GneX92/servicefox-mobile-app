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
          // Provide a default header style/tint (affects back button) for all inner screens
          // headerTintColor: '#555555', // dark gray for icons/text
          // headerStyle: { backgroundColor: '#F7F8FB' },
          // headerTitleStyle: { color: '#555555' },
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
            // Explicitly ensure back arrow contrast if background is light
            // headerTintColor: '#555555',
            // headerStyle: { backgroundColor: '#F7F8FB' },
            // headerTitleStyle: { color: '#555555', fontWeight: '600' },
          }}
        />
      </Stack>
      <ToastManager config={toastConfig} />
    </NotificationProvider>
  );
}