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

function boardGroupKey(row: SessionListRow): string {
  return row.board === undefined ? USER_GROUP.key : `board:${row.board}`;
}

function boardHeading(boardId: string, label: string): SessionGroupHeading {
  return { key: `board:${boardId}`, label, icon: boardId === 'review' ? 'review' : 'board' };
}

function boardGroupHeadings(
  rows: readonly SessionListRow[],
  boards: readonly InstalledBoardInfo[] | undefined,
): SessionGroupHeading[] {
  const catalog = orderedBoards(boards ?? []);
  const catalogIds = new Set(catalog.map(board => board.id));
  const uncatalogedBoards = orderedBoards(
    [...new Set(rows.flatMap(row => (row.board !== undefined && !catalogIds.has(row.board) ? [row.board] : [])))]
      .toSorted()
      .map(id => ({ id })),
  );
  return [
    ...catalog.map(board => boardHeading(board.id, board.title)),
    ...uncatalogedBoards.map(({ id }) => boardHeading(id, id.charAt(0).toUpperCase() + id.slice(1))),
    USER_GROUP,
  ];
}

export function groupSessionRowsByBoard(
  rows: readonly SessionListRow[],
  boards: readonly InstalledBoardInfo[] | undefined,
): SessionGroup[] {
  return boardGroupHeadings(rows, boards).flatMap(heading => {
    const groupRows = rows.filter(row => boardGroupKey(row) === heading.key);
    return groupRows.length > 0 ? [{ ...heading, rows: groupRows }] : [];
  });
}
