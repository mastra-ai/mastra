import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { TrashIcon } from '@mastra/playground-ui/icons/TrashIcon';
import { IconArrowRotateCounterClockwise } from '@mastra/playground-ui/icons/central/IconArrowRotateCounterClockwise';
import { Ellipsis } from 'lucide-react';
import type { UseMutationResult } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import type { InstalledBoardInfo, StoredBoardInfo, StoredBoardResponse } from '../../../../api/types';
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

/** The board's actions beside its name: reset to default and delete, each confirmed first. */
export function BoardActions({
  board,
  writes,
  disabled,
}: {
  board: StoredBoardInfo;
  writes: BoardActionWrites;
  /** The board's save in flight holds the menu shut. */
  disabled: boolean;
}) {
  const { reset, remove } = writes;
  const [confirm, setConfirm] = useState<'reset' | 'delete'>();
  const resettable = board.source !== 'stored';
  const deletable = board.source !== 'builtin';
  const busy = reset.isPending || remove.isPending;

  if (!resettable && !deletable) return null;
  return (
    <>
      <DropdownMenu>
        <DropdownMenu.Trigger
          variant="ghost"
          size="icon-sm"
          tooltip="Board actions"
          aria-label="Board actions"
          disabled={disabled || busy}
        >
          {busy ? <Spinner size="sm" /> : <Ellipsis />}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="start">
          {resettable && (
            <DropdownMenu.Item onClick={() => setConfirm('reset')}>
              <IconArrowRotateCounterClockwise />
              Reset to default
            </DropdownMenu.Item>
          )}
          {deletable && (
            <DropdownMenu.Item variant="destructive" onClick={() => setConfirm('delete')}>
              <TrashIcon />
              Delete board
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu>

      <AlertDialog open={confirm === 'reset'} onOpenChange={open => !open && setConfirm(undefined)}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Reset {board.name} to default?</AlertDialog.Title>
            <AlertDialog.Description>
              Every change made to this board's name and phases is replaced with Factory's version.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action onClick={() => reset.mutate(board.revision ?? 0)}>Reset</AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
      <AlertDialog open={confirm === 'delete'} onOpenChange={open => !open && setConfirm(undefined)}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Delete {board.name}?</AlertDialog.Title>
            <AlertDialog.Description>
              The board and its phases are removed from this project. A board that still has cards can’t be deleted.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action onClick={() => remove.mutate(board.revision ?? 0)}>Delete</AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </>
  );
}

/** Why the last reset or delete didn't go through. */
export function BoardActionErrors({ writes }: { writes: BoardActionWrites }) {
  const { reset, remove } = writes;
  return (
    <>
      {reset.error && (
        <Notice variant="destructive" role="alert">
          <Notice.Message>The board was not reset. {reset.error.reasons}</Notice.Message>
        </Notice>
      )}
      {remove.error && (
        <Notice variant="destructive" role="alert">
          <Notice.Message>The board was not deleted. {remove.error.reasons}</Notice.Message>
        </Notice>
      )}
    </>
  );
}
