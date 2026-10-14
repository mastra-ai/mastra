import type { DropdownMenuRadioOption } from '@mastra/playground-ui/components/DropdownMenu';

import type { InstalledBoardInfo } from '../../../../api/types';
import { orderedBoards } from '../../factory/boardCatalog';
import { SESSION_STATUS_OPTIONS } from './sessionFilters';
import type { SessionListRow } from './sessionRows';

export const SESSION_GROUP_BYS = ['board', 'status', 'owner', 'none'] as const;
export type SessionGroupBy = (typeof SESSION_GROUP_BYS)[number];

export const DEFAULT_SESSION_GROUP_BY: SessionGroupBy = 'board';

const SESSION_GROUP_BY_LABELS: Record<SessionGroupBy, string> = {
  board: 'Board',
  status: 'Status',
  owner: 'Owner',
  none: 'None',
};

export const SESSION_GROUP_BY_OPTIONS: readonly DropdownMenuRadioOption<SessionGroupBy>[] = SESSION_GROUP_BYS.map(
  value => ({ value, label: SESSION_GROUP_BY_LABELS[value] }),
);

export function isSessionGroupBy(value: unknown): value is SessionGroupBy {
  return SESSION_GROUP_BYS.some(groupBy => groupBy === value);
}

export type SessionGroupIcon = 'board' | 'review' | 'user' | 'status' | 'owner' | 'all';

export interface SessionGroupHeading {
  key: string;
  label: string;
  icon: SessionGroupIcon;
}

export interface SessionGroup extends SessionGroupHeading {
  rows: SessionListRow[];
}

export const COLLAPSED_GROUP_ROW_COUNT = 5;

export interface SessionGroupContext {
  boards: readonly InstalledBoardInfo[] | undefined;
  viewerUserId: string | undefined;
}

const USER_GROUP: SessionGroupHeading = { key: 'user', label: 'User', icon: 'user' };
const ALL_GROUP: SessionGroupHeading = { key: 'all', label: 'All', icon: 'all' };

function boardGroupKey(boardId: string): string {
  return `board:${boardId}`;
}

const STATUS_GROUPS: readonly SessionGroupHeading[] = SESSION_STATUS_OPTIONS.flatMap((option): SessionGroupHeading[] =>
  option.value === 'all' ? [] : [{ key: `status:${option.value}`, label: option.label, icon: 'status' }],
);

const GROUP_KEY_OF_ROW: Record<SessionGroupBy, (row: SessionListRow) => string> = {
  board: row => (row.board === undefined ? USER_GROUP.key : boardGroupKey(row.board)),
  status: row => `status:${row.status}`,
  owner: row => `owner:${row.session.userId}`,
  none: () => ALL_GROUP.key,
};

function boardHeading(boardId: string, label: string): SessionGroupHeading {
  return { key: boardGroupKey(boardId), label, icon: boardId === 'review' ? 'review' : 'board' };
}

function uncatalogedBoardIds(rows: readonly SessionListRow[], catalogIds: ReadonlySet<string>): string[] {
  const boardIds = new Set(
    rows.flatMap(row => (row.board !== undefined && !catalogIds.has(row.board) ? [row.board] : [])),
  );
  return [...boardIds].toSorted((a, b) => a.localeCompare(b));
}

function boardGroupHeadings(
  rows: readonly SessionListRow[],
  boards: readonly InstalledBoardInfo[] | undefined,
): SessionGroupHeading[] {
  const catalog = orderedBoards(boards ?? []);
  const catalogIds = new Set(catalog.map(board => board.id));
  const uncatalogedBoards = orderedBoards(uncatalogedBoardIds(rows, catalogIds).map(id => ({ id })));
  return [
    ...catalog.map(board => boardHeading(board.id, board.title)),
    ...uncatalogedBoards.map(({ id }) => boardHeading(id, id.charAt(0).toUpperCase() + id.slice(1))),
    USER_GROUP,
  ];
}

function ownerGroupHeadings(rows: readonly SessionListRow[], viewerUserId: string | undefined): SessionGroupHeading[] {
  const ownerNameById = new Map(rows.map(row => [row.session.userId, row.owner.name]));
  return Array.from(ownerNameById, ([userId, label]) => ({ userId, label }))
    .toSorted(
      (a, b) => Number(b.userId === viewerUserId) - Number(a.userId === viewerUserId) || a.label.localeCompare(b.label),
    )
    .map(({ userId, label }) => ({ key: `owner:${userId}`, label, icon: 'owner' }));
}

// Status lists all five even when empty, so a group can be hidden before it has sessions.
export function sessionGroupOrder(
  rows: readonly SessionListRow[],
  groupBy: SessionGroupBy,
  context: SessionGroupContext,
): readonly SessionGroupHeading[] {
  switch (groupBy) {
    case 'board':
      return boardGroupHeadings(rows, context.boards);
    case 'status':
      return STATUS_GROUPS;
    case 'owner':
      return ownerGroupHeadings(rows, context.viewerUserId);
    case 'none':
      return [ALL_GROUP];
  }
}

export function groupSessionRows(
  rows: readonly SessionListRow[],
  groupBy: SessionGroupBy,
  context: SessionGroupContext,
  hiddenKeys: readonly string[],
): SessionGroup[] {
  const groupKeyOf = GROUP_KEY_OF_ROW[groupBy];
  return sessionGroupOrder(rows, groupBy, context).flatMap(heading => {
    if (hiddenKeys.includes(heading.key)) return [];
    const groupRows = rows.filter(row => groupKeyOf(row) === heading.key);
    return groupRows.length > 0 ? [{ ...heading, rows: groupRows }] : [];
  });
}

export function collapsedRowsKeepingActive(rows: readonly SessionListRow[]): SessionListRow[] {
  const visible = rows.slice(0, COLLAPSED_GROUP_ROW_COUNT);
  const open = rows.find(row => row.active);
  if (open && !visible.includes(open)) visible.push(open);
  return visible;
}
