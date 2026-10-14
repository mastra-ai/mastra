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

export interface SessionGroupContext {
  boards: readonly InstalledBoardInfo[] | undefined;
  viewerUserId: string | undefined;
}

const USER_GROUP: SessionGroupHeading = { key: 'user', label: 'User', icon: 'user' };
const ALL_GROUP: SessionGroupHeading = { key: 'all', label: 'All', icon: 'all' };
const BUILTIN_BOARD_ORDER = ['work', 'review'];

const STATUS_GROUPS: readonly SessionGroupHeading[] = SESSION_STATUS_OPTIONS.flatMap((option): SessionGroupHeading[] =>
  option.value === 'all' ? [] : [{ key: `status:${option.value}`, label: option.label, icon: 'status' }],
);

const GROUP_KEY_OF_ROW: Record<SessionGroupBy, (row: SessionListRow) => string> = {
  board: row => (row.board === undefined ? USER_GROUP.key : `board:${row.board}`),
  status: row => `status:${row.status}`,
  owner: row => `owner:${row.session.userId}`,
  none: () => ALL_GROUP.key,
};

function boardHeading(boardId: string, label: string): SessionGroupHeading {
  return { key: `board:${boardId}`, label, icon: boardId === 'review' ? 'review' : 'board' };
}

function builtinBoardRank(boardId: string): number {
  const rank = BUILTIN_BOARD_ORDER.indexOf(boardId);
  return rank === -1 ? BUILTIN_BOARD_ORDER.length : rank;
}

/** Catalog boards in sidebar order, then boards only the rows know of (catalog pending or uninstalled), then User. */
function boardGroupHeadings(
  rows: readonly SessionListRow[],
  boards: readonly InstalledBoardInfo[] | undefined,
): SessionGroupHeading[] {
  const catalog = orderedBoards(boards ?? []);
  const catalogIds = new Set(catalog.map(board => board.id));
  const uncatalogedIds = [
    ...new Set(rows.flatMap(row => (row.board !== undefined && !catalogIds.has(row.board) ? [row.board] : []))),
  ].toSorted((a, b) => builtinBoardRank(a) - builtinBoardRank(b) || a.localeCompare(b));
  return [
    ...catalog.map(board => boardHeading(board.id, board.title)),
    ...uncatalogedIds.map(boardId => boardHeading(boardId, boardId.charAt(0).toUpperCase() + boardId.slice(1))),
    USER_GROUP,
  ];
}

function ownerGroupHeadings(rows: readonly SessionListRow[], viewerUserId: string | undefined): SessionGroupHeading[] {
  const ownerNameById = new Map(rows.map(row => [row.session.userId, row.ownerName]));
  return Array.from(ownerNameById, ([userId, label]) => ({ userId, label }))
    .toSorted(
      (a, b) => Number(b.userId === viewerUserId) - Number(a.userId === viewerUserId) || a.label.localeCompare(b.label),
    )
    .map(({ userId, label }) => ({ key: `owner:${userId}`, label, icon: 'owner' }));
}

/** Default group order for these rows; Status always lists all five, so an empty one can still be hidden. */
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

/** Rows keep their incoming order inside each group; hidden and empty groups are left out. */
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
