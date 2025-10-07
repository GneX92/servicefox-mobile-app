// Utilities for persisting and managing push notification related data.
// NOTE: True device MAC addresses are not available in Expo (and are restricted on iOS/Android for privacy).
// We instead generate a stable (persisted) pseudo device identifier on first use that combines
// a few non-unique build/model hints plus random entropy. This stays stable for the app install
// because we store it in SecureStore.

import * as Device from 'expo-device';
import { getItem, setItem } from './storage';

export const PUSH_TOKEN_KEY = 'pushToken'; // indicates successful registration
export const PUSH_TOKEN_FAILED_KEY = 'pushTokenFailed'; // holds JSON metadata about last failed registration attempt
export const DEVICE_ID_KEY = 'deviceId';

/** Returns a stable pseudo device id (NOT a MAC address). */
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
