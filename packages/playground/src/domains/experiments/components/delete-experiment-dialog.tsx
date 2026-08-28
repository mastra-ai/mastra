'use client';

import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useDatasetMutations } from '@/domains/datasets/hooks/use-dataset-mutations';

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
            the experiment and all its results. This action cannot be undone.
          </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Action onClick={handleDelete} disabled={deleteExperiment.isPending}>
            {deleteExperiment.isPending ? 'Deleting...' : 'Delete'}
          </AlertDialog.Action>
          <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  );
}
