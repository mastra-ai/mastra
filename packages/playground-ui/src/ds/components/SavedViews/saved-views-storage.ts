type SavedViewsSubscribe = (listener: () => void) => () => void;

const listenersByKey = new Map<string, Set<() => void>>();
const subscribeByKey = new Map<string, SavedViewsSubscribe>();
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

export function savedViewsSubscriber(key: string): SavedViewsSubscribe {
  const cached = subscribeByKey.get(key);
  if (cached) return cached;
  const subscribe: SavedViewsSubscribe = listener => subscribeSavedViews(key, listener);
  subscribeByKey.set(key, subscribe);
  return subscribe;
}

function subscribeSavedViews(key: string, listener: () => void): () => void {
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
