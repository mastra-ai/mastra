import { orderedBoards } from '@mastra/playground-ui/domains/factory';
import type { UseMutationResult } from '@tanstack/react-query';

import type { InstalledBoardInfo, StoredBoardResponse } from '@internal/factory-contract';
import { useDeleteBoardMutation, useResetBoardMutation } from '@mastra/react/hooks/factory';
import type { FactoryRequestError } from '@mastra/client-js';
import { useBoardSettingsHost } from '../boardSettingsHost';

/** The board's reset and delete, each sent with the revision it was read at. */
export interface BoardActionWrites {
  reset: UseMutationResult<StoredBoardResponse, FactoryRequestError, number>;
  remove: UseMutationResult<void, FactoryRequestError, number>;
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
  const host = useBoardSettingsHost();
  const reset = useResetBoardMutation(factoryId, boardId);
  const remove = useDeleteBoardMutation(factoryId, boardId, () => {
    onDeleted();
    // The deleted board is gone from the catalog by now; Work, or the first board left, shows next.
    const next = orderedBoards(boards).find(other => other.id !== boardId);
    host.navigate(next ? host.boardHref(next.id) : host.homeHref(), { replace: true });
  });
  return { reset, remove };
}
