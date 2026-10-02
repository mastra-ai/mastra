import { useMastraClient } from '@mastra/react';
import { DatabaseIcon } from 'lucide-react';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useDatasetSaveContext } from '../context/dataset-save-context-value';
import type { DatasetSaveContextValue } from '../context/dataset-save-context-value';
import { useDatasetMutations, useDatasets } from '@/domains/datasets';
import { Button } from '@/ds/components/Button';
import { CodeEditor } from '@/ds/components/CodeEditor';
import {
  Dialog,
  DialogAction,
  DialogCancel,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/ds/components/Dialog';
import { Field, FieldLabel } from '@/ds/components/Field';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/ds/components/Select';
import { Spinner } from '@/ds/components/Spinner';
import { Txt } from '@/ds/components/Txt';
import { controlStateColorTransition } from '@/ds/primitives/transitions';
import { quietTextHover } from '@/ds/primitives/typography';
import { cn } from '@/utils/cn';
import { toast } from '@/utils/toast';

function DatasetSaveDialog({
  open,
  onOpenChange,
  input,
  onInputChange,
  requestContext,
  initialGroundTruth = '',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  input: string;
  onInputChange: (value: string) => void;
  requestContext?: Record<string, unknown>;
  initialGroundTruth?: string;
}) {
  const [groundTruth, setGroundTruth] = useState(initialGroundTruth);
  const [selectedDatasetId, setSelectedDatasetId] = useState('');

  useEffect(() => {
    if (open) {
      setGroundTruth(initialGroundTruth);
    }
  }, [open, initialGroundTruth]);

  const { data, isLoading: isDatasetsLoading } = useDatasets();
  const { addItem } = useDatasetMutations();
  const datasets = useMemo(() => data?.datasets ?? [], [data?.datasets]);

  const handleSubmit = useCallback(async () => {
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
      const hasRequestContext = requestContext && Object.keys(requestContext).length > 0;
      await addItem.mutateAsync({
        datasetId: selectedDatasetId,
        input: parsedInput,
        groundTruth: parsedGroundTruth,
        ...(hasRequestContext ? { requestContext } : {}),
      });
      const targetDataset = datasets.find(d => d.id === selectedDatasetId);
      toast.success(`Item saved to "${targetDataset?.name}"`);
      onOpenChange(false);
      setSelectedDatasetId('');
      onInputChange('');
      setGroundTruth('');
    } catch (error) {
      toast.error(`Failed to save item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [input, groundTruth, selectedDatasetId, requestContext, addItem, datasets, onOpenChange, onInputChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} pending={addItem.isPending}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save to Dataset</DialogTitle>
          <DialogDescription>Save as a dataset item for evaluation.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Field>
            <FieldLabel>Dataset</FieldLabel>
            <Select
              value={selectedDatasetId}
              onValueChange={setSelectedDatasetId}
              disabled={addItem.isPending || isDatasetsLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={isDatasetsLoading ? 'Loading...' : 'Select a dataset'} />
              </SelectTrigger>
              <SelectContent>
                {datasets.length === 0 ? (
                  <Txt as="div" variant="body" tone="muted" className="px-2 py-4 text-center">
                    No datasets available
                  </Txt>
                ) : (
                  datasets.map(dataset => (
                    <SelectItem key={dataset.id} value={dataset.id}>
                      {dataset.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>Input (JSON)</FieldLabel>
            <CodeEditor value={input} onChange={onInputChange} showCopyButton={false} className="max-h-60 min-h-30" />
          </Field>

          <Field>
            <FieldLabel>Ground Truth (JSON, optional)</FieldLabel>
            <CodeEditor
              value={groundTruth}
              onChange={setGroundTruth}
              showCopyButton={false}
              className="max-h-40 min-h-20"
            />
          </Field>
        </DialogBody>
        <DialogFooter>
          <DialogCancel>Cancel</DialogCancel>
          <DialogAction onConfirm={handleSubmit} disabled={!selectedDatasetId || datasets.length === 0}>
            {addItem.isPending ? 'Saving...' : 'Save Item'}
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Dataset save action button shown on user messages in test chat mode.
 * Saves the individual message text as a dataset item.
 */
export interface DatasetSaveActionProps {
  /** Text of the message this action saves to a dataset. */
  messageText: string;
}

export function DatasetSaveAction({ messageText }: DatasetSaveActionProps) {
  const ctx = useDatasetSaveContext();
  if (!ctx?.enabled) return null;
  return <DatasetSaveActionInner messageText={messageText} />;
}

function DatasetSaveActionInner({ messageText }: DatasetSaveActionProps) {
  const ctx = useDatasetSaveContext();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [input, setInput] = useState('');

  const handleClick = useCallback(() => {
    setInput(JSON.stringify(messageText, null, 2));
    setDialogOpen(true);
  }, [messageText]);

  return (
    <>
      <Button
        variant="default"
        size="icon-md"
        tooltip="Save to dataset"
        className={cn(quietTextHover, 'bg-transparent')}
        onClick={handleClick}
      >
        <DatabaseIcon className="size-4" />
      </Button>
      <DatasetSaveDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        input={input}
        onInputChange={setInput}
        requestContext={ctx?.requestContext}
      />
    </>
  );
}

/**
 * Button shown at the bottom of the thread to save the full conversation history.
 * Only renders when dataset save context is enabled (test chat mode).
 */
export function SaveFullConversationAction() {
  const ctx = useDatasetSaveContext();
  if (!ctx?.enabled) return null;
  return <SaveFullConversationInner ctx={ctx} />;
}

function SaveFullConversationInner({ ctx }: { ctx: DatasetSaveContextValue }) {
  const client = useMastraClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [input, setInput] = useState('');
  const [groundTruth, setGroundTruth] = useState('');
  const [isFetching, setIsFetching] = useState(false);

  const handleClick = useCallback(async () => {
    setIsFetching(true);
    try {
      const result = await client.listThreadMessages(ctx.threadId, {
        agentId: ctx.agentId,
      });
      const messages = result?.messages ?? [];

      const lastAssistantIdx = messages.length - 1;
      const lastMessage = messages[lastAssistantIdx];
      if (lastMessage && lastMessage.role === 'assistant') {
        const inputMessages = messages.slice(0, lastAssistantIdx);
        setInput(JSON.stringify(inputMessages, null, 2));
        setGroundTruth(JSON.stringify(lastMessage, null, 2));
      } else {
        setInput(JSON.stringify(messages, null, 2));
        setGroundTruth('');
      }

      setDialogOpen(true);
    } catch (error) {
      toast.error(`Failed to fetch thread messages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsFetching(false);
    }
  }, [client, ctx.threadId, ctx.agentId]);

  return (
    <>
      <Txt
        as="button"
        variant="meta"
        type="button"
        onClick={handleClick}
        disabled={isFetching}
        className={cn(
          quietTextHover,
          controlStateColorTransition,
          'mx-auto flex cursor-pointer items-center gap-1.5 py-3 disabled:opacity-50',
        )}
      >
        {isFetching ? <Spinner className="size-3.5" /> : <DatabaseIcon className="size-3.5" />}
        Save full conversation to dataset
      </Txt>
      <DatasetSaveDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        input={input}
        onInputChange={setInput}
        requestContext={ctx.requestContext}
        initialGroundTruth={groundTruth}
      />
    </>
  );
}
