const listenersByKey = new Map<string, Set<() => void>>();
// What could not be written (storage full or blocked), so the session keeps its views.
const unpersistedByKey = new Map<string, string>();

export function readSavedViewsRaw(key: string): string | null {
  const unpersisted = unpersistedByKey.get(key);
  if (unpersisted !== undefined) return unpersisted;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSavedViewsRaw(key: string, raw: string): void {
  try {
    window.localStorage.setItem(key, raw);
    unpersistedByKey.delete(key);
  } catch {
    unpersistedByKey.set(key, raw);
  }
  listenersByKey.get(key)?.forEach(listener => listener());
}

export function subscribeSavedViews(key: string, listener: () => void): () => void {
  const listeners = listenersByKey.get(key) ?? new Set<() => void>();
  listenersByKey.set(key, listeners);
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}
