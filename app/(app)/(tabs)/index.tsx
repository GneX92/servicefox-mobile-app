// Übersichtsliste der Termine (nächste 7 Tage)
import { LegendList, LegendListRenderItemProps } from "@legendapp/list";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { CalendarDays, Clock, MapPinHouse, Minus } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Badge, BadgeText } from "../../../components/ui/badge";
import { Card } from "../../../components/ui/card";
import { useNotification } from "../../../context/NotificationContext";
import { useAuth } from "../../../src/auth/AuthContext";
import { buildApiUrl } from "../../../src/config/api";

// Grundstruktur eines Termins (Backend kann weitere Felder liefern)
export interface Appointment {
  id: number;
  title: string;
  reference: string;
  startTime?: string;
  endTime?: string;
  priority?: number;
  street?: string;
  postalCode?: string;
  city?: string;
  // Fallback für zusätzliche dynamische Felder
  [key: string]: any;
}

// API Basis-URL wird zentral verwaltet (kein direkter ENV Zugriff hier).

// Mögliche Container-Keys unterschiedlicher Backend-Antworten
const COLLECTION_KEYS = [
  'appointments',
  'items',
  'results',
  'rows',
  'data',
  'payload'
] as const;

// Extrahiert eine Liste von Terminen aus verschieden strukturierten Antworten
function parseAppointments(raw: any): Appointment[] {
  if (Array.isArray(raw)) return raw as Appointment[];
  for (const key of COLLECTION_KEYS) {
    const value = raw?.[key];
    if (Array.isArray(value)) return value as Appointment[];
  }
  return [];
}

export default function AppointmentsScreen() {
  // Aktuell keine direkten Notification-Daten benötigt – Hook bleibt für zukünftige Erweiterungen
  useNotification();
  const { session, apiFetch } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const accessToken = session?.accessToken;

  // Hilfsfunktionen für Datumslogik
  function isToday(date: Date): boolean {
    const now = new Date();
    return date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }
  function isTomorrow(date: Date): boolean {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return date.getDate() === tomorrow.getDate() && date.getMonth() === tomorrow.getMonth() && date.getFullYear() === tomorrow.getFullYear();
  }

  // Formatiert das Datum (Heute / Morgen / lokales Datum)
  const formatDate = useCallback((value?: string) => {
    if (!value) return "";
    const d = new Date(value);
    if (isNaN(d.getTime())) return ""; // Ungültiges Datum ignorieren
    if (isToday(d)) return "Heute";
    if (isTomorrow(d)) return "Morgen";
    return d
      .toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "short" })
      .replace(/\s/g, '\u00A0'); // Geschützte Leerzeichen
  }, []);

  // Formatiert Uhrzeit (HH:MM) – bei ungültigem Datum ursprünglichen Wert anzeigen
  const formatTime = useCallback((value?: string | number) => {
    if (!value) return "";
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleTimeString('de-DE', { hour: "2-digit", minute: "2-digit" });
  }, []);

  // Prio-Kennzeichnung (1 = wichtig)
  const isPriority = useCallback((v: Appointment["priority"]) => v === 1, []);

  // Stabiler Key (fällt zurück auf Referenz+Startzeit)
  const keyExtractor = useCallback((item: Appointment, index: number) => {
    return (item.id != null ? String(item.id) : undefined) || `${item.reference ?? ""}-${item.startTime ?? index}`;
  }, []);

  // Lädt Termine beim Mount / Token-Wechsel
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
  const res = await apiFetch(buildApiUrl(`/appointments`));
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Failed to fetch (${res.status})`);
        }
        const raw = await res.json();
        const parsed = parseAppointments(raw);
        if (!cancelled) setAppointments(parsed);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true; // Abbrechen falls Komponente unmounted
    };
  }, [accessToken, apiFetch]);

  // Darstellung eines einzelnen Termins
  const renderItem = useCallback(({ item }: LegendListRenderItemProps<Appointment>) => {
    const { startTime: startVal, endTime: endVal } = item;
    const priority = isPriority(item.priority);
    const location = item.street ? `${item.street}, ${item.postalCode} ${item.city}` : "-";

    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          if (item.id != null) router.push((`/(app)/appointment/${String(item.id)}` as any));
        }}
      >
        <Card className="p-4 bg-white rounded-lg" style={styles.card}>
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-base font-semibold text-typography-900" numberOfLines={1}>
              {item.title}
            </Text>
            {priority && (
              <Badge action="error" variant="solid" size="sm">
                <BadgeText size="sm" style={styles.badgeText}>Prio</BadgeText>
              </Badge>
            )}
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
      </Pressable>
    );
  }, [formatDate, formatTime, isPriority, router]);

  // Entscheidet, was angezeigt wird (Ladezustand / Fehler / Liste)
  const content = useMemo(() => {
    if (loading)
      return (
        <View style={styles.center}>
          <Image source={require("../../../assets/images/loading.gif")} style={{ width: 300, height: 300, borderRadius: 6 }} autoplay />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      );
    if (error)
      return (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      );
    if (appointments.length === 0)
      return (
        <View style={styles.center}>
          <Text style={styles.loadingText}>No appointments found</Text>
        </View>
      );
    return (
      <LegendList
        data={appointments}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        recycleItems
        maintainVisibleContentPosition
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    );
  }, [appointments, error, keyExtractor, loading, renderItem]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Nächste 7 Tage</Text>
      </View>
      <View style={{ flex: 1 }}>{content}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 12,
    justifyContent: 'flex-start',
    marginTop: 20,
    backgroundColor: "#F1F2F5",
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
  title: { 
    fontSize: 22, 
    fontWeight: "600", 
    color: "#449F29",

    textAlign: 'center',
    width: '100%',
  },
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
  card: { 
    // borderColor: '#CCCED9', 
    // borderWidth: 1,
    boxShadow: 'inset 0px 1px 2px #ffffff70 , 0px 4px 6px #00000030, 0px 6px 10px #00000015',
    overflow: 'hidden', 
    width: '90%',
    alignSelf: 'center',
  },  
});