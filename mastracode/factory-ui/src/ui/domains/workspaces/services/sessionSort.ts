import type { DropdownMenuRadioOption } from '@mastra/playground-ui/components/DropdownMenu';

import type { SessionActivityStatus, SessionListRow } from './sessionRows';

export const SESSION_SORTS = ['activity', 'updated', 'created'] as const;
export type SessionSort = (typeof SESSION_SORTS)[number];

export const DEFAULT_SESSION_SORT: SessionSort = 'activity';

const SESSION_SORT_LABELS: Record<SessionSort, string> = {
  activity: 'Activity',
  updated: 'Last updated',
  created: 'Last created',
};

export const SESSION_SORT_OPTIONS: readonly DropdownMenuRadioOption<SessionSort>[] = SESSION_SORTS.map(value => ({
  value,
  label: SESSION_SORT_LABELS[value],
}));

export function isSessionSort(value: unknown): value is SessionSort {
  return SESSION_SORTS.some(sort => sort === value);
}

const ACTIVITY_RANK: Record<SessionActivityStatus, number> = {
  initializing: 0,
  working: 0,
  waiting: 0,
  idle: 1,
  done: 2,
};

const SESSION_ROW_ORDER: Record<SessionSort, (a: SessionListRow, b: SessionListRow) => number> = {
  activity: (a, b) => ACTIVITY_RANK[a.status] - ACTIVITY_RANK[b.status] || b.createdAt.localeCompare(a.createdAt),
  updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  created: (a, b) => b.createdAt.localeCompare(a.createdAt),
};

export function compareSessionRows(sort: SessionSort) {
  const bySort = SESSION_ROW_ORDER[sort];
  return (a: SessionListRow, b: SessionListRow) =>
    Number(b.pinned) - Number(a.pinned) || bySort(a, b) || b.session.sessionId.localeCompare(a.session.sessionId);
}
