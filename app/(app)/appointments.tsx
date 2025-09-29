import { LegendList, LegendListRenderItemProps } from "@legendapp/list";
import { CalendarDays, Clock, MapPinHouse, Minus } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Badge, BadgeText } from "../../components/ui/badge";
import { Card } from "../../components/ui/card";
import { Spinner } from "../../components/ui/spinner";
import { useAuth } from "../../src/auth/AuthContext";

type Appointment = {
  id: number;
  title: string;
  reference: string;
  startTime?: string;
  endTime?: string;
  priority?: boolean;
  street?: string;
  postalCode?: string;
  city?: string;
  [key: string]: any;
};

const API_URL = process.env.EXPO_BACKEND_API_URL ?? "http://localhost:3000";

export default function AppointmentsScreen() {
  const { session, signOut } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const accessToken = session?.accessToken;

  function isToday(date: Date): boolean {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }

  function isTomorrow(date: Date): boolean {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return (
      date.getDate() === tomorrow.getDate() &&
      date.getMonth() === tomorrow.getMonth() &&
      date.getFullYear() === tomorrow.getFullYear()
    );
  }

  const formatDate = useCallback((value?: string) => {
    if (!value) return "";
    const d = new Date(value);
    if (isToday(d)) return "Heute";
    if (isTomorrow(d)) return "Morgen";
    return d.toLocaleDateString("de-DE", {
      day: "numeric",
      month: "short",
    }).replace(/\s/g, '\u00A0');
  }, []);

  const formatTime = useCallback((value?: string | number) => {
    if (!value) return "";
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleTimeString('de-DE', { hour: "2-digit", minute: "2-digit" });
  }, []);

  const isPriority = useCallback((v: Appointment["priority"]) => {
    return v;
  }, []);

  const keyExtractor = useCallback((item: Appointment, index: number) => {
    return (
      (item.id != null ? String(item.id) : undefined) ||
      `${item.reference ?? ""}-${item.startTime ?? index}`
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!accessToken) {
        setLoading(false);
        setError("Not authenticated");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_URL}/appointments`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Failed to fetch (${res.status})`);
        }
        const raw = await res.json();
        let parsed: Appointment[] = [];
        if (Array.isArray(raw)) parsed = raw as Appointment[];
        else if (Array.isArray(raw?.appointments)) parsed = raw.appointments;
        else if (Array.isArray(raw?.items)) parsed = raw.items;
        else if (Array.isArray(raw?.results)) parsed = raw.results;
        else if (Array.isArray(raw?.rows)) parsed = raw.rows;
        else if (Array.isArray(raw?.data)) parsed = raw.data;
        else if (Array.isArray(raw?.payload)) parsed = raw.payload;
        if (!cancelled) setAppointments(parsed);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const renderItem = useCallback(
    ({ item }: LegendListRenderItemProps<Appointment>) => {
      const startVal = item.startTime;
      const endVal = item.endTime;
      const priority = isPriority(item.priority);
      const location = item.street ? item.street + ", " + item.postalCode + " " + item.city : "-";

      return (
        <Card className="p-4 bg-white rounded-lg border border-background-200">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-base font-semibold text-typography-800" numberOfLines={1}>
              {item.title}
            </Text>
            {priority ? (
              <Badge action="error" variant="solid" size="sm">
                <BadgeText size="sm" style={styles.badgeText}>Prio</BadgeText>
              </Badge>
            ) : null}
          </View>
          <View className="flex-row items-center mb-2">
            <View className="flex-row items-center gap-2 flex-1" style={{ minWidth: 0 }}>
              <Text className="text-typography-800">Kommission: {item.reference}</Text>
            </View>           
          </View>
          <View className="flex-row items-center gap-1 flex-shrink-0 mb-2">
              <MapPinHouse size={16} color="#374151" />
              <Text className="text-typography-800">{location}</Text>
          </View>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2 flex-1" style={{ minWidth: 0 }}>
              <CalendarDays size={16} color="#374151" />
              <Text className="text-typography-800" numberOfLines={1} ellipsizeMode="tail">{formatDate(startVal)}</Text>
            </View>
            <View className="flex-row items-center gap-1 flex-shrink-0 ">              
                <Clock size={16} color="#374151" />
                <Text className="text-typography-800">{formatTime(startVal)}</Text>            
                <Minus size={16} color="#374151" />
                <Text className="text-typography-800">{formatTime(endVal)}</Text> 
                <Text className="text-typography-800">Uhr</Text>             
            </View>
          </View>
        </Card>
      );
    },
    [formatDate, formatTime, isPriority]
  );

  const content = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.center}>
          <Spinner color="#0ea5e9" />
          <Text style={styles.loadingText}>Loading appointments…</Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      );
    }
    if (appointments.length === 0) {
      return (
        <View style={styles.center}>
          <Text style={styles.loadingText}>No appointments found</Text>
        </View>
      );
    }
    return (
      <LegendList
        data={appointments}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        recycleItems
        maintainVisibleContentPosition
        contentContainerStyle={styles.listContent}
      />
    );
  }, [appointments, error, keyExtractor, loading, renderItem]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Nächste 7 Tage</Text>
        <Pressable onPress={signOut} style={styles.button}>
          <Text style={styles.buttonText}>Abmelden</Text>
        </Pressable>
      </View>
      <View style={{ flex: 1 }}>{content}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 12,
    padding: 16,
    backgroundColor: "#ffffff",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  listContent: {
    paddingVertical: 4,
    gap: 12,
  },
  title: { fontSize: 22, fontWeight: "600", color: "#3B8724" },
  button: {
    backgroundColor: "#dc2626",
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
    paddingHorizontal: 12,
  },
  buttonText: { color: "#fff", fontWeight: "600" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: { color: "#374151" },
  errorText: { color: "#b91c1c" },
  badgeText: { fontWeight: 'bold' },
});