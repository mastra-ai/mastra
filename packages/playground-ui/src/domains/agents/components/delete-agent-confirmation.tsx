import type { ReactNode } from 'react';
import { AlertDialog } from '@/ds/components/AlertDialog';
import { Button } from '@/ds/components/Button';
import { TrashIcon } from '@/ds/icons/TrashIcon';

export interface DeleteAgentConfirmationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  description: ReactNode;
  children?: ReactNode;
  isPending: boolean;
  isDependentsLoading: boolean;
  onConfirm: () => void;
}

export const DeleteAgentConfirmation = ({
  open,
  onOpenChange,
  description,
  children,
  isPending,
  isDependentsLoading,
  onConfirm,
}: DeleteAgentConfirmationProps) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialog.Content data-testid="agent-builder-delete-agent-dialog">
      <AlertDialog.Header>
        <AlertDialog.Title>Delete agent?</AlertDialog.Title>
        <AlertDialog.Description>{description}</AlertDialog.Description>
      </AlertDialog.Header>
      <AlertDialog.Body>{children}</AlertDialog.Body>
      <AlertDialog.Footer>
        <AlertDialog.Cancel data-testid="agent-builder-delete-agent-cancel" disabled={isPending}>
          Cancel
        </AlertDialog.Cancel>
        <Button
          icon={<TrashIcon />}
          variant="destructive"
          data-testid="agent-builder-delete-agent-confirm"
          disabled={isDependentsLoading}
          onClick={onConfirm}
          loading={isPending}
        >
          Delete agent
        </Button>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog>
);
