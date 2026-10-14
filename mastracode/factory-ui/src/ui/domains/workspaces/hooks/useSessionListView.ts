import { createLocalStorageStore, useLocalStorageStore } from '@mastra/playground-ui/hooks/use-local-storage-store';

import { DEFAULT_SESSION_SORT, isSessionSort } from '../services/sessionSort';
import type { SessionSort } from '../services/sessionSort';

export interface SessionListView {
  sort: SessionSort;
}

export const DEFAULT_SESSION_LIST_VIEW: SessionListView = { sort: DEFAULT_SESSION_SORT };

type SessionListViewChanges = Partial<SessionListView>;
const NO_CHANGES: SessionListViewChanges = {};

function parseViewChanges(parsed: unknown): SessionListViewChanges {
  if (typeof parsed !== 'object' || parsed === null) return NO_CHANGES;
  const stored: Partial<Record<keyof SessionListView, unknown>> = parsed;
  return { ...(isSessionSort(stored.sort) && { sort: stored.sort }) };
}

function changesFromDefault(view: SessionListView): SessionListViewChanges {
  return { ...(view.sort !== DEFAULT_SESSION_LIST_VIEW.sort && { sort: view.sort }) };
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
