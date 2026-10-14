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

const DEFAULT_SESSION_SORTS: SessionSortBySection = {
  work: DEFAULT_WORKSPACE_SESSION_SORT,
  review: DEFAULT_WORKSPACE_SESSION_SORT,
  user: DEFAULT_USER_SESSION_SORT,
};

let cachedValue: string | null = null;
let cachedSorts = DEFAULT_SESSION_SORTS;
let storageUnavailable = false;

function parseSessionSorts(value: string | null): SessionSortBySection {
  if (!value) return DEFAULT_SESSION_SORTS;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return DEFAULT_SESSION_SORTS;
  }
  if (typeof parsed !== 'object' || parsed === null) return DEFAULT_SESSION_SORTS;
  const stored: Partial<Record<SessionSortSection, unknown>> = parsed;
  return {
    work: isWorkspaceSessionSort(stored.work) ? stored.work : DEFAULT_SESSION_SORTS.work,
    review: isWorkspaceSessionSort(stored.review) ? stored.review : DEFAULT_SESSION_SORTS.review,
    user: isUserSessionSort(stored.user) ? stored.user : DEFAULT_SESSION_SORTS.user,
  };
}

function readSessionSorts(): SessionSortBySection {
  if (storageUnavailable) return cachedSorts;

  let value: string | null;
  try {
    value = localStorage.getItem(STORAGE_KEY);
  } catch {
    storageUnavailable = true;
    return cachedSorts;
  }
  if (value === cachedValue) return cachedSorts;

  cachedValue = value;
  cachedSorts = parseSessionSorts(value);
  return cachedSorts;
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

function saveSessionSorts(sorts: SessionSortBySection) {
  cachedValue = JSON.stringify(sorts);
  cachedSorts = sorts;
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
  const sorts = useSyncExternalStore(subscribe, readSessionSorts, () => DEFAULT_SESSION_SORTS);
  const setSort = (sort: SessionSortBySection[S]) => saveSessionSorts({ ...readSessionSorts(), [section]: sort });
  return [sorts[section], setSort];
}
