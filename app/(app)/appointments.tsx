import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../src/auth/AuthContext";

export default function HomeScreen() {
  const { session, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Pressable onPress={signOut} style={styles.button}>
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 16,
    padding: 20,
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  title: { fontSize: 22, fontWeight: "600" },
  button: {
    backgroundColor: "#dc2626",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 16,
  },
  buttonText: { color: "#fff", fontWeight: "600" },
});