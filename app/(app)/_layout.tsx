import { RelativePathString, Stack, useRouter } from "expo-router";
import React, { useEffect } from "react";
import { useAuth } from "../../src/auth/AuthContext";

export default function AppLayout() {
  const { session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!session) router.replace("/(auth)/login" as RelativePathString);
  }, [session, router]);

  return (
    <Stack
      screenOptions={{
        headerTitleAlign: "center",
        // No global headerTitle so detail screens can specify their own.
      }}
    >
      {/* Tabs hide their own header; tab screens provide list view etc. */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      {/* Appointment detail screen with custom title and back button label */}
      <Stack.Screen
        name="appointment/[id]"
        options={{
          headerTitle: "Einsatzdetails",
          // Show a back button (previous header title won't leak in as label)
          headerBackTitle: "Zurück",
          headerBackVisible: true,
          headerTitleAlign: "center",
        }}
      />
    </Stack>
  );
}