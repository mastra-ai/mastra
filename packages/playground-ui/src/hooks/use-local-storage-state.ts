import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod/v4';

interface LocalStorageStateOptions<T> {
  initialKey: string;
  defaultValue: T;
  schema: z.ZodType<T>;
  serialize?: (value: T) => string;
}

// Like useState, initialization happens once. Remount the consumer when its storage key changes.
export function useLocalStorageState<T>({
  initialKey,
  defaultValue,
  schema,
  serialize = JSON.stringify,
}: LocalStorageStateOptions<T>): [T, Dispatch<SetStateAction<T>>] {
  const [storageKey] = useState(initialKey);
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) {
        const parsed = schema.safeParse(JSON.parse(stored));
        if (parsed.success) return parsed.data;
      }
    } catch {
      // Invalid JSON or unavailable browser storage falls back to the initial value.
    }
    return defaultValue;
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, serialize(value));
    } catch {
      // Keep in-memory state usable when storage is unavailable or full.
    }
  }, [storageKey, value, serialize]);

  return [value, setValue];
}

interface ExpiringLocalStorageStateOptions<T> {
  key: string;
  /** Absolute expiration applied to values written through `setValue`. */
  expiresAt: Date | number;
  schema: z.ZodType<T>;
  now?: () => number;
}

interface ExpiringLocalStorageState<T> {
  /** `undefined` when nothing is stored or the stored entry has expired. */
  value: T | undefined;
  /** `true` when an entry existed but its expiration date has passed. */
  expired: boolean;
  setValue: (value: T) => void;
  clear: () => void;
}

interface ExpiringEntry<T> {
  value: T | undefined;
  expiresAt: number | undefined;
  expired: boolean;
}

const MAX_TIMEOUT_MS = 2 ** 31 - 1;
const EMPTY_ENTRY = { value: undefined, expiresAt: undefined, expired: false };

const toMs = (expiresAt: Date | number) => (expiresAt instanceof Date ? expiresAt.getTime() : expiresAt);

const removeStoredItem = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage may be unavailable; the in-memory state is still cleared.
  }
};

// Stores `{ value, expiresAt }` under `key`. The expiration date is persisted with the value, so
// the value stays readable until that date even if the option changes later. Like useState,
// initialization happens once. Remount the consumer when its storage key changes.
export function useExpiringLocalStorageState<T>({
  key,
  expiresAt,
  schema,
  now = Date.now,
}: ExpiringLocalStorageStateOptions<T>): ExpiringLocalStorageState<T> {
  const [storageKey] = useState(key);
  const [entry, setEntry] = useState<ExpiringEntry<T>>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === null) return EMPTY_ENTRY;
      const parsed = z.object({ value: schema, expiresAt: z.number() }).safeParse(JSON.parse(stored));
      if (!parsed.success) return EMPTY_ENTRY;
      if (parsed.data.expiresAt <= now()) {
        removeStoredItem(storageKey);
        return { ...EMPTY_ENTRY, expired: true };
      }
      return { value: parsed.data.value, expiresAt: parsed.data.expiresAt, expired: false };
    } catch {
      // Invalid JSON or unavailable browser storage behaves like an empty entry.
      return EMPTY_ENTRY;
    }
  });

  useEffect(() => {
    if (entry.expiresAt === undefined) return;
    const timeout = setTimeout(
      () => {
        removeStoredItem(storageKey);
        setEntry({ ...EMPTY_ENTRY, expired: true });
      },
      Math.min(Math.max(entry.expiresAt - now(), 0), MAX_TIMEOUT_MS),
    );
    return () => clearTimeout(timeout);
  }, [storageKey, entry.expiresAt, now]);

  const setValue = useCallback(
    (value: T) => {
      const expiresAtMs = toMs(expiresAt);
      try {
        localStorage.setItem(storageKey, JSON.stringify({ value, expiresAt: expiresAtMs }));
      } catch {
        // Keep in-memory state usable when storage is unavailable or full.
      }
      setEntry({ value, expiresAt: expiresAtMs, expired: false });
    },
    [storageKey, expiresAt],
  );

  const clear = useCallback(() => {
    removeStoredItem(storageKey);
    setEntry(EMPTY_ENTRY);
  }, [storageKey]);

  return { value: entry.value, expired: entry.expired, setValue, clear };
}
