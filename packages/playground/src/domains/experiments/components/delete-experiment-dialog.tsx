'use client';

import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Button } from '@mastra/playground-ui/components/Button';
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
      // Leave the dialog open so the failure stays attached to the action that
      // caused it and the user can retry without reopening it.
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
          {/* Deliberately a Button rather than AlertDialog.Action: Action is a
              Close, which would dismiss the dialog before the request settles
              and hide a failed deletion behind a toast. */}
          <Button variant="primary" size="lg" onClick={handleDelete} disabled={deleteExperiment.isPending}>
            {deleteExperiment.isPending ? 'Deleting...' : 'Delete'}
          </Button>
          <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  );
}
