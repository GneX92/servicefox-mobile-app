import { Redirect } from "expo-router";
import React from "react";
import { useAuth } from "../src/auth/AuthContext";

export default function Index() {
  const { isBootstrapping, session } = useAuth();

  if (isBootstrapping) {  
    return null;
  }

  return (
    <Redirect href={session ? "/(app)/(tabs)" as any : "/(auth)/login" as any} />
  );
}