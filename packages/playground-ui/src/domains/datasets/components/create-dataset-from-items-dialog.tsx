'use client';

import { useState } from 'react';
import type { DatasetItem } from '@mastra/client-js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/ds/components/Dialog';
import { Button } from '@/ds/components/Button';
import { Input } from '@/ds/components/Input';
import { Label } from '@/ds/components/Label';
import { toast } from '@/lib/toast';
import { useDatasetMutations } from '../hooks/use-dataset-mutations';

export interface CreateDatasetFromItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: DatasetItem[];
  onSuccess?: (datasetId: string) => void;
}

export function CreateDatasetFromItemsDialog({
  open,
  onOpenChange,
  items,
  onSuccess,
}: CreateDatasetFromItemsDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [progress, setProgress] = useState(0);
  const { createDataset, addItem } = useDatasetMutations();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Dataset name is required');
      return;
    }

    setIsCreating(true);
    setProgress(0);

    try {
      // Create the dataset
      const dataset = (await createDataset.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
      })) as { id: string };

      // Copy items to new dataset
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await addItem.mutateAsync({
          datasetId: dataset.id,
          input: item.input,
          groundTruth: item.groundTruth,
          metadata: item.metadata as Record<string, unknown> | undefined,
        });
        setProgress(i + 1);
      }

      toast.success(`Dataset created with ${items.length} items`);

      // Reset form
      setName('');
      setDescription('');
      setIsCreating(false);
      setProgress(0);
      onOpenChange(false);

      // Navigate to new dataset
      onSuccess?.(dataset.id);
    } catch (error) {
      toast.error(`Failed to create dataset: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsCreating(false);
      setProgress(0);
    }
  };

  const handleCancel = () => {
    if (isCreating) return; // Prevent cancel during creation
    setName('');
    setDescription('');
    onOpenChange(false);
  };

  const progressPercent = items.length > 0 ? (progress / items.length) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={isCreating ? undefined : onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Dataset from Items</DialogTitle>
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
                disabled={isCreating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataset-description">Description</Label>
              <Input
                id="dataset-description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Enter dataset description (optional)"
                disabled={isCreating}
              />
            </div>

            <p className="text-sm text-muted-foreground">
              {items.length} item{items.length !== 1 ? 's' : ''} will be copied to the new dataset
            </p>

            {isCreating && (
              <div className="space-y-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-200"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Copying items: {progress} / {items.length}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="standard" size="default" onClick={handleCancel} disabled={isCreating}>
                Cancel
              </Button>
              <Button type="submit" variant="cta" size="default" disabled={isCreating || !name.trim()}>
                {isCreating ? `Creating... (${progress}/${items.length})` : 'Create Dataset'}
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
