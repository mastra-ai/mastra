'use client';

import type { DatasetItem } from '@mastra/client-js';
import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogCancel,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Form } from '@mastra/playground-ui/components/Form';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useDatasetMutations, useDatasets } from '@mastra/playground-ui/domains/datasets';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useState } from 'react';

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

  const datasets = data?.datasets ?? [];

  const availableDatasets = datasets.filter(dataset => dataset.id !== currentDatasetId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDatasetId) {
      toast.error('Please select a dataset');
      return;
    }

    setIsAdding(true);
    setProgress(0);

    try {
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

      const targetDataset = datasets.find(dataset => dataset.id === selectedDatasetId);
      toast.success(`Added ${items.length} item${items.length !== 1 ? 's' : ''} to "${targetDataset?.name}"`);

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

  const progressPercent = items.length > 0 ? (progress / items.length) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} pending={isAdding}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Items to Dataset</DialogTitle>
        </DialogHeader>
        <Form onSubmit={handleSubmit}>
          <DialogBody>
            <Field>
              <FieldLabel required>Target Dataset</FieldLabel>
              <Select
                value={selectedDatasetId}
                onValueChange={setSelectedDatasetId}
                disabled={isAdding || isDatasetsLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isDatasetsLoading ? 'Loading datasets...' : 'Select a dataset'} />
                </SelectTrigger>
                <SelectContent>
                  {availableDatasets.length === 0 ? (
                    <Txt as="p" variant="body" tone="muted" className="px-2 py-4 text-center">
                      No other datasets available
                    </Txt>
                  ) : (
                    availableDatasets.map(dataset => (
                      <SelectItem key={dataset.id} value={dataset.id}>
                        {dataset.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </Field>

            <Txt tone="muted">
              {items.length} item{items.length !== 1 ? 's' : ''} will be copied to the selected dataset
            </Txt>

            {isAdding && (
              <div className="space-y-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="bg-primary h-full transition-all duration-200"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <Txt tone="muted">
                  Adding items: {progress} / {items.length}
                </Txt>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <DialogCancel onClick={() => setSelectedDatasetId('')}>Cancel</DialogCancel>
            <DialogAction type="submit" disabled={!selectedDatasetId || availableDatasets.length === 0}>
              {isAdding ? `Adding... (${progress}/${items.length})` : 'Add Items'}
            </DialogAction>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
