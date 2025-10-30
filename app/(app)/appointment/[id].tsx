import { useLocalSearchParams } from "expo-router";
import { CalendarDays, ChevronDown, CloudAlert, Flag, Mail, MapPinHouse, Phone, User, Wrench } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import openMap from 'react-native-open-maps';
import { Alert, AlertText } from "../../../components/ui/alert";
import { Badge, BadgeText } from "../../../components/ui/badge";
import { Card } from "../../../components/ui/card";
import { Spinner } from "../../../components/ui/spinner";
import { Table, TableBody, TableData, TableHead, TableRow } from "../../../components/ui/table";
import { Text } from "../../../components/ui/text";
import { useAuth } from "../../../src/auth/AuthContext";
import { buildApiUrl } from "../../../src/config/api";

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

// API Basis-URL wird über buildApiUrl zusammengesetzt (zentralisierte Config)

// Zentrale Farbkonstanten (leichtere Anpassung)
const PRIMARY_BRAND = "#449F29"; // Haupt-Hintergrund / Primärfarbe
const BRAND_TEXT = "#45A02A";   // leichte Variation für Texte
const ICON_COLOR = "#555555";    // neutrale Icon-Farbe

export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, apiFetch } = useAuth();

  // States
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Scroll indicator state
  const [atBottom, setAtBottom] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);

  useEffect(() => {
    // Lädt Termin-Details (mit Abbruch-Flag gegen Setzen nach Unmount)
    let cancelled = false;
    (async function fetchAppointment() {
      if (!session?.accessToken || !id) {
        setLoading(false);
        setError(!id ? "Missing appointment id" : "Not authenticated");
        return;
      }
      setLoading(true);
      setError(null);
      try {
  const response = await apiFetch(buildApiUrl(`/appointments/${encodeURIComponent(id)}`));
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || `Failed to fetch (${response.status})`);
        }
        const data = await response.json();
        if (!cancelled) setAppointment(data as Appointment);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Failed to load appointment");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, session?.accessToken, apiFetch]);

  // START -- Hilfsfunktionen --------------------------------------------------

  const openAddress = (address?: string) => { if (address) openMap({ query: address }); };

  // formatiert optionalen Wert oder liefert Fallback "-"
  const display = (value?: string | number | null, fallback: string = "-") => {
    if (value === null || value === undefined) return fallback;
    const trimmed = String(value).trim();
    return trimmed.length ? trimmed : fallback;
  };

  const openPhone = (phone?: string) => { if (phone) Linking.openURL(`tel:${phone}`).catch(() => {}); };
  const openEmail = (email?: string) => { if (email) Linking.openURL(`mailto:${email}`).catch(() => {}); };

  // Prioritäts-Badge (1=hoch, 2=normal, sonst keine)
  const renderPriorityBadge = (priority?: number) => {
    if (priority === 1) {
      return (
        <Badge className="bg-red-500 rounded" action="error" variant="solid" size="lg" style={styles.badgeStyle}>
          <BadgeText className="text-white" size="lg" style={styles.badgeText}>Prio</BadgeText>
        </Badge>
      );
    }
    if (priority === 2) {
      return (
        <Badge className="bg-yellow-500 rounded" action="warning" variant="solid" size="lg" style={styles.badgeStyle}>
          <BadgeText className="text-white" size="lg" style={styles.badgeText}>Normal</BadgeText>
        </Badge>
      );
    }
    return (
      <Badge className="bg-gray-500 rounded" action="default" variant="solid" size="lg" style={styles.badgeStyle}>
        <BadgeText className="text-white" size="lg" style={styles.badgeText}>Keine</BadgeText>
      </Badge>
    );
  };

  // Parses HTML text and returns React Native components with proper formatting
  function parseHtmlDescription(html: string): React.ReactNode[] {
    if (typeof html !== "string") return [html];
    
    // Simple HTML parser for common tags
    const elements: React.ReactNode[] = [];
    let key = 0;
    
    // Replace self-closing br tags and normalize whitespace
    const normalized = html
      .replace(/<\s*br\s*\/??\s*>/gi, "\n")
      .trim();
    
    // Split by tags while preserving them
    const regex = /<(\/?)(b|u|i|strong|em|span)([^>]*)>/gi;
    const parts = normalized.split(regex);
    
    let i = 0;
    const stack: { tag: string; attrs: string }[] = [];
    
    while (i < parts.length) {
      const part = parts[i];
      
      // Check if this is a tag marker
      if (i % 4 === 1) {
        // parts[i] = closing slash or empty
        // parts[i+1] = tag name
        // parts[i+2] = attributes
        const isClosing = part === '/';
        const tagName = parts[i + 1]?.toLowerCase();
        const attrs = parts[i + 2] || '';
        
        if (!isClosing && tagName) {
          stack.push({ tag: tagName, attrs });
        } else if (isClosing && stack.length > 0) {
          stack.pop();
        }
        i += 3;
      } else if (part) {
        // This is text content
        const lines = part.split('\n');
        lines.forEach((line, lineIdx) => {
          if (line.trim()) {
            let textStyle: any = { color: '#1f2937' };
            let textElement = line;
            
            // Apply styles based on current stack
            stack.forEach(({ tag, attrs }) => {
              if (tag === 'b' || tag === 'strong') {
                textStyle.fontWeight = 'bold';
              }
              if (tag === 'u') {
                textStyle.textDecorationLine = 'underline';
              }
              if (tag === 'i' || tag === 'em') {
                textStyle.fontStyle = 'italic';
              }
              if (attrs.includes('text-danger')) {
                textStyle.color = '#dc2626'; // red-600
              }
            });
            
            elements.push(
              <Text key={`text-${key++}`} style={textStyle}>
                {textElement}
              </Text>
            );
          }
          
          // Add line break between lines (except for last line)
          if (lineIdx < lines.length - 1) {
            elements.push(<Text key={`br-${key++}`}>{'\n'}</Text>);
          }
        });
      }
      i++;
    }
    
    return elements.length > 0 ? elements : [<Text key="empty">Keine zusätzlichen Informationen.</Text>];
  }

  // Layout-Helfer: Icon links + Inhalt rechts
  const Row = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
    <View style={styles.row}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );

  // Datums-/Zeitspanne kompakt darstellen (lokal DE)
  const formatRange = (start?: string, end?: string) => {
    const formatOne = (iso?: string) => {
      if (!iso) return "";
      const dt = new Date(iso);
      const datePart = dt.toLocaleDateString("de-DE", { day: "numeric", month: "short" }).replace(/\s/g, "\u00A0");
      const timePart = dt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
      return `${datePart} ${timePart}`;
    };
    const startDisplay = formatOne(start);
    const endDisplay = formatOne(end);
    if (startDisplay && endDisplay) return `${startDisplay} – ${endDisplay}`;
    return startDisplay || endDisplay || "-";
  };

  // ENDE -- Hilfsfunktionen ---------------------------------------------------

  // -- Main content -----------------------------------------------------------

  const content = useMemo(() => {
  const priorityBadge = renderPriorityBadge(appointment?.priority);

    if (loading) {
      return (
        <View style={styles.center}>
          <Spinner size="large" color="#0ea5e9" />
          <Text className="text-typography-600">Laden…</Text>
        </View>
      );
    }
    if (error) {
      // Versuche JSON Fehlerdetails zu parsen
      let parsed: any = null;
      if (error.startsWith('{')) { try { parsed = JSON.parse(error); } catch { /* ignorieren */ } }
      return (
        <View style={[styles.center, { paddingHorizontal: 16 }] }>
          <Alert action="error" variant="solid" style={{ backgroundColor: "#ffcccc" }}>
            <CloudAlert size={32} color="#cf2a2a" />
            <AlertText className="text-error-500 font-bold">
              {parsed?.error || 'Fehler'}
            </AlertText>
            <AlertText className="text-error-500">
              {parsed?.message || error}
            </AlertText>
          </Alert>
        </View>
      );
    }
    if (!appointment) return null;

    // Vollständige Adresse für Karten-App
    const location = appointment.street
      ? `${display(appointment.street)}, ${display(appointment.postalCode)} ${display(appointment.city)}`
      : "-";

    const descriptionHtml = appointment.description ? appointment.description : "Keine zusätzlichen Informationen.";
    const parsedDescription = parseHtmlDescription(descriptionHtml);

    return (
<View style={{ flex: 1 }}>
<ScrollView
  style={{ flex: 1, backgroundColor: PRIMARY_BRAND }}
  contentContainerStyle={{ paddingHorizontal: 0, paddingTop: 20, paddingBottom: 10, gap: 16 }}
  showsVerticalScrollIndicator={false}
  scrollEventThrottle={16}
  onScroll={(e) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const bottomReached = contentOffset.y + layoutMeasurement.height >= contentSize.height - 16; // threshold
    setAtBottom(bottomReached);
    setIsScrollable(contentSize.height > layoutMeasurement.height + 1);
  }}
>
  <Card className="bg-background-0 mb-4 p-0" style={styles.card}> 

    {/* Titlebar */}
    <View style={styles.cardTitlebar}>
      <Text size="md" className="text-typography-700 font-semibold" style={{ color: BRAND_TEXT }}>Serviceeinsatz#{appointment?.id} - {appointment?.reference}</Text>
    </View>

    {/* Body */}
    <View style={styles.cardBody}>

      {/* Einsatzart & Kommission */}
      <Row icon={<Wrench size={32} color={ICON_COLOR} />}>
        <View style={{ flexDirection: "column", gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text size="md" className="text-typography-800">Einsatzart:</Text>
            <Text size="md" className="text-typography-800 font-semibold">{appointment?.title}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text size="md" className="text-typography-800">Kommission:</Text>
            <Text size="md" className="text-typography-800 font-semibold text-wrap">{appointment?.reference}</Text>
          </View>
        </View>
      </Row>

      {/* Priorität */}       
      <Row icon={<Flag size={32} color={ICON_COLOR} />}>
        <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
          <Text size="md" className="text-typography-800 font-semibold">Priorität:</Text>
          {priorityBadge}
        </View>
      </Row>

      {/* Einsatzdauer */}                
      <Row icon={<CalendarDays size={32} color={ICON_COLOR} />}>
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
        <Row icon={<MapPinHouse size={32} color={ICON_COLOR} />}>
          <Text style={styles.linkText}>{display(location)}</Text>
        </Row>
      </Pressable>

      {/* Kontakt */}        
      <Row icon={<User size={32} color={ICON_COLOR} />}>
        <View style={{ gap: 8 }}>
          <Text size="md" className="text-typography-800">{display(appointment?.contactName)}</Text>
          <View style={{ flexDirection: "column", gap: 8 }}>
            <Pressable onPress={() => openPhone(appointment?.contactPhone)} disabled={!appointment?.contactPhone} accessibilityRole="button" accessibilityHint="Anrufen">
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, opacity: appointment?.contactPhone ? 1 : 0.5 }}>
                <Phone size={20} color={"#9AAAAA"} />
                <Text size="sm" style={styles.linkText}>{display(appointment?.contactPhone)}</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => openEmail(appointment?.contactEmail)} disabled={!appointment?.contactEmail} accessibilityRole="button" accessibilityHint="E-Mail schreiben">
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, opacity: appointment?.contactEmail ? 1 : 0.5 }}>
                <Mail size={20} color={"#9AAAAA"} />
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
                    <Text>{display(appointment?.installerCompany)}</Text>
                  </View>
                </TableData>
              </TableRow>
              <TableRow className="p-0">
                <TableHead className="p-0">
                  <Text className="text-typography-800 font-semibold">Auftraggeber</Text>
                </TableHead>
                <TableData className="font-normal text-left p-3">
                  <View style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                    <Text>{display(appointment?.clientCompany)}</Text>
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
        <View style={{ flexDirection: "column", gap: 4 }}>
          {parsedDescription}
        </View>
      </View>
    </View>
  </Card>
</ScrollView>
{isScrollable && !atBottom && !loading && !error && (
  <View pointerEvents="none" style={styles.scrollHint} accessibilityHint="Mehr Inhalte unterhalb verfügbar">
    <View style={styles.scrollHintInner}>
      <ChevronDown size={18} color="#ffffff" />
      <Text size="xs" style={styles.scrollHintText}>Mehr</Text>
    </View>
  </View>
)}
</View>
    );
  }, [appointment, error, loading, atBottom, isScrollable]);

  return <View style={styles.container}>{content}</View>;
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,  
    backgroundColor: PRIMARY_BRAND,
    // Removed paddingTop so the ScrollView can scroll flush with top bar
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  badgeText: { fontWeight: "bold", textAlign: "center", color: "white" },
  badgeStyle: { alignSelf: "flex-start", flexShrink: 1 },
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
    color: PRIMARY_BRAND,
  },
  card: { 
    // borderColor: '#CCCED9', 
    // borderWidth: 1,
    boxShadow: 'inset 0px 1px 2px #ffffff70 , 0px 4px 6px #00000030, 0px 6px 10px #00000015',
    overflow: 'hidden', 
    width: '90%', 
    alignSelf: 'center',
  },
  scrollHint: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollHintInner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignItems: 'center',
    gap: 4,
  },
  scrollHintText: {
    color: '#ffffff',
    fontWeight: '500',
  },
});
