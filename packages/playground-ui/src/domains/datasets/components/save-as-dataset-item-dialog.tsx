'use client';

import type { DatasetItemToolMock, AddDatasetItemParams } from '@mastra/client-js';
import { useDatasetMutations, useDatasets } from '@mastra/react/hooks/datasets';
import { Check, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/ds/components/Button';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { DataPanel } from '@/ds/components/DataPanel';
import type { DataPanelProps } from '@/ds/components/DataPanel';
import { Field, FieldLabel } from '@/ds/components/Field';
import { Form } from '@/ds/components/Form';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/ds/components/Select';
import { Txt } from '@/ds/components/Txt';
import { useLinkComponent } from '@/lib/framework';
import { toast } from '@/utils/toast';

const CREATE_DATASET_VALUE = '__create-dataset__';

export type CreateDatasetDialogRenderProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (datasetId: string) => void;
};

export type SaveAsDatasetItemDialogProps = {
  initialInput: string;
  initialGroundTruth: string;
  /** JSON string of the expected trajectory */
  initialTrajectory?: string;
  /** Whether the trajectory is still being fetched */
  trajectoryLoading?: boolean;
  /** JSON string of the tool mocks (array of { toolName, args, output }) */
  initialToolMocks?: string;
  breadcrumb: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  /** Sibling-drawer elevation (see `DataPanel`); render after the panel it covers. */
  depth?: DataPanelProps['depth'];
  source?: {
    type: 'csv' | 'json' | 'trace' | 'llm' | 'experiment-result' | 'candidate-screener';
    referenceId?: string;
  };
  /**
   * Renders a create-dataset dialog. When set, the Dataset select offers "Create dataset" as its
   * first option and selects the new dataset once created.
   */
  renderCreateDatasetDialog?: (props: CreateDatasetDialogRenderProps) => ReactNode;
};

export function SaveAsDatasetItemDialog({
  initialInput,
  initialGroundTruth,
  initialTrajectory,
  trajectoryLoading,
  initialToolMocks,
  breadcrumb,
  isOpen,
  onClose,
  depth = 2,
  source,
  renderCreateDatasetDialog,
}: SaveAsDatasetItemDialogProps) {
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [isCreateDatasetOpen, setIsCreateDatasetOpen] = useState(false);
  const [input, setInput] = useState('');
  const [groundTruth, setGroundTruth] = useState('');
  const [expectedTrajectory, setExpectedTrajectory] = useState('');
  const [toolMocks, setToolMocks] = useState('');
  // source is passed through — not editable in the UI

  const { data, isLoading: isDatasetsLoading } = useDatasets();
  const { addItem } = useDatasetMutations();
  const { navigate, paths } = useLinkComponent();

  const datasets = data?.datasets ?? [];
  // A just-created dataset is selected before the list refetch returns it; treat that gap as loading.
  const isSelectedDatasetListed = datasets.some(dataset => dataset.id === selectedDatasetId);
  const isSelectionLoading = isDatasetsLoading || (!!selectedDatasetId && !isSelectedDatasetListed);

  const handleDatasetChange = (value: string) => {
    if (value === CREATE_DATASET_VALUE) {
      setIsCreateDatasetOpen(true);
      return;
    }
    setSelectedDatasetId(value);
  };

  const prevOpenRef = useRef(false);
  const trajectorySeededRef = useRef(false);
  const inputSeededRef = useRef(false);
  const groundTruthSeededRef = useRef(false);
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      setInput(initialInput);
      setGroundTruth(initialGroundTruth);
      setExpectedTrajectory(initialTrajectory ?? '');
      setToolMocks(initialToolMocks ?? '');
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
  }, [isOpen, initialInput, initialGroundTruth, initialTrajectory, initialToolMocks]);

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

  const handleToolMocksChange = (value: string) => {
    setToolMocks(value);
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

    let parsedTrajectory: AddDatasetItemParams['expectedTrajectory'];
    if (expectedTrajectory.trim()) {
      try {
        parsedTrajectory = JSON.parse(expectedTrajectory);
      } catch {
        toast.error('Expected Trajectory must be valid JSON');
        return;
      }
    }

    let parsedToolMocks: DatasetItemToolMock[] | undefined;
    if (toolMocks.trim()) {
      try {
        const parsed = JSON.parse(toolMocks);
        if (!Array.isArray(parsed)) {
          toast.error('Tool Mocks must be a JSON array');
          return;
        }
        parsedToolMocks = parsed as DatasetItemToolMock[];
      } catch {
        toast.error('Tool Mocks must be valid JSON');
        return;
      }
    }

    try {
      const item = await addItem.mutateAsync({
        datasetId: selectedDatasetId,
        input: parsedInput,
        groundTruth: parsedGroundTruth,
        expectedTrajectory: parsedTrajectory,
        toolMocks: parsedToolMocks,
        ...(source ? { source } : {}),
      });

      const targetDataset = datasets.find(d => d.id === selectedDatasetId);
      // Opens the dataset with the new item's drawer; apps without that route return ''.
      const itemHref = paths.datasetItemLink(selectedDatasetId, item.id);
      toast.success(`Added to "${targetDataset?.name}"`, {
        action: itemHref ? { label: 'Go to dataset', onClick: () => navigate(itemHref) } : undefined,
      });

      setSelectedDatasetId('');
      setInput('{}');
      setGroundTruth('');
      setExpectedTrajectory('');
      setToolMocks('');
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
    <DataPanel
      open={isOpen}
      onClose={handleCancel}
      title="Save as Dataset Item"
      description="Save data as a dataset item"
      depth={depth}
    >
      <DataPanel.Header>
        <DataPanel.Heading>
          Save as Dataset Item
          <b className="whitespace-nowrap">{breadcrumb}</b>
        </DataPanel.Heading>
        <DataPanel.HeaderActions>
          <DataPanel.CloseButton icon="x" onClick={handleCancel} label="Close save as dataset item" tooltip="Close" />
        </DataPanel.HeaderActions>
      </DataPanel.Header>

      <DataPanel.Content>
        <Form onSubmit={handleSubmit}>
          <Field>
            <FieldLabel required>Dataset</FieldLabel>
            <Select
              // Base UI resets an unmatched non-null value to null when items change, which would wipe a
              // just-created dataset before the refetch lists it; null means "no selection" and is left alone.
              value={isSelectedDatasetListed ? selectedDatasetId : null}
              onValueChange={handleDatasetChange}
              disabled={addItem.isPending || isSelectionLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={isSelectionLoading ? 'Loading datasets...' : 'Select a dataset'} />
              </SelectTrigger>
              <SelectContent>
                {renderCreateDatasetDialog && <SelectItem value={CREATE_DATASET_VALUE}>Create dataset</SelectItem>}
                {datasets.length === 0
                  ? !renderCreateDatasetDialog && (
                      <Txt as="p" variant="body" tone="muted" className="px-2 py-4 text-center">
                        No datasets available
                      </Txt>
                    )
                  : datasets.map(dataset => (
                      <SelectItem key={dataset.id} value={dataset.id}>
                        {dataset.name}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel required>Input (JSON)</FieldLabel>
            <CodeEditor value={input} onChange={handleInputChange} showCopyButton={false} className="min-h-30" />
          </Field>

          <Field>
            <FieldLabel>Ground Truth (JSON, optional)</FieldLabel>
            <CodeEditor
              value={groundTruth}
              onChange={handleGroundTruthChange}
              showCopyButton={false}
              className="min-h-20"
            />
          </Field>

          <Field>
            <FieldLabel>Expected Trajectory (JSON, optional)</FieldLabel>
            <CodeEditor
              value={expectedTrajectory}
              onChange={handleExpectedTrajectoryChange}
              showCopyButton={false}
              className="min-h-20"
            />
          </Field>

          <Field>
            <FieldLabel>Tool Mocks (JSON, optional)</FieldLabel>
            <CodeEditor
              value={toolMocks}
              onChange={handleToolMocksChange}
              showCopyButton={false}
              className="min-h-20"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-4">
            <Button icon={<X />} type="button" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              icon={<Check />}
              type="submit"
              variant="default"
              disabled={addItem.isPending || trajectoryLoading || !isSelectedDatasetListed}
            >
              {addItem.isPending ? 'Saving...' : trajectoryLoading ? 'Loading...' : 'Save item'}
            </Button>
          </div>
        </Form>
      </DataPanel.Content>

      {/* Rendered inside the drawer so the dialog nests in its focus scope instead of dismissing it. */}
      {renderCreateDatasetDialog?.({
        open: isCreateDatasetOpen,
        onOpenChange: setIsCreateDatasetOpen,
        onSuccess: setSelectedDatasetId,
      })}
    </DataPanel>
  );
}
