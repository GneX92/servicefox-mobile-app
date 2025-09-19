import { RelativePathString, Stack, useRouter } from "expo-router";
import React, { useEffect } from "react";
import { useAuth } from "../../src/auth/AuthContext";

export default function AuthLayout() {
  const { session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (session) router.replace("/(app)/appointments" as RelativePathString);
  }, [session, router]);

  return <Stack screenOptions={{ headerShown: false }} />;
}