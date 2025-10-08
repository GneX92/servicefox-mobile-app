import * as SecureStore from "expo-secure-store";

const secureOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
} as const;

const hasWindow = typeof window !== "undefined";

async function trySecure<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {   
    return await fn();
  } catch {
    return undefined;
  }
}

export async function getItem(key: string): Promise<string | null> {
  const r1 = await trySecure(() => SecureStore.getItemAsync(key));
  if (typeof r1 !== "undefined") return r1;
  if (hasWindow && window.localStorage)
    return window.localStorage.getItem(key);
  return null;
}

export async function setItem(
  key: string,
  value: string
): Promise<void> {
  const ok = await trySecure(() =>
    SecureStore.setItemAsync(key, value, secureOptions)
  );
  if (typeof ok !== "undefined") return;
  if (hasWindow && window.localStorage)
    window.localStorage.setItem(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  const ok = await trySecure(() => SecureStore.deleteItemAsync(key));
  if (typeof ok !== "undefined") return;
  if (hasWindow && window.localStorage)
    window.localStorage.removeItem(key);
}