import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { AuthProvider, useAuth } from "../src/auth/AuthContext";

try {
  // Keep splash up until auth/bootstrap completes
  SplashScreen.preventAutoHideAsync();
} catch {}

function RootContent() {
  const { isBootstrapping } = useAuth();

  useEffect(() => {
    if (!isBootstrapping) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isBootstrapping]);

  // Keep the tree mounted; routing will handle redirection
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
      <Stack.Screen name="index" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootContent />
    </AuthProvider>
  );
}