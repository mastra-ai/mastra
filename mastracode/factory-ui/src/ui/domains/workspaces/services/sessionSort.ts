import type { DropdownMenuRadioOption } from '@mastra/playground-ui/components/DropdownMenu';

import type { FactoryUserSession } from './user-sessions';

export const WORKSPACE_SESSION_SORTS = ['activity', 'updated', 'created'] as const;
export type WorkspaceSessionSort = (typeof WORKSPACE_SESSION_SORTS)[number];
export const USER_SESSION_SORTS = ['updated', 'created'] as const;
export type UserSessionSort = (typeof USER_SESSION_SORTS)[number];

export const DEFAULT_WORKSPACE_SESSION_SORT: WorkspaceSessionSort = 'activity';
export const DEFAULT_USER_SESSION_SORT: UserSessionSort = 'updated';

const SESSION_SORT_LABELS: Record<WorkspaceSessionSort | UserSessionSort, string> = {
  activity: 'Activity',
  updated: 'Last updated',
  created: 'Last created',
};

export const WORKSPACE_SESSION_SORT_OPTIONS: readonly DropdownMenuRadioOption<WorkspaceSessionSort>[] =
  WORKSPACE_SESSION_SORTS.map(value => ({ value, label: SESSION_SORT_LABELS[value] }));

export const USER_SESSION_SORT_OPTIONS: readonly DropdownMenuRadioOption<UserSessionSort>[] = USER_SESSION_SORTS.map(
  value => ({ value, label: SESSION_SORT_LABELS[value] }),
);

export function isWorkspaceSessionSort(value: unknown): value is WorkspaceSessionSort {
  return WORKSPACE_SESSION_SORTS.some(sort => sort === value);
}

export function isUserSessionSort(value: unknown): value is UserSessionSort {
  return USER_SESSION_SORTS.some(sort => sort === value);
}

export interface SortableWorkspaceRow {
  pinned: boolean;
  initializing: boolean;
  running: boolean;
  attention: boolean;
  settled: boolean;
  createdAt: string;
  updatedAt: string;
  workspace: { sessionId: string };
}

function watchRank(row: SortableWorkspaceRow): number {
  if (row.initializing || row.running || row.attention) return 0;
  return row.settled ? 2 : 1;
}

const WORKSPACE_ROW_ORDER: Record<WorkspaceSessionSort, (a: SortableWorkspaceRow, b: SortableWorkspaceRow) => number> =
  {
    activity: (a, b) => watchRank(a) - watchRank(b) || b.createdAt.localeCompare(a.createdAt),
    updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
    created: (a, b) => b.createdAt.localeCompare(a.createdAt),
  };

export function compareWorkspaceRows(sort: WorkspaceSessionSort) {
  const bySort = WORKSPACE_ROW_ORDER[sort];
  return (a: SortableWorkspaceRow, b: SortableWorkspaceRow) =>
    Number(b.pinned) - Number(a.pinned) || bySort(a, b) || b.workspace.sessionId.localeCompare(a.workspace.sessionId);
}

const USER_SESSION_ORDER: Record<UserSessionSort, (a: FactoryUserSession, b: FactoryUserSession) => number> = {
  updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  created: (a, b) => b.createdAt.localeCompare(a.createdAt),
};

export function compareUserSessions(sort: UserSessionSort, pinnedSessions: ReadonlySet<string>) {
  const bySort = USER_SESSION_ORDER[sort];
  return (a: FactoryUserSession, b: FactoryUserSession) =>
    Number(pinnedSessions.has(b.sessionId)) - Number(pinnedSessions.has(a.sessionId)) ||
    bySort(a, b) ||
    b.sessionId.localeCompare(a.sessionId);
}
