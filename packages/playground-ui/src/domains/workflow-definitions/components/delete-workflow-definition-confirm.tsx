import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/ds/components/Button';
import { useWorkflowDefinitionMutations } from '../hooks';

export interface DeleteWorkflowDefinitionConfirmProps {
  definition: { id: string; name: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DeleteWorkflowDefinitionConfirm({
  definition,
  open,
  onOpenChange,
  onSuccess,
}: DeleteWorkflowDefinitionConfirmProps) {
  const { deleteWorkflowDefinition } = useWorkflowDefinitionMutations();

  const handleDelete = async () => {
    if (!definition) {
      return;
    }

    try {
      await deleteWorkflowDefinition.mutateAsync(definition.id);
      onOpenChange(false);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Failed to delete workflow definition:', error);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Delete Workflow Definition</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the workflow definition{' '}
            <span className="font-semibold text-icon6">{definition?.name}</span>? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleCancel} disabled={deleteWorkflowDefinition.isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="light"
            onClick={handleDelete}
            disabled={deleteWorkflowDefinition.isPending}
            className="bg-red-500/10 hover:bg-red-500/20 text-red-500"
          >
            {deleteWorkflowDefinition.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
