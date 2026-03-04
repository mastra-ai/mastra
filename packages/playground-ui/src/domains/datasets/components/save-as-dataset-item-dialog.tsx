'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { DatabaseIcon } from 'lucide-react';
import type { DatasetRecord } from '@mastra/core/storage';
import type { SideDialogRootProps } from '@/ds/components/SideDialog';
import { SideDialog } from '@/ds/components/SideDialog';
import { TextAndIcon } from '@/ds/components/Text';
import { Button } from '@/ds/components/Button';
import { Label } from '@/ds/components/Label';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/ds/components/Select';
import { toast } from '@/lib/toast';
import { useDatasets } from '@/domains/datasets/hooks/use-datasets';
import { useDatasetMutations } from '@/domains/datasets/hooks/use-dataset-mutations';

type SaveAsDatasetItemDialogProps = {
  initialInput: string;
  initialGroundTruth: string;
  breadcrumb: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  level?: SideDialogRootProps['level'];
};

export function SaveAsDatasetItemDialog({
  initialInput,
  initialGroundTruth,
  breadcrumb,
  isOpen,
  onClose,
  level = 2,
}: SaveAsDatasetItemDialogProps) {
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [input, setInput] = useState('');
  const [groundTruth, setGroundTruth] = useState('');

  const { data, isLoading: isDatasetsLoading } = useDatasets();
  const { addItem } = useDatasetMutations();

  const datasets: DatasetRecord[] = (data as { datasets: DatasetRecord[] } | undefined)?.datasets ?? [];

  useEffect(() => {
    if (isOpen) {
      setInput(initialInput);
      setGroundTruth(initialGroundTruth);
    }
  }, [isOpen, initialInput, initialGroundTruth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDatasetId) {
      toast.error('Please select a dataset');
      return;
    }

    let parsedInput: unknown;
    try {
      parsedInput = JSON.parse(input);
    } catch {
      toast.error('Input must be valid JSON');
      return;
    }

    let parsedGroundTruth: unknown | undefined;
    if (groundTruth.trim()) {
      try {
        parsedGroundTruth = JSON.parse(groundTruth);
      } catch {
        toast.error('Ground Truth must be valid JSON');
        return;
      }
    }

    try {
      await addItem.mutateAsync({
        datasetId: selectedDatasetId,
        input: parsedInput,
        groundTruth: parsedGroundTruth,
      });

      const targetDataset = datasets.find(d => d.id === selectedDatasetId);
      toast.success(`Item saved to "${targetDataset?.name}"`);

      setSelectedDatasetId('');
      setInput('{}');
      setGroundTruth('');
      onClose();
    } catch (error) {
      toast.error(`Failed to save item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCancel = () => {
    setSelectedDatasetId('');
    onClose();
  };

  return (
    <SideDialog
      dialogTitle="Save as Dataset Item"
      dialogDescription="Save data as a dataset item"
      isOpen={isOpen}
      onClose={onClose}
      level={level}
    >
      <SideDialog.Top>
        {breadcrumb}›
        <TextAndIcon>
          <DatabaseIcon /> Save as Dataset Item
        </TextAndIcon>
      </SideDialog.Top>

      <SideDialog.Content>
        <SideDialog.Header>
          <SideDialog.Heading>
            <DatabaseIcon /> Save as Dataset Item
          </SideDialog.Heading>
        </SideDialog.Header>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="target-dataset">Dataset *</Label>
            <Select
              value={selectedDatasetId}
              onValueChange={setSelectedDatasetId}
              disabled={addItem.isPending || isDatasetsLoading}
            >
              <SelectTrigger id="target-dataset">
                <SelectValue placeholder={isDatasetsLoading ? 'Loading datasets...' : 'Select a dataset'} />
              </SelectTrigger>
              <SelectContent>
                {datasets.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-neutral4 text-center">No datasets available</div>
                ) : (
                  datasets.map(dataset => (
                    <SelectItem key={dataset.id} value={dataset.id}>
                      {dataset.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="item-input">Input (JSON) *</Label>
            <CodeEditor value={input} onChange={setInput} showCopyButton={false} className="min-h-[120px]" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="item-ground-truth">Ground Truth (JSON, optional)</Label>
            <CodeEditor value={groundTruth} onChange={setGroundTruth} showCopyButton={false} className="min-h-[80px]" />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="light"
              disabled={addItem.isPending || !selectedDatasetId || datasets.length === 0}
            >
              {addItem.isPending ? 'Saving...' : 'Save Item'}
            </Button>
          </div>
        </form>
      </SideDialog.Content>
    </SideDialog>
  );
}
