import { useSyncExternalStore } from 'react';

export interface LocalStorageStore<T> {
  read: () => T;
  write: (value: T) => void;
  subscribe: (onStoreChange: () => void) => () => void;
  empty: T;
}

interface LocalStorageStoreOptions<T> {
  key: string;
  empty: T;
  /** Receives the JSON-parsed stored value. Throw, or return `empty`, to reject it. */
  parse: (stored: unknown) => T;
  toJSON?: (value: T) => unknown;
}

export function createLocalStorageStore<T>({
  key,
  empty,
  parse,
  toJSON = value => value,
}: LocalStorageStoreOptions<T>): LocalStorageStore<T> {
  const listeners = new Set<() => void>();
  let cachedRaw: string | null = null;
  let cachedValue = empty;
  let storageUnavailable = false;

  const parseRaw = (raw: string | null): T => {
    if (raw === null) return empty;
    try {
      return parse(JSON.parse(raw));
    } catch {
      return empty;
    }
  };

  const read = (): T => {
    if (storageUnavailable) return cachedValue;
    let raw: string | null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      storageUnavailable = true;
      return cachedValue;
    }
    if (raw === cachedRaw) return cachedValue;
    cachedRaw = raw;
    cachedValue = parseRaw(raw);
    return cachedValue;
  };

  const write = (value: T) => {
    cachedRaw = JSON.stringify(toJSON(value));
    cachedValue = value;
    try {
      localStorage.setItem(key, cachedRaw);
      storageUnavailable = false;
    } catch {
      storageUnavailable = true;
    }
    listeners.forEach(listener => listener());
  };

  const subscribe = (onStoreChange: () => void) => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key && event.key !== null) return;
      storageUnavailable = false;
      onStoreChange();
    };
    listeners.add(onStoreChange);
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(onStoreChange);
      window.removeEventListener('storage', onStorage);
    };
  };

  return { read, write, subscribe, empty };
}

export function useLocalStorageStore<T>(store: LocalStorageStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.read, () => store.empty);
}
