import { createLocalStorageStore, useLocalStorageStore } from '@mastra/playground-ui/hooks/use-local-storage-store';

import {
  DEFAULT_SESSION_GROUP_BY,
  SESSION_GROUP_BYS,
  customGroupOrder,
  isSessionGroupBy,
} from '../services/sessionGroups';
import type { SessionGroupBy, SessionGroupHeading } from '../services/sessionGroups';
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

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(entry => typeof entry === 'string');
}

function parseGroupKeysByGroupBy(value: unknown): GroupKeysByGroupBy {
  const groupKeys: GroupKeysByGroupBy = {};
  if (typeof value !== 'object' || value === null) return groupKeys;
  for (const groupBy of SESSION_GROUP_BYS) {
    const keys: unknown = groupBy in value ? Reflect.get(value, groupBy) : undefined;
    if (isNonEmptyStringArray(keys)) groupKeys[groupBy] = keys;
  }
  return groupKeys;
}

function hasGroupKeys(groupKeys: GroupKeysByGroupBy): boolean {
  return Object.values(groupKeys).some(keys => keys.length > 0);
}

function parseViewChanges(stored: unknown): SessionListViewChanges {
  if (typeof stored !== 'object' || stored === null) throw new Error('Stored session list view is not an object');
  const changes: SessionListViewChanges = {};
  if ('sort' in stored && isSessionSort(stored.sort)) changes.sort = stored.sort;
  if ('groupBy' in stored && isSessionGroupBy(stored.groupBy)) changes.groupBy = stored.groupBy;
  const hiddenGroups = parseGroupKeysByGroupBy('hiddenGroups' in stored ? stored.hiddenGroups : undefined);
  if (hasGroupKeys(hiddenGroups)) changes.hiddenGroups = hiddenGroups;
  const groupOrder = parseGroupKeysByGroupBy('groupOrder' in stored ? stored.groupOrder : undefined);
  if (hasGroupKeys(groupOrder)) changes.groupOrder = groupOrder;
  return changes;
}

function withGroupVisibility(hidden: readonly string[], key: string, visible: boolean): string[] {
  if (visible) return hidden.filter(hiddenKey => hiddenKey !== key);
  if (hidden.includes(key)) return [...hidden];
  return [...hidden, key];
}

function changesFromDefault(view: SessionListView): SessionListViewChanges {
  const changes: SessionListViewChanges = {};
  if (view.sort !== DEFAULT_SESSION_LIST_VIEW.sort) changes.sort = view.sort;
  if (view.groupBy !== DEFAULT_SESSION_LIST_VIEW.groupBy) changes.groupBy = view.groupBy;
  if (hasGroupKeys(view.hiddenGroups)) changes.hiddenGroups = view.hiddenGroups;
  if (hasGroupKeys(view.groupOrder)) changes.groupOrder = view.groupOrder;
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
  const hiddenGroups: GroupKeysByGroupBy = { ...view.hiddenGroups };
  const hiddenKeys = withGroupVisibility(hiddenGroups[view.groupBy] ?? [], key, visible);
  if (hiddenKeys.length > 0) hiddenGroups[view.groupBy] = hiddenKeys;
  else delete hiddenGroups[view.groupBy];
  writeView({ ...view, hiddenGroups });
}

function changeGroupOrder(keys: readonly string[], defaultHeadings: readonly SessionGroupHeading[]): void {
  const view = currentView();
  const groupOrder: GroupKeysByGroupBy = { ...view.groupOrder };
  const orderKeys = customGroupOrder(keys, defaultHeadings);
  if (orderKeys.length > 0) groupOrder[view.groupBy] = orderKeys;
  else delete groupOrder[view.groupBy];
  writeView({ ...view, groupOrder });
}

export function useSessionListView(): {
  view: SessionListView;
  hiddenGroupKeys: readonly string[];
  groupOrderKeys: readonly string[];
  changedSettingCount: number;
  updateView: (changes: Partial<Pick<SessionListView, 'sort' | 'groupBy'>>) => void;
  changeGroupVisibility: (key: string, visible: boolean) => void;
  changeGroupOrder: (keys: readonly string[], defaultHeadings: readonly SessionGroupHeading[]) => void;
  resetView: () => void;
} {
  const changes = useLocalStorageStore(sessionListViewStore);
  const view = { ...DEFAULT_SESSION_LIST_VIEW, ...changes };
  return {
    view,
    hiddenGroupKeys: view.hiddenGroups[view.groupBy] ?? [],
    groupOrderKeys: view.groupOrder[view.groupBy] ?? [],
    changedSettingCount: Object.keys(changesFromDefault(view)).length,
    updateView: next => writeView({ ...currentView(), ...next }),
    changeGroupVisibility,
    changeGroupOrder,
    resetView: () => sessionListViewStore.write(NO_CHANGES),
  };
}
