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

function parseHiddenGroups(value: unknown): HiddenSessionGroups | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const hiddenGroups: HiddenSessionGroups = {};
  for (const groupBy of SESSION_GROUP_BYS) {
    const keys: unknown = groupBy in value ? Reflect.get(value, groupBy) : undefined;
    if (isNonEmptyStringArray(keys)) hiddenGroups[groupBy] = keys;
  }
  return Object.keys(hiddenGroups).length > 0 ? hiddenGroups : undefined;
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(entry => typeof entry === 'string');
}

function parseViewChanges(stored: unknown): SessionListViewChanges {
  if (typeof stored !== 'object' || stored === null) throw new Error('Stored session list view is not an object');
  const changes: SessionListViewChanges = {};
  if ('sort' in stored && isSessionSort(stored.sort)) changes.sort = stored.sort;
  if ('groupBy' in stored && isSessionGroupBy(stored.groupBy)) changes.groupBy = stored.groupBy;
  const hiddenGroups = 'hiddenGroups' in stored ? parseHiddenGroups(stored.hiddenGroups) : undefined;
  if (hiddenGroups !== undefined) changes.hiddenGroups = hiddenGroups;
  return changes;
}

function withGroupVisibility(hidden: readonly string[], key: string, visible: boolean): string[] {
  if (visible) return hidden.filter(hiddenKey => hiddenKey !== key);
  if (hidden.includes(key)) return [...hidden];
  return [...hidden, key];
}

function hasHiddenGroups(hiddenGroups: HiddenSessionGroups): boolean {
  return Object.values(hiddenGroups).some(keys => keys.length > 0);
}

function changesFromDefault(view: SessionListView): SessionListViewChanges {
  const changes: SessionListViewChanges = {};
  if (view.sort !== DEFAULT_SESSION_LIST_VIEW.sort) changes.sort = view.sort;
  if (view.groupBy !== DEFAULT_SESSION_LIST_VIEW.groupBy) changes.groupBy = view.groupBy;
  if (hasHiddenGroups(view.hiddenGroups)) changes.hiddenGroups = view.hiddenGroups;
  return changes;
}

const sessionListViewStore = createLocalStorageStore<SessionListViewChanges>({
  key: 'mastracode.sessionListView',
  defaultValue: NO_CHANGES,
  parse: parseViewChanges,
});

function currentView(): SessionListView {
  return { ...DEFAULT_SESSION_LIST_VIEW, ...sessionListViewStore.read() };
}

function writeView(view: SessionListView): void {
  sessionListViewStore.write(changesFromDefault(view));
}

function changeGroupVisibility(key: string, visible: boolean): void {
  const view = currentView();
  const hiddenGroups: HiddenSessionGroups = { ...view.hiddenGroups };
  const hiddenKeys = withGroupVisibility(hiddenGroups[view.groupBy] ?? [], key, visible);
  if (hiddenKeys.length > 0) hiddenGroups[view.groupBy] = hiddenKeys;
  else delete hiddenGroups[view.groupBy];
  writeView({ ...view, hiddenGroups });
}

export function useSessionListView(): {
  view: SessionListView;
  hiddenGroupKeys: readonly string[];
  changedSettingCount: number;
  updateView: (changes: Partial<Pick<SessionListView, 'sort' | 'groupBy'>>) => void;
  changeGroupVisibility: (key: string, visible: boolean) => void;
  resetView: () => void;
} {
  const changes = useLocalStorageStore(sessionListViewStore);
  const view = { ...DEFAULT_SESSION_LIST_VIEW, ...changes };
  return {
    view,
    hiddenGroupKeys: view.hiddenGroups[view.groupBy] ?? [],
    changedSettingCount: Object.keys(changesFromDefault(view)).length,
    updateView: next => writeView({ ...currentView(), ...next }),
    changeGroupVisibility,
    resetView: () => sessionListViewStore.write(NO_CHANGES),
  };
}
