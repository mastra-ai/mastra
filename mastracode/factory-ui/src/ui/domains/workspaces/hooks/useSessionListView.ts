import { createLocalStorageStore, useLocalStorageStore } from '@mastra/playground-ui/hooks/use-local-storage-store';

import { DEFAULT_SESSION_SORT, isSessionSort } from '../services/sessionSort';
import type { SessionSort } from '../services/sessionSort';

export interface SessionListView {
  sort: SessionSort;
}

export const DEFAULT_SESSION_LIST_VIEW: SessionListView = { sort: DEFAULT_SESSION_SORT };

type SessionListViewChanges = Partial<SessionListView>;
const NO_CHANGES: SessionListViewChanges = {};

function parseViewChanges(stored: unknown): SessionListViewChanges {
  if (typeof stored !== 'object' || stored === null) throw new Error('Stored session list view is not an object');
  const changes: SessionListViewChanges = {};
  if ('sort' in stored && isSessionSort(stored.sort)) changes.sort = stored.sort;
  return changes;
}

function changesFromDefault(view: SessionListView): SessionListViewChanges {
  const changes: SessionListViewChanges = {};
  if (view.sort !== DEFAULT_SESSION_LIST_VIEW.sort) changes.sort = view.sort;
  return changes;
}

const sessionListViewStore = createLocalStorageStore<SessionListViewChanges>({
  key: 'mastracode.sessionListView',
  defaultValue: NO_CHANGES,
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
