type SavedViewsSubscribe = (listener: () => void) => () => void;

const listenersByKey = new Map<string, Set<() => void>>();
const subscribeByKey = new Map<string, SavedViewsSubscribe>();

export function readSavedViewsRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSavedViewsRaw(key: string, raw: string): boolean {
  try {
    window.localStorage.setItem(key, raw);
  } catch {
    return false;
  }
  listenersByKey.get(key)?.forEach(listener => listener());
  return true;
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
