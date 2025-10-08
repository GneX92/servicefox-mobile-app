# ServiceFox Mobile App – Entwickler-Dokumentation

> Dieses Dokument richtet sich an neue Entwickler:innen und beschreibt Architektur, Projekt-Setup, Coding-Konventionen sowie zentrale Flows (Authentifizierung, Push-Benachrichtigungen, Styling, Routing).
>
> Tech-Stack: **Expo (SDK 54)**, **React 19**, **React Native 0.81**, **expo-router 6**, **TypeScript**, **NativeWind (Tailwind)**, **Gluestack UI**, **SecureStore**, **expo-notifications**.

---

## 1. Quick Start

### Voraussetzungen

- Node.js (empfohlen >= 18 LTS – konsistent mit Expo SDK 54 Anforderungen)
- `bun` oder `yarn` optional; Standard ist `npm`
- Android Studio (Emulator) und/oder Xcode (iOS Simulator) für native Tests
- EAS / Expo Account für Build & Push-Token (optional aber empfohlen)

### Projekt installieren & starten

```bash
npm install          # Dependencies
npx expo start       # Dev Server (QR-Code / Plattform wählen)
# Alternativ: npm run android | ios | web
```

### Wichtige Skripte (`package.json`)

- `npm start` – alias zu `expo start`
- `npm run android | ios | web` – spezifische Plattform
- `npm run lint` – ESLint (Konfiguration über `eslint-config-expo`)
- `npm test` – Jest (Preset: `jest-expo`)
- `npm run reset-project` – projektspezifischer Reset (Script in `./scripts/` – falls vorhanden)

### Environment Variable

Backend-Basis-URL via **öffentlicher Expo Env**:

```bash
EXPO_PUBLIC_BACKEND_API_URL=https://api.example.tld
```

Setzen in:

- Lokaler Start: `.env` (wenn verwendet) oder Shell-Export
- `app.json` / `app.config.(js|ts)` via `extra` (dann Zugriff über `Constants.expoConfig.extra.backendUrl`)

---

## 2. Projektstruktur (High-Level)

```text
app/                       # expo-router Dateibasiertes Routing
  _layout.tsx              # Root Stack + Providers
  (auth)/                  # Auth-spezifische Screens
  (app)/                   # Authentifizierter Bereich
    (tabs)/                # Tabs Layout + Screens (index, settings, logout)
    appointment/[id].tsx   # Termin-Detail Screen (dynamisch)
components/ui/             # Design-System / Abstraktionen (Button, Card, Modal, etc.)
context/                   # Querschnitts-Kontexte (z.B. NotificationContext)
src/auth/AuthContext.tsx   # Authentifizierung + Token-Refresh
src/config/api.ts          # API Basis-URL Normalisierung/Validierung
src/utils/                 # Hilfsfunktionen (storage, push, registerForPush...)
assets/                    # Bilder, Icons, Logos
global.css                 # Tailwind Layer Imports
Docs.md                    # Dieses Dokument
```

### Wichtige Kontexte

- `AuthContext` – verwaltet Login, Logout, Auto-Refresh (Access/Refresh-Token, Session-ID, geschützter Fetch Wrapper)
- `NotificationContext` – verwaltet Push-Token Registrierung (Backoff & Retry) + Nutzerinteraktion mit Notifications

### UI Layer

- `components/ui/*` kapselt Gluestack + eigene Layout-/Präsentationskomponenten
- Web-spezifische Varianten via `index.web.tsx` (Plattform überschreibt Standard-Datei)

### Styling

- Tailwind (NativeWind) + CSS-Variablen (Tokens) aus `tailwind.config.js`
- `global.css` importiert Base/Components/Utilities
- Farb-Tokens werden über CSS Custom Properties bereitgestellt (z. B. `--color-primary-500`)

---

## 3. Routing & Navigationsmodell

Verwendet **expo-router** (dateibasiert):

- `app/_layout.tsx` definiert Root `<Stack>` + Provider (`AuthProvider`, `GluestackUIProvider`).
- Segment-Namen in runden Klammern (z. B. `(auth)`, `(app)`) sind **Gruppierungen** ohne eigenen Pfadbestandteil.
- Tabs: `app/(app)/(tabs)/_layout.tsx` liefert `<Tabs>`; einzelne Screens sind `index.tsx`, `settings.tsx`, `logout.tsx`.
- Dynamische Route: `appointment/[id].tsx` -> `/appointment/123`.

### Auth-Gating

Es erfolgt kein explizites Hard-Redirect im Root; stattdessen entscheiden Screens/Layouts bedarfsgesteuert (z. B. durch Zustand `session`), welche Segmente dem Nutzer angezeigt werden. (Falls noch nicht umgesetzt, kann optional ein Guard Hook ergänzt werden.)

---

## 4. Authentifizierung & Token-Handling

`src/auth/AuthContext.tsx` implementiert:

- Speichert `accessToken`, `refreshToken`, `sessionId` in **SecureStore** (Fallback: `localStorage` im Web)
- Dekodiert Ablaufzeit (`exp`) des Access Tokens (ohne JWT Signaturprüfung – bewusst leichtgewichtig)
- Plant automatischen Refresh vor Ablauf (`REFRESH_LEAD_TIME_MS = 60s`)
- Verhindert parallele Refresh-Aufrufe (`refreshInFlightRef`)
- `apiFetch` Wrapper:
  - Fügt `Authorization: Bearer <accessToken>` + `x-session-id` ein
  - Bei `401` einmaliger Refresh-Versuch, danach Retry
  - Optional `skipAuth` um öffentliche Requests zu senden

### Relevante Methoden

- `signIn(email, password)` – POST `/v1/auth/login`
- `refresh()` – POST `/v1/auth/refresh`
- `signOut()` – POST `/v1/auth/logout` + Push-Deregistrierung + lokales Löschen

### Fehler & Edge Cases

- Ungültiges/fehlendes Token: Session wird verworfen, `isBootstrapping` endet
- Refresh-Fehler bei App-Start: Tokens werden gelöscht (Clean State)
- Sicherheit: Keine persistente Prüfung der JWT-Signatur – Server sollte abgelehnte Tokens korrekt behandeln

### Best Practice bei neuen API-Calls im selben Backend

```ts
import { buildApiUrl } from '@/src/config/api';
import { useAuth } from '@/src/auth/AuthContext';

const { apiFetch } = useAuth();
const res = await apiFetch(buildApiUrl('/endpunkt'), { method: 'GET' });
if (!res.ok) throw new Error(await res.text());
const data = await res.json();
```

---

## 5. API-Konfiguration (`src/config/api.ts`)

Features:

- Liest `EXPO_PUBLIC_BACKEND_API_URL` oder `expoConfig.extra.backendUrl` (letztere aktuell nicht hinterlegt)
- Validiert URL-Format (Warnung bei unsicherem HTTP in Nicht-Local Umgebung)
- `buildApiUrl(path)` hängt Pfad robust an
- `requireApiBaseUrl()` wirft Fehlermeldung, falls nicht gesetzt

### Einrichtung Backend URL

1. Setze `.env`: `EXPO_PUBLIC_BACKEND_API_URL=https://...`
2. (Optional) In `app.json` unter `expo.extra.backendUrl`
3. Starte Dev Server neu

---

## 6. Push-Benachrichtigungen

### Komponenten

- Registrierung: `registerForPushNotificationsAsync()` (holt Berechtigungen, Expo Push Token)
- Gerätelogik: `pushNotifications.ts` (generiert pseudo Geräte-ID, speichert Tokens)
- Kontext: `NotificationContext.tsx`

### Registrierungsablauf

1. App startet / Permissions -> Expo Push Token wird geholt
2. Wenn Nutzer eingeloggt (`session.accessToken` vorhanden) startet Registrierung gegen Backend POST `/push/register`
3. Exponentielles Backoff (max 5 Versuche) innerhalb eines Intervalls
4. Regelmäßige Retry-Schleife alle 15 Minuten bis Erfolg oder 24h Fenster überschritten (`status: paused`)
5. Bei Erfolg: Speichert Token (`PUSH_TOKEN_KEY`), entfernt Failure-Metadaten

### Zustandsobjekt (`pushRegistration`)

| Feld | Beschreibung |
|------|--------------|
| `status` | Status der Registrierung (idle/registering/registered/failed/paused) |
| `attempts` | Anzahl einzelner Versuche (inkl. Backoff) |
| `lastSuccessAt` / `lastFailureAt` | Zeitstempel Erfolg / letzter Fehler |
| `failureMessage` | Letzte bekannte Fehlermeldung |
| `maxWindowExceeded` | Ob 24h Retry-Fenster überschritten wurde |

### Nutzerinteraktion

- Vordergrund: Notification -> Toast (mit Termin-ID) -> Touch Tap springt zum Termin (`/appointment/[id]`)
- Hintergrund: Notification -> Native Push Nachricht -> Touch Tap: Response Listener navigiert direkt zum Termin (`/appointment/[id]`)

### Abmeldung

`signOut()` deregistriert Push-Token (DELETE `/push/register` mit Token, Platform, deviceId) bevor lokale Tokens gelöscht werden.

---

## 7. Persistenz & Storage

`src/utils/storage.ts` abstrahiert Zugriffe:

- Primär: `expo-secure-store` (verschlüsselt, Geräte-spezifisch)
- Fallback: `window.localStorage` (Web)
- Funktionen: `getItem`, `setItem`, `deleteItem`
- Schlüsselbeispiele: `accessToken`, `refreshToken`, `sessionId`, `pushToken`, `deviceId`

---

## 8. Styling & Design System

### Tailwind / NativeWind

- Konfig: `tailwind.config.js`
- `content` globs umfassen alle relevanten Verzeichnisse (app, components, src, utils)
- `presets: [require('nativewind/preset')]` integriert RN-spezifische Varianten
- Farb-System: Farbgruppen (primary, secondary, error, etc.) referenzieren CSS Vars: `rgb(var(--color-primary-500)/<alpha-value>)`

### Gluestack UI

- Provider in Root Layout: `<GluestackUIProvider mode="light">`
- Eigene UI-Komponenten in `components/ui` abstrahieren Standard-Bausteine
- Plattform-spezifisch: `.web.tsx` für Web Overrides (Performance & Semantik)

### Klassen-Konventionen

- Utility-first (Tailwind) + semantische Komponenten (Button, Text)

---

## 9. Tests & Qualität

### Testing

- Jest + `jest-expo`
- React Native Testing Library (`@testing-library/react-native`)
- Beispieltest (hinzufügen in `__tests__`):

```ts
import { render } from '@testing-library/react-native';
import { Button } from '@/components/ui/button';

test('renders button', () => {
  const { getByText } = render(<Button><Button.Text>Hi</Button.Text></Button>);
  expect(getByText('Hi')).toBeTruthy();
});
```

### Linting

- `eslint.config.js` (Flat Config, ignoriert `dist/*`)
- Ausführen: `npm run lint`

### Empfohlene zusätzliche Checks (Noch nicht konfiguriert)

- Type-Check CI: `tsc --noEmit`

---

## 10. Architekturprinzipien

| Bereich | Prinzip |
|--------|---------|
| API Zugriff | Zentral über `apiFetch` + `buildApiUrl`, kein Direkt-Fetch außer sehr triviale öffentliche Endpunkte |
| Auth | Token-Rotation transparent, View-Komponenten kennen keine Refresh-Logik |
| Styling | Design Tokens & Variablen, möglichst kein Hardcoding von Farbcodes außerhalb Tokens |
| Komponenten | Kleine, zustandsarme UI-Elemente, komplexe Logik in Hooks/Kontext |
| Fehlerbehandlung | Backend-Fehler möglichst textuell weiterreichen (für Toast/Modal) |
| Sicherheit | Tokens in SecureStore, niemals in Logs (nur Kürzen falls Log nötig) |

### Mögliche Erweiterungen

- Error Boundary + Global Toast für API Fehler
- Feature Flags (über `expo-updates` + Remote Config)

---

## 11. Häufige Aufgaben: How-To

### Neuen geschützten Screen hinzufügen

1. Datei unter `app/(app)/mein-screen.tsx`
2. Komponente exportieren
3. Optional Tab: In `(tabs)/_layout.tsx` neuen `<Tabs.Screen name="mein-screen" ... />` einfügen
4. API Calls über `const { apiFetch } = useAuth()`

### Öffentlichen Screen (ohne Login) hinzufügen

1. Unter `app/(auth)` oder außerhalb `(app)`
2. Beim Rendern Zustand `session` prüfen und ggf. Redirect (z. B. `router.replace('/(app)')`)

### Neuen API Endpoint nutzen

```ts
const res = await apiFetch(buildApiUrl('/endpunkt'), { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } });
if (!res.ok) throw new Error(await res.text());
const json = await res.json();
```

### Push Notification Deeplink erweitern

1. Im Backend `data` Feld (z. B. `{ type: 'appointment', appointmentId: 123 }`) ausliefern
2. In `NotificationContext` innerhalb `showToastForNotification` Switch ergänzen
3. Navigation: `router.push('/pfad/xyz')`

### Farbpalette anpassen

- CSS Variablen definieren (z. B. in globalem Stylesheet / Theme Provider)
- `tailwind.config.js` referenziert Variablen – kein Codechange bei Komponenten nötig

---

## 12. Sicherheit & Datenschutz

- Tokens nur im **SecureStore** (verschlüsselt) – Web Fallback kritisch (lokaler Storage => geringerer Schutz)
- Keine Speicherung sensibler Payloads im Async Storage / Logs
- Geräte-ID ist pseudo-random (kein Zugriff auf echte MAC → DSGVO-konformer Ansatz)
- Bei Logout: Push-Token Deregistrierung um unautorisierte Zustellung zu verhindern

### Empfehlungen

- Optional: Key Pinning / TLS Zertifikatsüberwachung

---

## 14. Troubleshooting

| Problem | Ursache | Lösung |
|---------|---------|--------|
| API_BASE_URL leer | Env nicht gesetzt | `.env` oder `app.json` prüfen, Dev Server neu starten |
| 401 nach Login | Refresh Token ungültig / Uhrzeit falsch | Gerätezeit & Serverlogs prüfen, Tokens löschen (`signOut`) |
| Push Token null | Permissions verweigert | App-Einstellungen öffnen & Rechte erteilen |
| Push Registrierung paused | 24h Fenster überschritten | `retryPushRegistration()` aufrufen (UI Trigger) aufrufbar mit long press im Settings screen |
| Metro Bundler Cache Fehler | Veraltete Artefakte | `expo start -c` (Cache clear) |
| Tailwind Klassen fehlen | Content Globs unvollständig | `tailwind.config.js` prüfen, ggf. neuen Pfad ergänzen |

---

## 15. Erweiterungsideen (Roadmap Vorschläge)

- Implementierung einer globalen Fehler-Komponente (Toast + Logging)
- Offline Support (Persistenter Query Cache)
- Theming (Dark Mode Umschaltbar – aktuell `mode="light"` erzwungen)
- Crash/Performance Monitoring
- Unit Tests für Auth-Flow (Mock `fetch` / Timer)

---

## 16. Code Guidelines (Kurzfassung)

- TypeScript strikt nutzen (keine `any` ohne Kommentar)
- Hooks Präfix `use*`, Komponenten PascalCase
- Keine magischen Strings – Konstanten definieren
- `fetch` nur über `apiFetch` (Ausnahmen dokumentieren)
- Fehlertexte vom Backend möglichst unverändert zur UI

---

## 17. Häufig genutzte Pfade & Konstanten

| Datei | Zweck |
|-------|-------|
| `src/config/api.ts` | API Basis-URL & Utility Funktionen |
| `src/auth/AuthContext.tsx` | Authentication Lifecycle & geschütztes Fetch |
| `context/NotificationContext.tsx` | Push Registrierung & Notification Handling |
| `src/utils/pushNotifications.ts` | Gerätetoken & IDs |
| `src/utils/registerForPushNotificationsAsync.ts` | Token vom Expo Service holen |
| `src/utils/storage.ts` | Persistenz Abstraktion (SecureStore + Fallback) |
| `tailwind.config.js` | Theme Tokens & Scans |

---

## 18. Checklist für neuen PR

- [ ] Lint & Type-Check sauber
- [ ] Relevante Tests hinzugefügt / angepasst
- [ ] Keine Hardcoded Secrets
- [ ] API Endpoints über `buildApiUrl` genutzt
- [ ] Dokumentation (falls Feature komplex) aktualisiert (`Docs.md` Abschnitt hinzufügen)
- [ ] Screens reagieren auf fehlende `session` (kein Crash)

---

## 19. FAQ (Kurz)

**F: Wie ändere ich die Backend URL im Build?**  
A: In EAS über Build Profile Env Variablen (`EXPO_PUBLIC_BACKEND_API_URL`) setzen.

**F: Warum SecureStore Fallback?**  
A: Web Build hat kein SecureStore → Fallback `localStorage` => geringere Sicherheit; ggf. für Web alternative Strategie implementieren.

---

## 20. Kontakt & Ownership

Trage hier interne Ansprechpartner nach (Team Lead, Mobile Maintainer, Backend Owner, DevOps). *Platzhalter: Bitte ergänzen.*

| Rolle | Name | Info |
|-------|------|---------|
| Mobile | Marvin Voß | ursprünglich: Julian Bliemel (ehem. Praktikant) |
| Backend | Marvin Voß | ursprünglich: Julian Bliemel (ehem. Praktikant) |

---

### Letzte Aktualisierung

Automatisch erstellt: 2025-10-08. Bitte pflegen bei strukturellen Änderungen.

---
Viel Erfolg & Happy Shipping!
