'use client';

import { useState } from 'react';
import { AlertDialog } from '@/ds/components/AlertDialog';
import { Button } from '@/ds/components/Button';
import { TrashIcon } from '@/ds/icons/TrashIcon';
import { toast } from '@/utils/toast';

export interface DeleteExperimentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  experimentId: string;
  experimentName?: string;
  /** Deletes the experiment; reject to keep the dialog open for a retry. */
  onDelete: () => Promise<void>;
  onSuccess?: () => void;
}

export function DeleteExperimentDialog({
  open,
  onOpenChange,
  experimentId,
  experimentName,
  onDelete,
  onSuccess,
}: DeleteExperimentDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
      toast.success('Experiment deleted successfully');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(`Failed to delete experiment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>Delete Experiment</AlertDialog.Title>
          <AlertDialog.Description>
            Are you sure you want to delete &quot;{experimentName || experimentId}&quot;? This will permanently delete
            the experiment, all its results, and the traces it produced, including their spans and any scores, feedback,
            metrics and logs attached to those traces. This action cannot be undone.
          </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
          <Button icon={<TrashIcon />} variant="primary" onClick={handleDelete} loading={isDeleting}>
            Delete
          </Button>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  );
}
