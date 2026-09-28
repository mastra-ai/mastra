import { useCallback, useSyncExternalStore } from 'react';
import { z } from 'zod/v4';

export type RequestContextEntityType = 'agent' | 'agent-tool' | 'workflow' | 'tool' | 'mcp-tool';

export type EntityRequestContext = Record<string, any>;

const requestContextSchema = z.record(z.string(), z.unknown());

const EMPTY_REQUEST_CONTEXT: EntityRequestContext = {};

const listeners = new Map<string, Set<() => void>>();
const snapshots = new Map<string, { raw: string | null; value: EntityRequestContext }>();

export const getRequestContextStorageKey = (entityType: RequestContextEntityType, entityId: string) =>
  `mastra-request-context:${entityType}:${entityId}`;

const readRaw = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const parse = (raw: string | null): EntityRequestContext => {
  if (!raw) return EMPTY_REQUEST_CONTEXT;
  try {
    const result = requestContextSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : EMPTY_REQUEST_CONTEXT;
  } catch {
    return EMPTY_REQUEST_CONTEXT;
  }
};

// Cache parsed snapshot per key so useSyncExternalStore gets a stable reference.
const getSnapshot = (key: string): EntityRequestContext => {
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

export const writeEntityRequestContext = (key: string, value: EntityRequestContext) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: keep the in-memory snapshot so the session still works.
    snapshots.set(key, { raw: readRaw(key), value });
  }
  notify(key);
};

export function useEntityRequestContext(
  entityType: RequestContextEntityType,
  entityId: string,
): [EntityRequestContext, (next: EntityRequestContext) => void] {
  const key = getRequestContextStorageKey(entityType, entityId);

  const value = useSyncExternalStore(
    useCallback(listener => subscribe(key, listener), [key]),
    () => getSnapshot(key),
    () => EMPTY_REQUEST_CONTEXT,
  );

  const setValue = useCallback((next: EntityRequestContext) => writeEntityRequestContext(key, next), [key]);

  return [value, setValue];
}
