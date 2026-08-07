import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'mastracode.pinnedSessions';
const CHANGE_EVENT = 'mastracode:pinned-sessions-change';

let cachedValue: string | null = null;
let cachedSessions = new Set<string>();

function readPinnedSessions(): Set<string> {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === cachedValue) return cachedSessions;

    cachedValue = value;
    const parsed: unknown = value ? JSON.parse(value) : [];
    cachedSessions = new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    cachedValue = null;
    cachedSessions = new Set();
  }
  return cachedSessions;
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

function savePinnedSessions(sessions: Set<string>) {
  cachedValue = JSON.stringify([...sessions]);
  cachedSessions = sessions;
  try {
    localStorage.setItem(STORAGE_KEY, cachedValue);
  } catch {
    // Pinning remains available for the current page when storage is unavailable.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function usePinnedSessions() {
  const pinnedSessions = useSyncExternalStore(subscribe, readPinnedSessions, () => new Set<string>());
  const setPinned = useCallback((sessionId: string, pinned: boolean) => {
    const next = new Set(readPinnedSessions());
    if (pinned) next.add(sessionId);
    else next.delete(sessionId);
    savePinnedSessions(next);
  }, []);

  return { pinnedSessions, setPinned };
}
