import type { InstalledBoardInfo } from '../../../api/types';

export function boardPath(factoryId: string, boardId: string) {
  return `/factories/${factoryId}/${boardId === 'work' || boardId === 'review' ? 'work' : `boards/${encodeURIComponent(boardId)}`}`;
}

export function orderedBoards<B extends { id: string }>(boards: readonly B[]): B[] {
  return [...boards.filter(board => board.id === 'work'), ...boards.filter(board => board.id !== 'work')];
}
