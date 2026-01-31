'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/ds/components/Dialog';
import { Button } from '@/ds/components/Button';
import { Input } from '@/ds/components/Input';
import { Label } from '@/ds/components/Label';
import { toast } from '@/lib/toast';
import { useDatasetMutations } from '../hooks/use-dataset-mutations';

export interface CreateDatasetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (datasetId: string) => void;
}

export function CreateDatasetDialog({ open, onOpenChange, onSuccess }: CreateDatasetDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const { createDataset } = useDatasetMutations();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Dataset name is required');
      return;
    }

    try {
      const result = await createDataset.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
      });

      toast.success('Dataset created successfully');

      // Reset form
      setName('');
      setDescription('');
      onOpenChange(false);

      // Navigate to new dataset
      onSuccess?.(result.id);
    } catch (error) {
      toast.error(`Failed to create dataset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCancel = () => {
    setName('');
    setDescription('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Dataset</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dataset-name">Name *</Label>
              <Input
                id="dataset-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter dataset name"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataset-description">Description</Label>
              <Input
                id="dataset-description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Enter dataset description (optional)"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" variant="light" disabled={createDataset.isPending || !name.trim()}>
                {createDataset.isPending ? 'Creating...' : 'Create Dataset'}
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
