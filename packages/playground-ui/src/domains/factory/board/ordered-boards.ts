import { DEFAULT_BOARD_ID } from '@internal/factory-contract';

export function orderedBoards<B extends { id: string }>(boards: readonly B[]): B[] {
  return [
    ...boards.filter(board => board.id === DEFAULT_BOARD_ID),
    ...boards.filter(board => board.id !== DEFAULT_BOARD_ID),
  ];
}
