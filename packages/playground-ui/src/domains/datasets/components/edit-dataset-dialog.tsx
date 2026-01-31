'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/ds/components/Dialog';
import { Button } from '@/ds/components/Button';
import { Input } from '@/ds/components/Input';
import { Label } from '@/ds/components/Label';
import { toast } from '@/lib/toast';
import { useDatasetMutations } from '../hooks/use-dataset-mutations';

export interface EditDatasetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dataset: {
    id: string;
    name: string;
    description?: string;
  };
  onSuccess?: () => void;
}

export function EditDatasetDialog({ open, onOpenChange, dataset, onSuccess }: EditDatasetDialogProps) {
  const [name, setName] = useState(dataset.name);
  const [description, setDescription] = useState(dataset.description ?? '');
  const { updateDataset } = useDatasetMutations();

  // Sync form state when dataset prop changes
  useEffect(() => {
    setName(dataset.name);
    setDescription(dataset.description ?? '');
  }, [dataset.name, dataset.description]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Dataset name is required');
      return;
    }

    try {
      await updateDataset.mutateAsync({
        datasetId: dataset.id,
        name: name.trim(),
        description: description.trim() || undefined,
      });

      toast.success('Dataset updated successfully');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(`Failed to update dataset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCancel = () => {
    // Reset to original values
    setName(dataset.name);
    setDescription(dataset.description ?? '');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Dataset</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-dataset-name">Name *</Label>
              <Input
                id="edit-dataset-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter dataset name"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-dataset-description">Description</Label>
              <Input
                id="edit-dataset-description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Enter dataset description (optional)"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" variant="light" disabled={updateDataset.isPending || !name.trim()}>
                {updateDataset.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
