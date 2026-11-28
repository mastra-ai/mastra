import { DEFAULT_BOARD_ID } from '@internal/factory-contract';
import type { InstalledBoardInfo } from '../../../api/types';

export function boardPath(factoryId: string, boardId: string) {
  return `/factories/${factoryId}/${boardId === DEFAULT_BOARD_ID ? boardId : `boards/${encodeURIComponent(boardId)}`}`;
}
