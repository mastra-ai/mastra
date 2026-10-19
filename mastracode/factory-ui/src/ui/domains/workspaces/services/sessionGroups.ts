import type { DropdownMenuRadioOption } from '@mastra/playground-ui/components/DropdownMenu';

import type { InstalledBoardInfo } from '../../../../api/types';
import { orderedBoards } from '../../factory/boardCatalog';
import { SESSION_ACTIVITY_STATUSES, SESSION_STATUS_LABELS, sessionOwners } from './sessionRows';
import type { SessionActivityStatus, SessionListRow } from './sessionRows';
import { SLACK_SESSION_BRANCH_PREFIX } from './user-sessions';

export const SESSION_GROUP_BYS = ['board', 'status', 'owner', 'none'] as const;
export type SessionGroupBy = (typeof SESSION_GROUP_BYS)[number];

export const DEFAULT_SESSION_GROUP_BY: SessionGroupBy = 'board';

export const SESSION_GROUP_BY_LABELS: Record<SessionGroupBy, string> = {
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

export type SessionGroupIcon = 'board' | 'review' | 'user' | 'slack' | 'status' | 'owner' | 'all';

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
const SLACK_GROUP: SessionGroupHeading = { key: 'slack', label: 'Slack', icon: 'slack' };
const ALL_GROUP: SessionGroupHeading = { key: 'all', label: 'All', icon: 'all' };

function boardGroupKey(boardId: string): string {
  return `board:${boardId}`;
}

function statusGroupKey(status: SessionActivityStatus): string {
  return `status:${status}`;
}

function ownerGroupKey(userId: string): string {
  return `owner:${userId}`;
}

const STATUS_GROUPS: readonly SessionGroupHeading[] = SESSION_ACTIVITY_STATUSES.map(status => ({
  key: statusGroupKey(status),
  label: SESSION_STATUS_LABELS[status],
  icon: 'status',
}));

const GROUP_KEY_OF_ROW: Record<SessionGroupBy, (row: SessionListRow) => string> = {
  board: row =>
    row.session.branch.startsWith(SLACK_SESSION_BRANCH_PREFIX)
      ? SLACK_GROUP.key
      : row.board === undefined
        ? USER_GROUP.key
        : boardGroupKey(row.board),
  status: row => statusGroupKey(row.status),
  owner: row => ownerGroupKey(row.session.userId),
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
    SLACK_GROUP,
  ];
}

function ownerGroupHeadings(rows: readonly SessionListRow[], viewerUserId: string | undefined): SessionGroupHeading[] {
  return sessionOwners(rows)
    .toSorted((a, b) => Number(b.userId === viewerUserId) - Number(a.userId === viewerUserId))
    .map(({ userId, name }) => ({ key: ownerGroupKey(userId), label: name, icon: 'owner' }));
}

export function sessionGroupHeadings(
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

export function orderGroupHeadings(
  defaults: readonly SessionGroupHeading[],
  storedKeys: readonly string[],
): readonly SessionGroupHeading[] {
  const rankOf = (heading: SessionGroupHeading) => {
    const index = storedKeys.indexOf(heading.key);
    return index === -1 ? storedKeys.length : index;
  };
  return defaults.toSorted((a, b) => rankOf(a) - rankOf(b));
}

export function customGroupOrder(keys: readonly string[], defaultHeadings: readonly SessionGroupHeading[]): string[] {
  const isDefaultOrder = defaultHeadings.every((heading, index) => heading.key === keys[index]);
  return isDefaultOrder ? [] : [...keys];
}

export function groupSessionRows(
  rows: readonly SessionListRow[],
  groupBy: SessionGroupBy,
  headings: readonly SessionGroupHeading[],
  hiddenKeys: readonly string[],
): SessionGroup[] {
  const groupKeyOf = GROUP_KEY_OF_ROW[groupBy];
  return headings.flatMap(heading => {
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
