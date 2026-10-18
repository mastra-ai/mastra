import { useCallback, useSyncExternalStore } from 'react';
import { z } from 'zod/v4';

export type JsonObject = Record<string, any>;

const jsonObjectSchema = z.record(z.string(), z.unknown());

const EMPTY: JsonObject = {};
const listeners = new Map<string, Set<() => void>>();
const snapshots = new Map<string, { raw: string | null; value: JsonObject }>();

const readRaw = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const parse = (raw: string | null): JsonObject => {
  if (!raw) return EMPTY;
  try {
    const result = jsonObjectSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : EMPTY;
  } catch {
    return EMPTY;
  }
};

// Cache parsed snapshot per key so useSyncExternalStore gets a stable reference.
const getSnapshot = (key: string): JsonObject => {
  const raw = readRaw(key);
  const cached = snapshots.get(key);
  if (cached && cached.raw === raw) return cached.value;
  const value = parse(raw);
  snapshots.set(key, { raw, value });
  return value;
};

const notify = (key: string) => {
  listeners.get(key)?.forEach(listener => listener());
};

const subscribe = (key: string, listener: () => void) => {
  let keyListeners = listeners.get(key);
  if (!keyListeners) {
    keyListeners = new Set();
    listeners.set(key, keyListeners);
  }
  keyListeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) listener();
  };
  window.addEventListener('storage', onStorage);

  return () => {
    keyListeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
};

export const writeJsonObject = (key: string, value: JsonObject) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: keep the in-memory snapshot so the session still works.
    snapshots.set(key, { raw: readRaw(key), value });
  }
  notify(key);
};

/** Per-key localStorage-backed JSON object shared by every component reading the same key. */
export function useLocalJsonObject(key: string): [JsonObject, (next: JsonObject) => void] {
  const value = useSyncExternalStore(
    useCallback(listener => subscribe(key, listener), [key]),
    () => getSnapshot(key),
    () => EMPTY,
  );

  const setValue = useCallback((next: JsonObject) => writeJsonObject(key, next), [key]);

  return [value, setValue];
}
