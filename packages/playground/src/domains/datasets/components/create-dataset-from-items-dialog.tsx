'use client';

import type { AddDatasetItemParams, DatasetItem } from '@mastra/client-js';
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
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useDatasetMutations } from '@mastra/react/hooks/datasets';
import { useState } from 'react';

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

  const progressPercent = items.length > 0 ? (progress / items.length) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} pending={isCreating}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Dataset from Items</DialogTitle>
        </DialogHeader>
        <Form onSubmit={handleSubmit}>
          <DialogBody>
            <Field>
              <FieldLabel required>Name</FieldLabel>
              <Input
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter dataset name"
                autoFocus
                disabled={isCreating}
              />
            </Field>

            <Field>
              <FieldLabel>Description</FieldLabel>
              <Input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Enter dataset description (optional)"
                disabled={isCreating}
              />
            </Field>

            <Txt tone="muted">
              {items.length} item{items.length !== 1 ? 's' : ''} will be copied to the new dataset
            </Txt>

            {isCreating && (
              <div className="space-y-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-success-indicator transition-all duration-200"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <Txt tone="muted">
                  Copying items: {progress} / {items.length}
                </Txt>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <DialogCancel
              onClick={() => {
                setName('');
                setDescription('');
              }}
            >
              Cancel
            </DialogCancel>
            <DialogAction type="submit" disabled={!name.trim()}>
              {isCreating ? `Creating... (${progress}/${items.length})` : 'Create Dataset'}
            </DialogAction>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
