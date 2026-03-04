'use client';

import { useState } from 'react';
import { DatabaseIcon, EyeIcon } from 'lucide-react';
import type { SpanRecord } from '@mastra/core/storage';
import type { DatasetRecord } from '@mastra/core/storage';
import { SideDialog } from '@/ds/components/SideDialog';
import { TextAndIcon, getShortId } from '@/ds/components/Text';
import { Button } from '@/ds/components/Button';
import { Label } from '@/ds/components/Label';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/ds/components/Select';
import { toast } from '@/lib/toast';
import { useDatasets } from '@/domains/datasets/hooks/use-datasets';
import { useDatasetMutations } from '@/domains/datasets/hooks/use-dataset-mutations';

type TraceAsItemDialogProps = {
  traceDetails?: SpanRecord;
  traceId?: string;
  isOpen: boolean;
  onClose: () => void;
};

export function TraceAsItemDialog({ traceDetails, traceId, isOpen, onClose }: TraceAsItemDialogProps) {
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [input, setInput] = useState('');
  const [groundTruth, setGroundTruth] = useState('');
  const [initialized, setInitialized] = useState(false);

  const { data, isLoading: isDatasetsLoading } = useDatasets();
  const { addItem } = useDatasetMutations();

  const datasets: DatasetRecord[] = (data as { datasets: DatasetRecord[] } | undefined)?.datasets ?? [];

  // Initialize form values when dialog opens with trace data
  if (isOpen && traceDetails && !initialized) {
    setInput(traceDetails.input ? JSON.stringify(traceDetails.input, null, 2) : '{}');
    setGroundTruth(traceDetails.output ? JSON.stringify(traceDetails.output, null, 2) : '');
    setInitialized(true);
  }

  // Reset initialized flag when dialog closes
  if (!isOpen && initialized) {
    setInitialized(false);
  }

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
      setInitialized(false);
      onClose();
    } catch (error) {
      toast.error(`Failed to save item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCancel = () => {
    setSelectedDatasetId('');
    setInitialized(false);
    onClose();
  };

  return (
    <SideDialog
      dialogTitle="Save as Dataset Item"
      dialogDescription="Save trace data as a dataset item"
      isOpen={isOpen}
      onClose={onClose}
      level={2}
    >
      <SideDialog.Top>
        <TextAndIcon>
          <EyeIcon /> {getShortId(traceId)}
        </TextAndIcon>
        ›
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
