import { createLocalStorageStore, useLocalStorageStore } from '@mastra/playground-ui/hooks/use-local-storage-store';

import { DEFAULT_SESSION_GROUP_BY, SESSION_GROUP_BYS, isSessionGroupBy } from '../services/sessionGroups';
import type { SessionGroupBy } from '../services/sessionGroups';
import { DEFAULT_SESSION_SORT, isSessionSort } from '../services/sessionSort';
import type { SessionSort } from '../services/sessionSort';

type HiddenSessionGroups = Partial<Record<SessionGroupBy, string[]>>;

export interface SessionListView {
  sort: SessionSort;
  groupBy: SessionGroupBy;
  hiddenGroups: HiddenSessionGroups;
}

export const DEFAULT_SESSION_LIST_VIEW: SessionListView = {
  sort: DEFAULT_SESSION_SORT,
  groupBy: DEFAULT_SESSION_GROUP_BY,
  hiddenGroups: {},
};

type SessionListViewChanges = Partial<SessionListView>;
const NO_CHANGES: SessionListViewChanges = {};

function parseViewChanges(parsed: unknown): SessionListViewChanges {
  if (typeof parsed !== 'object' || parsed === null) return NO_CHANGES;
  const stored: Partial<Record<keyof SessionListView, unknown>> = parsed;
  const hiddenGroups =
    typeof stored.hiddenGroups === 'object' && stored.hiddenGroups !== null
      ? nonEmptyHiddenGroups(stored.hiddenGroups)
      : undefined;
  return {
    ...(isSessionSort(stored.sort) && { sort: stored.sort }),
    ...(isSessionGroupBy(stored.groupBy) && { groupBy: stored.groupBy }),
    ...(hiddenGroups && { hiddenGroups }),
  };
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(entry => typeof entry === 'string');
}

function nonEmptyHiddenGroups(hiddenGroups: Partial<Record<SessionGroupBy, unknown>>): HiddenSessionGroups | undefined {
  const entries = SESSION_GROUP_BYS.flatMap((groupBy): [SessionGroupBy, string[]][] => {
    const keys = hiddenGroups[groupBy];
    return isNonEmptyStringArray(keys) ? [[groupBy, keys]] : [];
  });
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function changesFromDefault(view: SessionListView): SessionListViewChanges {
  const hiddenGroups = nonEmptyHiddenGroups(view.hiddenGroups);
  return {
    ...(view.sort !== DEFAULT_SESSION_LIST_VIEW.sort && { sort: view.sort }),
    ...(view.groupBy !== DEFAULT_SESSION_LIST_VIEW.groupBy && { groupBy: view.groupBy }),
    ...(hiddenGroups && { hiddenGroups }),
  };
}

const sessionListViewStore = createLocalStorageStore<SessionListViewChanges>({
  key: 'mastracode.sessionListView',
  empty: NO_CHANGES,
  parse: parseViewChanges,
});

export function useSessionListView(): {
  view: SessionListView;
  changedSettingCount: number;
  updateView: (changes: Partial<SessionListView>) => void;
  resetView: () => void;
} {
  const changes = useLocalStorageStore(sessionListViewStore);
  return {
    view: { ...DEFAULT_SESSION_LIST_VIEW, ...changes },
    changedSettingCount: Object.keys(changes).length,
    updateView: next =>
      sessionListViewStore.write(
        changesFromDefault({ ...DEFAULT_SESSION_LIST_VIEW, ...sessionListViewStore.read(), ...next }),
      ),
    resetView: () => sessionListViewStore.write(NO_CHANGES),
  };
}
