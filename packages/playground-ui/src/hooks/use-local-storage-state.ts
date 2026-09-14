import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useState } from 'react';
import type { z } from 'zod/v4';

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
