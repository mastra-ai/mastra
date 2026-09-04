import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'mastracode.pinnedSessions';
const CHANGE_EVENT = 'mastracode:pinned-sessions-change';

let cachedValue: string | null = null;
let cachedSessions = new Set<string>();
let storageUnavailable = false;

function readPinnedSessions(): Set<string> {
  if (storageUnavailable) return cachedSessions;

  let value: string | null;
  try {
    value = localStorage.getItem(STORAGE_KEY);
  } catch {
    storageUnavailable = true;
    return cachedSessions;
  }

  if (value === cachedValue) return cachedSessions;

  cachedValue = value;
  try {
    const parsed: unknown = value ? JSON.parse(value) : [];
    cachedSessions = new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
  } catch {
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
    storageUnavailable = false;
  } catch {
    storageUnavailable = true;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function usePinnedSessions() {
  const pinnedSessions = useSyncExternalStore(subscribe, readPinnedSessions, () => new Set<string>());
  const setPinned = (sessionId: string, pinned: boolean) => {
    const next = new Set(readPinnedSessions());
    if (pinned) next.add(sessionId);
    else next.delete(sessionId);
    savePinnedSessions(next);
  };

  return { pinnedSessions, setPinned };
}
