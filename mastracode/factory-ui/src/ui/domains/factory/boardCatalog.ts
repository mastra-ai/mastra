import { DEFAULT_BOARD_ID } from '@mastra/factory/boards/default-board';
import type { InstalledBoardInfo } from '../../../api/types';

export function boardPath(factoryId: string, boardId: string) {
  return `/factories/${factoryId}/${boardId === DEFAULT_BOARD_ID ? boardId : `boards/${encodeURIComponent(boardId)}`}`;
}

export function orderedBoards<B extends { id: string }>(boards: readonly B[]): B[] {
  return [
    ...boards.filter(board => board.id === DEFAULT_BOARD_ID),
    ...boards.filter(board => board.id !== DEFAULT_BOARD_ID),
  ];
}
