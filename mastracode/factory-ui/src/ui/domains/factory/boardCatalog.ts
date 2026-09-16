import type { InstalledBoardInfo } from '../../../api/types';

export function boardPath(factoryId: string, boardId: string) {
  return `/factories/${factoryId}/${boardId === 'work' || boardId === 'review' ? boardId : `boards/${encodeURIComponent(boardId)}`}`;
}

export function orderedBoards(boards: InstalledBoardInfo[]) {
  return [
    ...boards.filter(board => board.id === 'work'),
    ...boards.filter(board => board.id === 'review'),
    ...boards.filter(board => board.id !== 'work' && board.id !== 'review'),
  ];
}
