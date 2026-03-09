'use client';

import { AlertDialog } from '@/ds/components/AlertDialog';
import { toast } from '@/lib/toast';
import { useDatasetMutations } from '../hooks/use-dataset-mutations';

export interface DeleteDatasetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  datasetId: string;
  datasetName: string;
  onSuccess?: () => void;
}

export function DeleteDatasetDialog({
  open,
  onOpenChange,
  datasetId,
  datasetName,
  onSuccess,
}: DeleteDatasetDialogProps) {
  const { deleteDataset } = useDatasetMutations();

  const handleDelete = async () => {
    try {
      await deleteDataset.mutateAsync(datasetId);
      toast.success('Dataset deleted successfully');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(`Failed to delete dataset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>Delete Dataset</AlertDialog.Title>
          <AlertDialog.Description>
            Are you sure you want to delete &quot;{datasetName}&quot;? This will permanently delete the dataset, all its
            items, and run history. This action cannot be undone.
          </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Action onClick={handleDelete} disabled={deleteDataset.isPending}>
            {deleteDataset.isPending ? 'Deleting...' : 'Delete'}
          </AlertDialog.Action>
          <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  );
}
