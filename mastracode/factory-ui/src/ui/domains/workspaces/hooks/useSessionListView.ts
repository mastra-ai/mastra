import { useSyncExternalStore } from 'react';

import { DEFAULT_SESSION_GROUP_BY, SESSION_GROUP_BYS, isSessionGroupBy } from '../services/sessionGroups';
import type { SessionGroupBy } from '../services/sessionGroups';
import { DEFAULT_SESSION_SORT, isSessionSort } from '../services/sessionSort';
import type { SessionSort } from '../services/sessionSort';

const STORAGE_KEY = 'mastracode.sessionListView';
const CHANGE_EVENT = 'mastracode:session-list-view-change';

type GroupKeysByGroupBy = Partial<Record<SessionGroupBy, string[]>>;

export interface SessionListView {
  sort: SessionSort;
  groupBy: SessionGroupBy;
  hiddenGroups: GroupKeysByGroupBy;
  groupOrder: GroupKeysByGroupBy;
}

export const DEFAULT_SESSION_LIST_VIEW: SessionListView = {
  sort: DEFAULT_SESSION_SORT,
  groupBy: DEFAULT_SESSION_GROUP_BY,
  hiddenGroups: {},
  groupOrder: {},
};

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
  return keptChanges({
    ...(isSessionSort(stored.sort) && { sort: stored.sort }),
    ...(isSessionGroupBy(stored.groupBy) && { groupBy: stored.groupBy }),
    hiddenGroups: nonEmptyGroupKeys(stored.hiddenGroups),
    groupOrder: nonEmptyGroupKeys(stored.groupOrder),
  });
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

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(entry => typeof entry === 'string');
}

/** Drops empty and malformed entries; undefined when none are left, so the default view stores nothing. */
function nonEmptyGroupKeys(value: unknown): GroupKeysByGroupBy | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const stored: Partial<Record<SessionGroupBy, unknown>> = value;
  const entries = SESSION_GROUP_BYS.flatMap((groupBy): [SessionGroupBy, string[]][] => {
    const keys = stored[groupBy];
    return isNonEmptyStringArray(keys) ? [[groupBy, keys]] : [];
  });
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function keptChanges({
  hiddenGroups,
  groupOrder,
  ...rest
}: Omit<SessionListViewChanges, 'hiddenGroups' | 'groupOrder'> & {
  hiddenGroups: GroupKeysByGroupBy | undefined;
  groupOrder: GroupKeysByGroupBy | undefined;
}): SessionListViewChanges {
  return { ...rest, ...(hiddenGroups && { hiddenGroups }), ...(groupOrder && { groupOrder }) };
}

function changesFromDefault(view: SessionListView): SessionListViewChanges {
  return keptChanges({
    ...(view.sort !== DEFAULT_SESSION_LIST_VIEW.sort && { sort: view.sort }),
    ...(view.groupBy !== DEFAULT_SESSION_LIST_VIEW.groupBy && { groupBy: view.groupBy }),
    hiddenGroups: nonEmptyGroupKeys(view.hiddenGroups),
    groupOrder: nonEmptyGroupKeys(view.groupOrder),
  });
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
