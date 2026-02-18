'use client';

import { useState } from 'react';
import type { DatasetItem, DatasetRecord } from '@mastra/client-js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/ds/components/Dialog';
import { Button } from '@/ds/components/Button';
import { Label } from '@/ds/components/Label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/ds/components/Select';
import { toast } from '@/lib/toast';
import { useDatasets } from '../hooks/use-datasets';
import { useDatasetMutations } from '../hooks/use-dataset-mutations';

export interface AddItemsToDatasetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: DatasetItem[];
  currentDatasetId: string;
  onSuccess?: (datasetId: string) => void;
}

export function AddItemsToDatasetDialog({
  open,
  onOpenChange,
  items,
  currentDatasetId,
  onSuccess,
}: AddItemsToDatasetDialogProps) {
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [isAdding, setIsAdding] = useState(false);
  const [progress, setProgress] = useState(0);

  const { data, isLoading: isDatasetsLoading } = useDatasets();
  const { addItem } = useDatasetMutations();

  // Extract datasets array from response
  const datasets: DatasetRecord[] = (data as { datasets: DatasetRecord[] } | undefined)?.datasets ?? [];

  // Filter out the current dataset from the list
  const availableDatasets = datasets.filter((d: DatasetRecord) => d.id !== currentDatasetId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDatasetId) {
      toast.error('Please select a dataset');
      return;
    }

    setIsAdding(true);
    setProgress(0);

    try {
      // Add items to selected dataset
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await addItem.mutateAsync({
          datasetId: selectedDatasetId,
          input: item.input,
          groundTruth: item.groundTruth,
          metadata: item.metadata as Record<string, unknown> | undefined,
        });
        setProgress(i + 1);
      }

      const targetDataset = datasets.find((d: DatasetRecord) => d.id === selectedDatasetId);
      toast.success(`Added ${items.length} item${items.length !== 1 ? 's' : ''} to "${targetDataset?.name}"`);

      // Reset form
      setSelectedDatasetId('');
      setIsAdding(false);
      setProgress(0);
      onOpenChange(false);

      onSuccess?.(selectedDatasetId);
    } catch (error) {
      toast.error(`Failed to add items: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsAdding(false);
      setProgress(0);
    }
  };

  const handleCancel = () => {
    if (isAdding) return; // Prevent cancel during operation
    setSelectedDatasetId('');
    onOpenChange(false);
  };

  const progressPercent = items.length > 0 ? (progress / items.length) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={isAdding ? undefined : onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Items to Dataset</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="target-dataset">Target Dataset *</Label>
              <Select
                value={selectedDatasetId}
                onValueChange={setSelectedDatasetId}
                disabled={isAdding || isDatasetsLoading}
              >
                <SelectTrigger id="target-dataset">
                  <SelectValue placeholder={isDatasetsLoading ? 'Loading datasets...' : 'Select a dataset'} />
                </SelectTrigger>
                <SelectContent>
                  {availableDatasets.length === 0 ? (
                    <div className="px-2 py-4 text-sm text-neutral4 text-center">No other datasets available</div>
                  ) : (
                    availableDatasets.map(dataset => (
                      <SelectItem key={dataset.id} value={dataset.id}>
                        {dataset.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <p className="text-sm text-muted-foreground">
              {items.length} item{items.length !== 1 ? 's' : ''} will be copied to the selected dataset
            </p>

            {isAdding && (
              <div className="space-y-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-200"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Adding items: {progress} / {items.length}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="standard" size="default" onClick={handleCancel} disabled={isAdding}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="cta"
                size="default"
                disabled={isAdding || !selectedDatasetId || availableDatasets.length === 0}
              >
                {isAdding ? `Adding... (${progress}/${items.length})` : 'Add Items'}
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
