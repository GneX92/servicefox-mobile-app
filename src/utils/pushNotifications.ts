// Hilfsfunktionen für Push-Benachrichtigungen
// NOTE: Echte MAC-Adressen sind in Expo nicht verfügbar (und sind auf iOS/Android aus Datenschutzgründen eingeschränkt).
// Stattdessen wird eine stabile (persistente) pseudo Geräte-ID bei der ersten Verwendung generiert, diese kombiniert
// einige nicht eindeutige Build-/Modellhinweise mit zufälliger Entropie. Diese bleibt stabil für die App-Installation
// weil sie im SecureStore gespeichert wird.

import * as Device from 'expo-device';
import { getItem, setItem } from './storage';

export const PUSH_TOKEN_KEY = 'pushToken';
export const PUSH_TOKEN_FAILED_KEY = 'pushTokenFailed'; // JSON-Metadaten zum letzten fehlgeschlagenen Registrierungsversuch
export const DEVICE_ID_KEY = 'deviceId';

/** Gibt Pseudo-Geräte-ID zurück (Keine MAC-Adresse weil man die nicht einfach abrufen kann). */
export async function getDeviceId(): Promise<string> {
  const existing = await getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const parts = [
    Device.osBuildId || 'ob',
    Device.modelId || 'mid',
    (Device.platformApiLevel ?? 'pl').toString(),
    Math.random().toString(36).slice(2, 10),
  ];
  const id = parts.join('-');
  await setItem(DEVICE_ID_KEY, id);
  return id;
}
