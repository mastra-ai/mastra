'use client';

import { AlertDialog } from '@/ds/components/AlertDialog';
import { buttonVariants } from '@/ds/components/Button/Button';
import { cn } from '@/lib/utils';

export interface DeleteScorerConfirmProps {
  scorerName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export function DeleteScorerConfirm({
  scorerName,
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
}: DeleteScorerConfirmProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>Delete Scorer</AlertDialog.Title>
          <AlertDialog.Description>
            Are you sure you want to delete {scorerName}? This action cannot be undone.
          </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Cancel disabled={isDeleting}>Cancel</AlertDialog.Cancel>
          <AlertDialog.Action
            onClick={onConfirm}
            disabled={isDeleting}
            className={cn(buttonVariants(), 'bg-red-600 hover:bg-red-700 text-white')}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  );
}
