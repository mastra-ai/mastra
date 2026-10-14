import { createLocalStorageStore, useLocalStorageStore } from '@mastra/playground-ui/hooks/use-local-storage-store';

import { DEFAULT_SESSION_GROUP_BY, SESSION_GROUP_BYS, isSessionGroupBy } from '../services/sessionGroups';
import type { SessionGroupBy } from '../services/sessionGroups';
import { DEFAULT_SESSION_SORT, isSessionSort } from '../services/sessionSort';
import type { SessionSort } from '../services/sessionSort';

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

function parseViewChanges(parsed: unknown): SessionListViewChanges {
  if (typeof parsed !== 'object' || parsed === null) return NO_CHANGES;
  const stored: Partial<Record<keyof SessionListView, unknown>> = parsed;
  return keptChanges({
    ...(isSessionSort(stored.sort) && { sort: stored.sort }),
    ...(isSessionGroupBy(stored.groupBy) && { groupBy: stored.groupBy }),
    hiddenGroups: nonEmptyGroupKeys(stored.hiddenGroups),
    groupOrder: nonEmptyGroupKeys(stored.groupOrder),
  });
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(entry => typeof entry === 'string');
}

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

const sessionListViewStore = createLocalStorageStore<SessionListViewChanges>({
  key: 'mastracode.sessionListView',
  empty: NO_CHANGES,
  parse: parseViewChanges,
});

export function useSessionListView(): {
  view: SessionListView;
  updateView: (changes: Partial<SessionListView>) => void;
  resetView: () => void;
} {
  const changes = useLocalStorageStore(sessionListViewStore);
  return {
    view: { ...DEFAULT_SESSION_LIST_VIEW, ...changes },
    updateView: next =>
      sessionListViewStore.write(
        changesFromDefault({ ...DEFAULT_SESSION_LIST_VIEW, ...sessionListViewStore.read(), ...next }),
      ),
    resetView: () => sessionListViewStore.write(NO_CHANGES),
  };
}
