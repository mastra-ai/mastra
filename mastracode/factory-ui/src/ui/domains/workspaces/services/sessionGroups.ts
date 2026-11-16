import type { DropdownMenuRadioOption } from '@mastra/playground-ui/components/DropdownMenu';

import type { InstalledBoardInfo } from '../../../../api/types';
import { orderedBoards } from '../../factory/boardCatalog';
import { SESSION_ACTIVITY_STATUSES, SESSION_STATUS_LABELS } from './sessionRows';
import type { SessionListRow, SessionOwner } from './sessionRows';

export const SESSION_GROUP_BYS = ['board', 'status', 'owner', 'none'] as const;
export type SessionGroupBy = (typeof SESSION_GROUP_BYS)[number];

export const DEFAULT_SESSION_GROUP_BY: SessionGroupBy = 'none';

export const SESSION_GROUP_BY_LABELS: Record<SessionGroupBy, string> = {
  board: 'Board',
  status: 'Status',
  owner: 'Owner',
  none: 'None',
};

export const SESSION_GROUP_BY_OPTIONS: readonly DropdownMenuRadioOption<SessionGroupBy>[] = SESSION_GROUP_BYS.map(
  value => ({ value, label: SESSION_GROUP_BY_LABELS[value] }),
);

export type SessionGroupIcon = 'board' | 'review' | 'user' | 'slack' | 'status' | 'owner' | 'all';

/** Keyed as the server keys the groups it answers. */
export interface SessionGroupHeading {
  key: string;
  label: string;
  icon: SessionGroupIcon;
}

/** How many rows the server lists of a group it is asked no window for (its `SESSION_ROW_WINDOW`). */
export const SESSION_GROUP_WINDOW = 5;
export const SESSION_GROUP_INCREMENT = 20;

export interface SessionGroup extends SessionGroupHeading {
  /** Rows of the group that match the filters, listed or not. */
  total: number;
  /** Where the open session sits in the group, however deep. */
  openIndex?: number;
  rows: readonly SessionListRow[];
}

export interface SessionGroupContext {
  catalog: readonly InstalledBoardInfo[] | undefined;
  /** Every board some session sits on. */
  boardIds: readonly string[];
  owners: readonly SessionOwner[];
  viewerUserId: string | undefined;
}

const USER_GROUP: SessionGroupHeading = { key: 'user', label: 'User', icon: 'user' };
const SLACK_GROUP: SessionGroupHeading = { key: 'slack', label: 'Slack', icon: 'slack' };
const ALL_GROUP: SessionGroupHeading = { key: 'all', label: 'All', icon: 'all' };

const STATUS_GROUPS: readonly SessionGroupHeading[] = SESSION_ACTIVITY_STATUSES.map(status => ({
  key: `status:${status}`,
  label: SESSION_STATUS_LABELS[status],
  icon: 'status',
}));

function boardHeading(boardId: string, label: string): SessionGroupHeading {
  return { key: `board:${boardId}`, label, icon: 'board' };
}

function boardGroupHeadings(
  catalog: readonly InstalledBoardInfo[] | undefined,
  boardIds: readonly string[],
): SessionGroupHeading[] {
  const catalogBoards = orderedBoards(catalog ?? []);
  const catalogIds = new Set(catalogBoards.map(board => board.id));
  const uncatalogedBoards = orderedBoards(
    boardIds
      .filter(id => !catalogIds.has(id))
      .toSorted((a, b) => a.localeCompare(b))
      .map(id => ({ id })),
  );
  return [
    ...catalogBoards.map(board => boardHeading(board.id, board.title)),
    ...uncatalogedBoards.map(({ id }) => boardHeading(id, id.charAt(0).toUpperCase() + id.slice(1))),
    USER_GROUP,
    SLACK_GROUP,
  ];
}

export function sessionGroupHeadings(
  groupBy: SessionGroupBy,
  context: SessionGroupContext,
): readonly SessionGroupHeading[] {
  switch (groupBy) {
    case 'board':
      return boardGroupHeadings(context.catalog, context.boardIds);
    case 'status':
      return STATUS_GROUPS;
    case 'owner':
      return context.owners
        .toSorted((a, b) => Number(b.userId === context.viewerUserId) - Number(a.userId === context.viewerUserId))
        .map(({ userId, name }) => ({ key: `owner:${userId}`, label: name, icon: 'owner' }));
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
