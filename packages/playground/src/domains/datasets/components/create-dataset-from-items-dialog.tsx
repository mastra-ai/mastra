'use client';

import type { AddDatasetItemParams, DatasetItem } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@mastra/playground-ui/components/Dialog';
import { Input } from '@mastra/playground-ui/components/Input';
import { Label } from '@mastra/playground-ui/components/Label';
import { DatasetsIcon } from '@mastra/playground-ui/icons/DatasetsIcon';
import { toast } from '@mastra/playground-ui/utils/toast';
import { X } from 'lucide-react';
import { useState } from 'react';
import { useDatasetMutations } from '../hooks/use-dataset-mutations';

type ExpectedTrajectory = AddDatasetItemParams['expectedTrajectory'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isExpectedStep(step: unknown): boolean {
  if (!isRecord(step) || typeof step.name !== 'string') return false;

  return (
    step.stepType === undefined ||
    step.stepType === 'tool_call' ||
    step.stepType === 'mcp_tool_call' ||
    step.stepType === 'model_generation' ||
    step.stepType === 'agent_run' ||
    step.stepType === 'workflow_step' ||
    step.stepType === 'workflow_run' ||
    step.stepType === 'workflow_conditional' ||
    step.stepType === 'workflow_parallel' ||
    step.stepType === 'workflow_loop' ||
    step.stepType === 'workflow_sleep' ||
    step.stepType === 'workflow_wait_event' ||
    step.stepType === 'processor_run'
  );
}

function isExpectedTrajectory(value: unknown): value is ExpectedTrajectory {
  if (value === undefined || value === null) return true;
  if (!isRecord(value)) return false;
  if (value.steps !== undefined && (!Array.isArray(value.steps) || !value.steps.every(isExpectedStep))) return false;
  if (
    value.ordering !== undefined &&
    value.ordering !== 'strict' &&
    value.ordering !== 'relaxed' &&
    value.ordering !== 'unordered'
  ) {
    return false;
  }
  if (value.allowRepeatedSteps !== undefined && typeof value.allowRepeatedSteps !== 'boolean') return false;
  if (value.noRedundantCalls !== undefined && typeof value.noRedundantCalls !== 'boolean') return false;
  if (value.maxSteps !== undefined && !Number.isInteger(value.maxSteps)) return false;
  if (value.maxTotalTokens !== undefined && !Number.isInteger(value.maxTotalTokens)) return false;
  if (value.maxTotalDurationMs !== undefined && typeof value.maxTotalDurationMs !== 'number') return false;
  if (value.maxRetriesPerTool !== undefined && !Number.isInteger(value.maxRetriesPerTool)) return false;
  if (value.blacklistedTools !== undefined && !isStringArray(value.blacklistedTools)) return false;
  if (
    value.blacklistedSequences !== undefined &&
    (!Array.isArray(value.blacklistedSequences) || !value.blacklistedSequences.every(isStringArray))
  ) {
    return false;
  }
  return true;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

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
      const dataset = await createDataset.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
      });

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await addItem.mutateAsync({
          datasetId: dataset.id,
          input: item.input,
          groundTruth: item.groundTruth,
          expectedTrajectory: isExpectedTrajectory(item.expectedTrajectory) ? item.expectedTrajectory : undefined,
          toolMocks: item.toolMocks ?? undefined,
          requestContext: item.requestContext ?? undefined,
          metadata: item.metadata ?? undefined,
        });
        setProgress(i + 1);
      }

      toast.success(`Dataset created with ${items.length} items`);

      setName('');
      setDescription('');
      setIsCreating(false);
      setProgress(0);
      onOpenChange(false);

      onSuccess?.(dataset.id);
    } catch (error) {
      toast.error(`Failed to create dataset: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsCreating(false);
      setProgress(0);
    }
  };

  const handleCancel = () => {
    if (isCreating) return;
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

            <p className="text-muted-foreground text-body">
              {items.length} item{items.length !== 1 ? 's' : ''} will be copied to the new dataset
            </p>

            {isCreating && (
              <div className="space-y-2">
                <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full transition-all duration-200"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-muted-foreground text-body">
                  Copying items: {progress} / {items.length}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button icon={<X />} type="button" onClick={handleCancel} disabled={isCreating}>
                Cancel
              </Button>
              <Button icon={<DatasetsIcon />} type="submit" variant="primary" disabled={isCreating || !name.trim()}>
                {isCreating ? `Creating... (${progress}/${items.length})` : 'Create Dataset'}
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
