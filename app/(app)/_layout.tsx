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
        headerTitle: "My App",
        headerBackVisible: false,
      }}
    />
  );
}