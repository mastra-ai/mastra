'use client';

import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Button } from '@mastra/playground-ui/components/Button';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useDatasetMutations } from '@mastra/react/hooks/datasets';
import { Trash2 } from 'lucide-react';

export interface DeleteExperimentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  experimentId: string;
  experimentName?: string;
  onSuccess?: () => void;
}

export function DeleteExperimentDialog({
  open,
  onOpenChange,
  experimentId,
  experimentName,
  onSuccess,
}: DeleteExperimentDialogProps) {
  const { deleteExperiment } = useDatasetMutations();

  const handleDelete = async () => {
    try {
      await deleteExperiment.mutateAsync(experimentId);
      toast.success('Experiment deleted successfully');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(`Failed to delete experiment: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
          <Button icon={<Trash2 />} variant="primary" onClick={handleDelete} disabled={deleteExperiment.isPending}>
            {deleteExperiment.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  );
}
