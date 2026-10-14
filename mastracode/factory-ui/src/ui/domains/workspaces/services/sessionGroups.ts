import type { InstalledBoardInfo } from '../../../../api/types';
import { orderedBoards } from '../../factory/boardCatalog';
import type { SessionListRow } from './sessionRows';

export type SessionGroupIcon = 'board' | 'review' | 'user';

export interface SessionGroupHeading {
  key: string;
  label: string;
  icon: SessionGroupIcon;
}

export interface SessionGroup extends SessionGroupHeading {
  rows: SessionListRow[];
}

const USER_GROUP: SessionGroupHeading = { key: 'user', label: 'User', icon: 'user' };
const BUILTIN_BOARD_ORDER = ['work', 'review'];

function boardGroupKey(row: SessionListRow): string {
  return row.board === undefined ? USER_GROUP.key : `board:${row.board}`;
}

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

/** Rows keep their incoming order inside each group; groups without rows are left out. */
export function groupSessionRowsByBoard(
  rows: readonly SessionListRow[],
  boards: readonly InstalledBoardInfo[] | undefined,
): SessionGroup[] {
  return boardGroupHeadings(rows, boards).flatMap(heading => {
    const groupRows = rows.filter(row => boardGroupKey(row) === heading.key);
    return groupRows.length > 0 ? [{ ...heading, rows: groupRows }] : [];
  });
}
