import { Ellipsis } from 'lucide-react';
import { useState } from 'react';
import { AlertDialog } from '@/ds/components/AlertDialog';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { Notice } from '@/ds/components/Notice';
import { Spinner } from '@/ds/components/Spinner';
import { IconArrowRotateCounterClockwise } from '@/ds/icons/central/IconArrowRotateCounterClockwise';
import { TrashIcon } from '@/ds/icons/TrashIcon';

export interface BoardActionsProps {
  /** The board's saved name, as the confirmations ask about it. */
  boardName: string;
  /** The board has a default to go back to. */
  resettable: boolean;
  /** The board can be removed from the project. */
  deletable: boolean;
  /** A reset or delete is in flight. */
  busy: boolean;
  /** The board's save in flight holds the menu shut. */
  disabled: boolean;
  /** Resets the board, once confirmed. */
  onReset: () => void;
  /** Deletes the board, once confirmed. */
  onDelete: () => void;
}

/** The board's actions beside its name: reset to default and delete, each confirmed first. */
export function BoardActions({
  boardName,
  resettable,
  deletable,
  busy,
  disabled,
  onReset,
  onDelete,
}: BoardActionsProps) {
  const [confirm, setConfirm] = useState<'reset' | 'delete'>();

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
            <AlertDialog.Title>Reset {boardName} to default?</AlertDialog.Title>
            <AlertDialog.Description>
              Every change made to this board's name and phases is replaced with Factory's version.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action onClick={onReset}>Reset</AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
      <AlertDialog open={confirm === 'delete'} onOpenChange={open => !open && setConfirm(undefined)}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Delete {boardName}?</AlertDialog.Title>
            <AlertDialog.Description>
              The board and its phases are removed from this project. A board that still has cards can’t be deleted.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action onClick={onDelete}>Delete</AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </>
  );
}

/** Why the last reset or delete didn't go through: the server's reasons, set only while that write has failed. */
export interface BoardActionErrorsProps {
  resetError: string | undefined;
  deleteError: string | undefined;
}

/** Why the last reset or delete didn't go through. */
export function BoardActionErrors({ resetError, deleteError }: BoardActionErrorsProps) {
  return (
    <>
      {resetError !== undefined && (
        <Notice variant="destructive" role="alert">
          <Notice.Message>The board was not reset. {resetError}</Notice.Message>
        </Notice>
      )}
      {deleteError !== undefined && (
        <Notice variant="destructive" role="alert">
          <Notice.Message>The board was not deleted. {deleteError}</Notice.Message>
        </Notice>
      )}
    </>
  );
}
