'use client';

import { Button, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, toast } from '@mastra/playground-ui';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { Label } from '@mastra/playground-ui/components/Label';
import { SideDialog } from '@mastra/playground-ui/components/SideDialog';
import type { SideDialogRootProps } from '@mastra/playground-ui/components/SideDialog';
import { TextAndIcon } from '@mastra/playground-ui/components/Text';
import { DatabaseIcon } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useDatasetMutations } from '@/domains/datasets/hooks/use-dataset-mutations';
import { useDatasets } from '@/domains/datasets/hooks/use-datasets';

type SaveAsDatasetItemDialogProps = {
  initialInput: string;
  initialGroundTruth: string;
  /** JSON string of the expected trajectory */
  initialTrajectory?: string;
  /** Whether the trajectory is still being fetched */
  trajectoryLoading?: boolean;
  breadcrumb: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  level?: SideDialogRootProps['level'];
  source?: { type: 'csv' | 'json' | 'trace' | 'llm' | 'experiment-result'; referenceId?: string };
};

export function SaveAsDatasetItemDialog({
  initialInput,
  initialGroundTruth,
  initialTrajectory,
  trajectoryLoading,
  breadcrumb,
  isOpen,
  onClose,
  level = 2,
  source,
}: SaveAsDatasetItemDialogProps) {
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [input, setInput] = useState('');
  const [groundTruth, setGroundTruth] = useState('');
  const [expectedTrajectory, setExpectedTrajectory] = useState('');
  // source is passed through — not editable in the UI

  const { data, isLoading: isDatasetsLoading } = useDatasets();
  const { addItem } = useDatasetMutations();

  const datasets = data?.datasets ?? [];

  const prevOpenRef = useRef(false);
  const trajectorySeededRef = useRef(false);
  const inputSeededRef = useRef(false);
  const groundTruthSeededRef = useRef(false);
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      setInput(initialInput);
      setGroundTruth(initialGroundTruth);
      setExpectedTrajectory(initialTrajectory ?? '');
      trajectorySeededRef.current = !!initialTrajectory;
      inputSeededRef.current = initialInput !== '{}';
      groundTruthSeededRef.current = !!initialGroundTruth;
    }
    prevOpenRef.current = isOpen;
    if (!isOpen) {
      trajectorySeededRef.current = false;
      inputSeededRef.current = false;
      groundTruthSeededRef.current = false;
    }
  }, [isOpen, initialInput, initialGroundTruth, initialTrajectory]);

  // Mark fields as user-edited so async seeding won't overwrite them.
  const handleInputChange = (value: string) => {
    inputSeededRef.current = true;
    setInput(value);
  };

  const handleGroundTruthChange = (value: string) => {
    groundTruthSeededRef.current = true;
    setGroundTruth(value);
  };

  const handleExpectedTrajectoryChange = (value: string) => {
    trajectorySeededRef.current = true;
    setExpectedTrajectory(value);
  };

  // Seed input when it arrives asynchronously after the dialog is already open
  useEffect(() => {
    if (isOpen && initialInput !== '{}' && !inputSeededRef.current) {
      setInput(initialInput);
      inputSeededRef.current = true;
    }
  }, [isOpen, initialInput]);

  // Seed groundTruth when it arrives asynchronously after the dialog is already open
  useEffect(() => {
    if (isOpen && initialGroundTruth && !groundTruthSeededRef.current) {
      setGroundTruth(initialGroundTruth);
      groundTruthSeededRef.current = true;
    }
  }, [isOpen, initialGroundTruth]);

  // Seed trajectory when it arrives asynchronously after the dialog is already open
  useEffect(() => {
    if (isOpen && initialTrajectory && !trajectorySeededRef.current) {
      setExpectedTrajectory(initialTrajectory);
      trajectorySeededRef.current = true;
    }
  }, [isOpen, initialTrajectory]);

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

    let parsedTrajectory: unknown | undefined;
    if (expectedTrajectory.trim()) {
      try {
        parsedTrajectory = JSON.parse(expectedTrajectory);
      } catch {
        toast.error('Expected Trajectory must be valid JSON');
        return;
      }
    }

    try {
      await addItem.mutateAsync({
        datasetId: selectedDatasetId,
        input: parsedInput,
        groundTruth: parsedGroundTruth,
        expectedTrajectory: parsedTrajectory,
        ...(source ? { source } : {}),
      });

      const targetDataset = datasets.find(d => d.id === selectedDatasetId);
      toast.success(`Item saved to "${targetDataset?.name}"`);

      setSelectedDatasetId('');
      setInput('{}');
      setGroundTruth('');
      setExpectedTrajectory('');
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
            <CodeEditor value={input} onChange={handleInputChange} showCopyButton={false} className="min-h-[120px]" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="item-ground-truth">Ground Truth (JSON, optional)</Label>
            <CodeEditor
              value={groundTruth}
              onChange={handleGroundTruthChange}
              showCopyButton={false}
              className="min-h-[80px]"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="item-trajectory">Expected Trajectory (JSON, optional)</Label>
            <CodeEditor
              value={expectedTrajectory}
              onChange={handleExpectedTrajectoryChange}
              showCopyButton={false}
              className="min-h-[80px]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={addItem.isPending || trajectoryLoading || !selectedDatasetId || datasets.length === 0}
            >
              {addItem.isPending ? 'Saving...' : trajectoryLoading ? 'Loading trajectory...' : 'Save Item'}
            </Button>
          </div>
        </form>
      </SideDialog.Content>
    </SideDialog>
  );
}
