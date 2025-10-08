// Zentralisierte Auflösung & Validierung der API-Basis-URL
// Verwendet die Umgebungsvariable EXPO_PUBLIC_BACKEND_API_URL (öffentliche Expo-Env) und erzwingt HTTPS in Produktions-Builds.

import Constants from 'expo-constants';

// Unterstützt sowohl process.env als auch einen Fallback über Constants.expoConfig.extra (Dev-Tooling).
const raw = process.env.EXPO_PUBLIC_BACKEND_API_URL
  || (Constants.expoConfig?.extra as any)?.backendUrl
  || '';

// Einfache Normalisierung
function normalize(url: string): string {
  return url.replace(/\/$/, '');
}

function validate(url: string): string {
  if (!url) return url; // Leer erlaubt -> wird bei Aufruf behandelt
  try {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const isLocalDev = /^(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(parsed.hostname);
    if (!isHttps && !isLocalDev) {
      console.warn('[api] Insecure API URL detected (non-HTTPS in non-local env):', url);
    }
    return normalize(url);
  } catch {
    console.warn('[api] Invalid API URL format:', url);
    return '';
  }
}

export const API_BASE_URL = validate(raw);

export function requireApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error('API base URL is not configured. Set EXPO_PUBLIC_BACKEND_API_URL in your environment.');
  }
  return API_BASE_URL;
}

export function buildApiUrl(path: string): string {
  const base = requireApiBaseUrl();
  if (!path.startsWith('/')) path = '/' + path;
  return base + path;
}
