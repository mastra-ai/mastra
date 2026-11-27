import type { UseMutationResult } from '@tanstack/react-query';
import { useNavigate } from 'react-router';

import type { InstalledBoardInfo, StoredBoardResponse } from '../../../../api/types';
import { useDeleteBoardMutation, useResetBoardMutation } from '../../../../hooks/useBoardEditor';
import type { BoardRequestError } from '../../../../hooks/useBoardEditor';
import { boardPath, orderedBoards } from '../../factory/boardCatalog';

/** The board's reset and delete, each sent with the revision it was read at. */
export interface BoardActionWrites {
  reset: UseMutationResult<StoredBoardResponse, BoardRequestError, number>;
  remove: UseMutationResult<void, BoardRequestError, number>;
}

/** Resetting and deleting the board. A deleted board's page moves on to the first board left, or to Work. */
export function useBoardActions({
  factoryId,
  boardId,
  boards,
  onDeleted,
}: {
  factoryId: string;
  boardId: string;
  boards: readonly InstalledBoardInfo[];
  /** Drops the draft before a deleted board's canvas goes away. */
  onDeleted: () => void;
}): BoardActionWrites {
  const navigate = useNavigate();
  const reset = useResetBoardMutation(factoryId, boardId);
  const remove = useDeleteBoardMutation(factoryId, boardId, () => {
    onDeleted();
    // The deleted board is gone from the catalog by now; Work, or the first board left, shows next.
    const next = orderedBoards(boards).find(other => other.id !== boardId);
    void navigate(next ? boardPath(factoryId, next.id) : `/factories/${factoryId}`, { replace: true });
  });
  return { reset, remove };
}
