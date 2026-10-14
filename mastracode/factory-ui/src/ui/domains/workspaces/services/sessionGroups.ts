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

export const COLLAPSED_GROUP_ROW_COUNT = 5;

const USER_GROUP: SessionGroupHeading = { key: 'user', label: 'User', icon: 'user' };

function boardGroupKey(boardId: string): string {
  return `board:${boardId}`;
}

function rowGroupKey(row: SessionListRow): string {
  return row.board === undefined ? USER_GROUP.key : boardGroupKey(row.board);
}

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

export function groupSessionRowsByBoard(
  rows: readonly SessionListRow[],
  boards: readonly InstalledBoardInfo[] | undefined,
): SessionGroup[] {
  return boardGroupHeadings(rows, boards).flatMap(heading => {
    const groupRows = rows.filter(row => rowGroupKey(row) === heading.key);
    return groupRows.length > 0 ? [{ ...heading, rows: groupRows }] : [];
  });
}

export function collapsedRowsKeepingActive(rows: readonly SessionListRow[]): SessionListRow[] {
  const visible = rows.slice(0, COLLAPSED_GROUP_ROW_COUNT);
  const open = rows.find(row => row.active);
  if (open && !visible.includes(open)) visible.push(open);
  return visible;
}
