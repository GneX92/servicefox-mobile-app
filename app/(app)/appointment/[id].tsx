import { useLocalSearchParams } from "expo-router";
import { CalendarDays, CloudAlert, Flag, MapPinHouse, User, Wrench } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import openMap from 'react-native-open-maps';
import { Alert, AlertText } from "../../../components/ui/alert";
import { Badge, BadgeText } from "../../../components/ui/badge";
import { Card } from "../../../components/ui/card";
import { Icon, MailIcon, PhoneIcon } from "../../../components/ui/icon";
import { Spinner } from "../../../components/ui/spinner";
import { Table, TableBody, TableData, TableHead, TableRow } from "../../../components/ui/table";
import { Text } from "../../../components/ui/text";
import { useAuth } from "../../../src/auth/AuthContext";

type Appointment = {
  id: number;
  title: string; // einsatz
  installerCompany?: string; // Anlagenbauer
  clientCompany?: string; // Auftraggeber
  reference: string; // Kommission
  startTime?: string;
  endTime?: string;
  priority?: number; 
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string; // Land
  plt?: boolean; // PLT
  development?: boolean; // Entwicklung
  contractId?: string; // Vertrag
  billingNotes?: string; // Rechnung
  contactName?: string; // Ansprechperson
  contactPhone?: string; // Telefon Ansprechperson
  contactEmail?: string; // Email Ansprechperson
  description?: string; // info
  [key: string]: any;
};

const API_URL = process.env.EXPO_BACKEND_API_URL ?? "http://localhost:3000";

export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!session?.accessToken || !id) {
        setLoading(false);
        setError(!id ? "Missing appointment id" : "Not authenticated");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_URL}/appointments/${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${session.accessToken}` },
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Failed to fetch (${res.status})`);
        }
        const data = await res.json();
        if (!cancelled) setAppointment(data as Appointment);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load appointment");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id, session?.accessToken]);

  {/* v Utility functions v */}

  const openAddress = (address?: string) => {
    if (!address) return;
    openMap({ query: address });
  };

  const display = (v?: string | number | null, fallback: string = "-") => {
    if (v === null || v === undefined) return fallback;
    const s = String(v).trim();
    return s.length ? s : fallback;
  };

  const openTel = (phone?: string) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };
  const openMail = (email?: string) => {
    if (!email) return;
    Linking.openURL(`mailto:${email}`).catch(() => {});
  };
  const openCalendar = (start?: string, end?: string, title?: string, location?: string, notes?: string) => {
    if (!start) return;
    const s = new Date(start);
    const e = end ? new Date(end) : new Date(s.getTime() + 60 * 60 * 1000);
    const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title ?? "Termin")}&dates=${s.toISOString().replace(/[-:]|\.\d{3}/g, "")}/${e.toISOString().replace(/[-:]|\.\d{3}/g, "")}&details=${encodeURIComponent(notes ?? "")}&location=${encodeURIComponent(location ?? "")}&sf=true&output=xml`;
    Linking.openURL(url).catch(() => {});
  };

  const renderPriorityBadge = (v: number | undefined) => {
    if (v === 1) return (
      <Badge className="bg-red-500 rounded" action="error" variant="solid" size="lg">
        <BadgeText className="text-typography-0" size="lg" style={styles.center}>Prio</BadgeText>
      </Badge>
    )
    if (v === 2) return (
      <Badge className="bg-yellow-500 rounded" action="warning" variant="solid" size="lg">
        <BadgeText className="text-typography-0" size="lg" style={{ ...styles.center, color: "white" }}>Normal</BadgeText>
      </Badge>
    )
    return (
      <Badge className="bg-gray-500 rounded" action="default" variant="solid" size="lg">
        <BadgeText className="text-white" size="lg" style={styles.center}>Keine</BadgeText>
      </Badge>
    )
  };

  // Convert <br> to newlines and remove other tags for use in <Text>
    function normalizeDescription(text: string) {
      if (typeof text !== "string") return text;
      // match <br>, <br/>, <br />, different casing, and any extra spaces
      return text.replace(/<\s*br\s*\/?\s*>/gi, "\n");
    }

  // Small layout component for icon + content rows
  const Row = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
    <View style={styles.row}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );

  const formatRange = (start?: string, end?: string) => {
  const sd = start ? `${new Date(start).toLocaleDateString("de-DE", { day: "numeric", month: "short" }).replace(/\s/g, "\u00A0")} ${new Date(start).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}` : "";
  const ed = end ? `${new Date(end).toLocaleDateString("de-DE", { day: "numeric", month: "short" }).replace(/\s/g, "\u00A0")} ${new Date(end).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}` : "";
  if (sd && ed) return `${sd} – ${ed}`;
  if (sd) return sd;
  if (ed) return ed;
  return "-";
};

  {/* ^ Utility functions ^ */}

  {/* v Main content v */}

  const content = useMemo(() => {
    const priority = renderPriorityBadge(appointment?.priority);

    if (loading) {
      return (
        <View style={styles.center}>
          <Spinner size="large" color="#0ea5e9" />
          <Text className="text-typography-600">Laden…</Text>
        </View>
      );
    }
    if (error) {
      const err = JSON.parse(error);
      return (
        <View style={[styles.center, { paddingHorizontal: 16 }] }>
          <Alert action="error" variant="solid" style={{ backgroundColor: "#ffcccc" }}>
            <CloudAlert size={32} color="#cf2a2a" />
            <AlertText className="text-error-500 font-bold">{err.error}</AlertText>
            <AlertText className="text-error-500">{err.message}</AlertText>
          </Alert>
        </View>
      );
    }
    if (!appointment) return null;

    // Full address for map link
    const location = appointment.street
      ? `${display(appointment.street)}, ${display(appointment.postalCode)} ${display(appointment.city)}`
      : "-";

    const html = appointment.description ? appointment.description : "<p>Keine zusätzlichen Informationen.</p>";

    const restoredHtml = normalizeDescription(html);

    return (
<ScrollView style={{ flex: 1, backgroundColor: "#449F29" }} contentContainerStyle={{ padding: 10, gap: 16 }}>
  <Card className="bg-background-0 mb-4 p-0" style={{ overflow: "hidden" }}> 

    {/* Titlebar */}
    <View style={styles.cardTitlebar}>
      <Text size="md" className="text-typography-700 font-semibold" style={{ color: '#45A02A' }}>Serviceeinsatz#{appointment?.id} - {appointment?.reference}</Text>
    </View>

    {/* Body */}
    <View style={styles.cardBody}>

      {/* Einsatzart & Kommission */}
      <Row icon={<Wrench size={32} color="#555555" />}>
        <View style={{ flexDirection: "column", gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text size="md" className="text-typography-800">Einsatzart:</Text>
            <Text size="md" className="text-typography-800 font-semibold">{appointment?.title}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text size="md" className="text-typography-800">Kommission:</Text>
            <Text size="md" className="text-typography-800 font-semibold">{appointment?.reference}</Text>
          </View>
        </View>
      </Row>

      {/* Priorität */}       
      <Row icon={<Flag size={32} color="#555555" />}>
        <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
          <Text size="md" className="text-typography-800 font-semibold">Priorität:</Text>
          {priority}
        </View>
      </Row>

      {/* Einsatzdauer */}                
      <Row icon={<CalendarDays size={32} color="#555555" />}>
        <Text size="md" className="text-typography-800 font-semibold">
          {formatRange(appointment?.startTime, appointment?.endTime)}
        </Text>
      </Row>

      {/* Adresse */}     
      <Pressable
        onPress={() => openAddress(location)}
        disabled={!location || location === "-"}
        accessibilityRole="button"
        accessibilityHint="Adresse in Karten öffnen"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Row icon={<MapPinHouse size={32} color="#555555" />}>
          <Text style={styles.linkText}>{display(location)}</Text>
        </Row>
      </Pressable>

      {/* Kontakt */}        
      <Row icon={<User size={32} color="#555555" />}>
        <View style={{ gap: 8 }}>
          <Text size="md" className="text-typography-800">{display(appointment?.contactName)}</Text>
          <View style={{ flexDirection: "column", gap: 8 }}>
            <Pressable onPress={() => openTel(appointment?.contactPhone)} disabled={!appointment?.contactPhone} accessibilityRole="button" accessibilityHint="Anrufen">
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, opacity: appointment?.contactPhone ? 1 : 0.5 }}>
                <Icon as={PhoneIcon} className="text-typography-700" />
                <Text size="sm" style={styles.linkText}>{display(appointment?.contactPhone)}</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => openMail(appointment?.contactEmail)} disabled={!appointment?.contactEmail} accessibilityRole="button" accessibilityHint="E-Mail schreiben">
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, opacity: appointment?.contactEmail ? 1 : 0.5 }}>
                <Icon as={MailIcon} className="text-typography-700" />
                <Text size="sm" style={styles.linkText}>{display(appointment?.contactEmail)}</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </Row>

      {/* Weitere Einsatzdaten */}        
      <View style={{ flexDirection: "column", gap: 16}}>
        <View style={{ justifyContent: "center", alignItems: "center" }}>
          <Text className="text-typography-800 font-bold">Weitere Einsatzdaten</Text>
        </View>            
        <View style={{ flexDirection: "column", gap: 16}}>              
          <Table className="w-full p-0">
            <TableBody className="p-0">
              <TableRow className="p-0">
                <TableHead className="p-0">
                  <Text className="text-typography-800 font-semibold">Anlagenbauer</Text>
                </TableHead>
                <TableData className="font-normal text-left p-3">
                  <View style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                    {display(appointment?.installerCompany)}
                  </View>
                </TableData>
              </TableRow>
              <TableRow className="p-0">
                <TableHead className="p-0">
                  <Text className="text-typography-800 font-semibold">Auftraggeber</Text>
                </TableHead>
                <TableData className="font-normal text-left p-3">
                  <View style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                    {display(appointment?.clientCompany)}
                  </View>
                </TableData>
              </TableRow>
              <TableRow className="p-0">
                <TableHead className="p-0">
                  <Text className="text-typography-800 font-semibold">PLT</Text>
                </TableHead>
                <TableData className="font-normal text-left p-3">
                  <Text className="text-typography-800">{appointment?.plt ? "Ja" : "Nein"}</Text></TableData>
              </TableRow>
              <TableRow className="p-0">
                <TableHead className="p-0">
                  <Text className="text-typography-800 font-semibold">Entwicklung</Text>
                </TableHead>
                <TableData className="font-normal text-left p-3">
                  <Text className="text-typography-800">{appointment?.development ? "Ja" : "Nein"}</Text>
                </TableData>
              </TableRow>
              <TableRow className="p-0">
                <TableHead className="p-0">
                  <Text className="text-typography-800 font-semibold">Servicevertrag</Text>
                </TableHead>
                <TableData className="font-normal text-left p-3">
                  <Text className="text-typography-800">{appointment?.contractId ? appointment?.contractId : "-"}</Text>
                </TableData>
              </TableRow>
              <TableRow className="p-0">
                <TableHead className="p-0">
                  <Text className="text-typography-800 font-semibold">Rechnung</Text>
                </TableHead>
                <TableData className="font-normal text-left p-3">
                  <Text className="text-typography-800">{appointment?.billingNotes ? appointment?.billingNotes : "-"}</Text>
                </TableData>
              </TableRow>
            </TableBody>
          </Table>
        </View>
      </View>

      {/* Weitere Informationen */}  
      <View style={{ flexDirection: "column", gap: 16}}>
        <View style={{ justifyContent: "center", alignItems: "center" }}>     
          <Text className="text-typography-800 font-bold">Weitere Informationen</Text>
        </View>
        <Text className="text-typography-800">{restoredHtml}</Text>
      </View>
    </View>
  </Card>
</ScrollView>
    );
  }, [appointment, error, loading]);

  return <View style={styles.container}>{content}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#449F29" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  badgeText: { fontWeight: "bold", textAlign: "center" },
  tableHead: { fontWeight: "600", color: "#374151", textAlign: "left" },
  tableData: { textAlign: "left" },
  cardTitlebar: {
    backgroundColor: '#F7F8FB',
    paddingVertical: 10,
    paddingHorizontal: 12,
    textAlign: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomColor: '#dddfeb',
    borderBottomWidth: 1,
  },
  cardBody: {
    padding: 16,
    paddingHorizontal: 20,
    gap: 32,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 1,
  },
  rowIcon: {
    width: 32,
    alignItems: "center",
  },
  linkText: {
    color: "#449F29",
  }
});
