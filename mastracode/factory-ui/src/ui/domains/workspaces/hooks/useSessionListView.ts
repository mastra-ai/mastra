import { useSyncExternalStore } from 'react';

import { DEFAULT_SESSION_SORT, isSessionSort } from '../services/sessionSort';
import type { SessionSort } from '../services/sessionSort';

const STORAGE_KEY = 'mastracode.sessionListView';
const CHANGE_EVENT = 'mastracode:session-list-view-change';

export interface SessionListView {
  sort: SessionSort;
}

export const DEFAULT_SESSION_LIST_VIEW: SessionListView = { sort: DEFAULT_SESSION_SORT };

type SessionListViewChanges = Partial<SessionListView>;
const NO_CHANGES: SessionListViewChanges = {};

let cachedValue: string | null = null;
let cachedChanges = NO_CHANGES;
let storageUnavailable = false;

function parseViewChanges(value: string | null): SessionListViewChanges {
  if (!value) return NO_CHANGES;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return NO_CHANGES;
  }
  if (typeof parsed !== 'object' || parsed === null) return NO_CHANGES;
  const stored: Partial<Record<keyof SessionListView, unknown>> = parsed;
  return { ...(isSessionSort(stored.sort) && { sort: stored.sort }) };
}

function readViewChanges(): SessionListViewChanges {
  if (storageUnavailable) return cachedChanges;

  let value: string | null;
  try {
    value = localStorage.getItem(STORAGE_KEY);
  } catch {
    storageUnavailable = true;
    return cachedChanges;
  }
  if (value === cachedValue) return cachedChanges;

  cachedValue = value;
  cachedChanges = parseViewChanges(value);
  return cachedChanges;
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

function saveViewChanges(changes: SessionListViewChanges) {
  cachedValue = JSON.stringify(changes);
  cachedChanges = changes;
  try {
    localStorage.setItem(STORAGE_KEY, cachedValue);
    storageUnavailable = false;
  } catch {
    storageUnavailable = true;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function changesFromDefault(view: SessionListView): SessionListViewChanges {
  return { ...(view.sort !== DEFAULT_SESSION_LIST_VIEW.sort && { sort: view.sort }) };
}

export function useSessionListView(): {
  view: SessionListView;
  updateView: (changes: Partial<SessionListView>) => void;
  resetView: () => void;
} {
  const changes = useSyncExternalStore(subscribe, readViewChanges, () => NO_CHANGES);
  return {
    view: { ...DEFAULT_SESSION_LIST_VIEW, ...changes },
    updateView: next =>
      saveViewChanges(changesFromDefault({ ...DEFAULT_SESSION_LIST_VIEW, ...readViewChanges(), ...next })),
    resetView: () => saveViewChanges(NO_CHANGES),
  };
}
