import { createLocalStorageStore, useLocalStorageStore } from '@mastra/playground-ui/hooks/use-local-storage-store';
import { z } from 'zod';

import { DEFAULT_SESSION_GROUP_BY, SESSION_GROUP_BYS, customGroupOrder } from '../services/sessionGroups';
import type { SessionGroupBy, SessionGroupHeading } from '../services/sessionGroups';
import { DEFAULT_SESSION_SORT, SESSION_SORTS } from '../services/sessionSort';
import type { SessionSort } from '../services/sessionSort';

type GroupKeysByGroupBy = Partial<Record<SessionGroupBy, string[]>>;

export interface SessionListView {
  sort: SessionSort;
  groupBy: SessionGroupBy;
  hiddenGroups: GroupKeysByGroupBy;
  groupOrder: GroupKeysByGroupBy;
  /** One line per session; off adds a second line with when it was updated and its pull request. */
  compact: boolean;
  /** A card's other sessions listed under its row, by the phase they ran in. */
  revealChildSessions: boolean;
}

export const DEFAULT_SESSION_LIST_VIEW: SessionListView = {
  sort: DEFAULT_SESSION_SORT,
  groupBy: DEFAULT_SESSION_GROUP_BY,
  hiddenGroups: {},
  groupOrder: {},
  compact: true,
  revealChildSessions: false,
};

// A malformed group list is dropped on its own, keeping the other groupings' lists.
const groupKeysSchema = z.array(z.string()).min(1).optional().catch(undefined);
const groupKeysByGroupBySchema = z
  .object({ board: groupKeysSchema, status: groupKeysSchema, owner: groupKeysSchema, none: groupKeysSchema })
  .catch({})
  .transform(groupKeys => {
    const kept: GroupKeysByGroupBy = {};
    for (const groupBy of SESSION_GROUP_BYS) {
      const keys = groupKeys[groupBy];
      if (keys) kept[groupBy] = keys;
    }
    return kept;
  });

// Each setting falls back to its default on its own, so one stale value doesn't reset the rest.
const sessionListViewSchema: z.ZodType<SessionListView> = z.object({
  sort: z.enum(SESSION_SORTS).catch(DEFAULT_SESSION_LIST_VIEW.sort),
  groupBy: z.enum(SESSION_GROUP_BYS).catch(DEFAULT_SESSION_LIST_VIEW.groupBy),
  hiddenGroups: groupKeysByGroupBySchema,
  groupOrder: groupKeysByGroupBySchema,
  compact: z.boolean().catch(DEFAULT_SESSION_LIST_VIEW.compact),
  revealChildSessions: z.boolean().catch(DEFAULT_SESSION_LIST_VIEW.revealChildSessions),
});

function hasGroupKeys(groupKeys: GroupKeysByGroupBy): boolean {
  return Object.values(groupKeys).some(keys => keys.length > 0);
}

function withGroupVisibility(hidden: readonly string[], key: string, visible: boolean): string[] {
  if (visible) return hidden.filter(hiddenKey => hiddenKey !== key);
  if (hidden.includes(key)) return [...hidden];
  return [...hidden, key];
}

function changesFromDefault(view: SessionListView): Partial<SessionListView> {
  const changes: Partial<SessionListView> = {};
  if (view.sort !== DEFAULT_SESSION_LIST_VIEW.sort) changes.sort = view.sort;
  if (view.groupBy !== DEFAULT_SESSION_LIST_VIEW.groupBy) changes.groupBy = view.groupBy;
  if (hasGroupKeys(view.hiddenGroups)) changes.hiddenGroups = view.hiddenGroups;
  if (hasGroupKeys(view.groupOrder)) changes.groupOrder = view.groupOrder;
  if (view.compact !== DEFAULT_SESSION_LIST_VIEW.compact) changes.compact = view.compact;
  if (view.revealChildSessions !== DEFAULT_SESSION_LIST_VIEW.revealChildSessions) {
    changes.revealChildSessions = view.revealChildSessions;
  }
  return changes;
}

/** Only settings that differ from the default are stored, so a changed default reaches everyone who kept it. */
const sessionListViewStore = createLocalStorageStore<SessionListView>({
  key: 'mastracode.sessionListView',
  defaultValue: DEFAULT_SESSION_LIST_VIEW,
  parse: stored => sessionListViewSchema.parse(stored),
  toJSON: changesFromDefault,
});

function changeGroupVisibility(key: string, visible: boolean): void {
  const view = sessionListViewStore.read();
  const hiddenGroups: GroupKeysByGroupBy = { ...view.hiddenGroups };
  const hiddenKeys = withGroupVisibility(hiddenGroups[view.groupBy] ?? [], key, visible);
  if (hiddenKeys.length > 0) hiddenGroups[view.groupBy] = hiddenKeys;
  else delete hiddenGroups[view.groupBy];
  sessionListViewStore.write({ ...view, hiddenGroups });
}

function changeGroupOrder(keys: readonly string[], defaultHeadings: readonly SessionGroupHeading[]): void {
  const view = sessionListViewStore.read();
  const groupOrder: GroupKeysByGroupBy = { ...view.groupOrder };
  const orderKeys = customGroupOrder(keys, defaultHeadings);
  if (orderKeys.length > 0) groupOrder[view.groupBy] = orderKeys;
  else delete groupOrder[view.groupBy];
  sessionListViewStore.write({ ...view, groupOrder });
}

export function useSessionListView(): {
  view: SessionListView;
  hiddenGroupKeys: readonly string[];
  groupOrderKeys: readonly string[];
  changedSettingCount: number;
  updateView: (changes: Partial<Pick<SessionListView, 'sort' | 'groupBy' | 'compact' | 'revealChildSessions'>>) => void;
  changeGroupVisibility: (key: string, visible: boolean) => void;
  changeGroupOrder: (keys: readonly string[], defaultHeadings: readonly SessionGroupHeading[]) => void;
  resetView: () => void;
} {
  const view = useLocalStorageStore(sessionListViewStore);
  return {
    view,
    hiddenGroupKeys: view.hiddenGroups[view.groupBy] ?? [],
    groupOrderKeys: view.groupOrder[view.groupBy] ?? [],
    changedSettingCount: Object.keys(changesFromDefault(view)).length,
    updateView: next => sessionListViewStore.write({ ...sessionListViewStore.read(), ...next }),
    changeGroupVisibility,
    changeGroupOrder,
    resetView: () => sessionListViewStore.write(DEFAULT_SESSION_LIST_VIEW),
  };
}
