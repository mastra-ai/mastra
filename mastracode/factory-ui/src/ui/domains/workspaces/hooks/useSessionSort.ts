import { useSyncExternalStore } from 'react';

import {
  DEFAULT_USER_SESSION_SORT,
  DEFAULT_WORKSPACE_SESSION_SORT,
  isUserSessionSort,
  isWorkspaceSessionSort,
} from '../services/sessionSort';
import type { UserSessionSort, WorkspaceSessionSort } from '../services/sessionSort';

const STORAGE_KEY = 'mastracode.sessionSort';
const CHANGE_EVENT = 'mastracode:session-sort-change';

type SessionSortBySection = { work: WorkspaceSessionSort; review: WorkspaceSessionSort; user: UserSessionSort };
export type SessionSortSection = keyof SessionSortBySection;
type SessionSortPicks = Partial<SessionSortBySection>;

const DEFAULT_SESSION_SORTS: SessionSortBySection = {
  work: DEFAULT_WORKSPACE_SESSION_SORT,
  review: DEFAULT_WORKSPACE_SESSION_SORT,
  user: DEFAULT_USER_SESSION_SORT,
};
const NO_PICKS: SessionSortPicks = {};

let cachedValue: string | null = null;
let cachedPicks = NO_PICKS;
let storageUnavailable = false;

function parseSessionSortPicks(value: string | null): SessionSortPicks {
  if (!value) return NO_PICKS;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return NO_PICKS;
  }
  if (typeof parsed !== 'object' || parsed === null) return NO_PICKS;
  const stored: Partial<Record<SessionSortSection, unknown>> = parsed;
  return {
    ...(isWorkspaceSessionSort(stored.work) && { work: stored.work }),
    ...(isWorkspaceSessionSort(stored.review) && { review: stored.review }),
    ...(isUserSessionSort(stored.user) && { user: stored.user }),
  };
}

function readSessionSortPicks(): SessionSortPicks {
  if (storageUnavailable) return cachedPicks;

  let value: string | null;
  try {
    value = localStorage.getItem(STORAGE_KEY);
  } catch {
    storageUnavailable = true;
    return cachedPicks;
  }
  if (value === cachedValue) return cachedPicks;

  cachedValue = value;
  cachedPicks = parseSessionSortPicks(value);
  return cachedPicks;
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

function saveSessionSortPicks(picks: SessionSortPicks) {
  cachedValue = JSON.stringify(picks);
  cachedPicks = picks;
  try {
    localStorage.setItem(STORAGE_KEY, cachedValue);
    storageUnavailable = false;
  } catch {
    storageUnavailable = true;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useSessionSort<S extends SessionSortSection>(
  section: S,
): readonly [SessionSortBySection[S], (sort: SessionSortBySection[S]) => void] {
  const picks = useSyncExternalStore(subscribe, readSessionSortPicks, () => NO_PICKS);
  const setSort = (sort: SessionSortBySection[S]) => {
    const { [section]: _previous, ...otherPicks } = readSessionSortPicks();
    saveSessionSortPicks(sort === DEFAULT_SESSION_SORTS[section] ? otherPicks : { ...otherPicks, [section]: sort });
  };
  return [picks[section] ?? DEFAULT_SESSION_SORTS[section], setSort];
}
