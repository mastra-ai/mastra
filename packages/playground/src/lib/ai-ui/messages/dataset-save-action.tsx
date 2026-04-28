import { useMessage } from '@assistant-ui/react';
import {
  Button,
  CodeEditor,
  IconButton,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Spinner,
  Icon,
  toast,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@mastra/playground-ui';
import { useMastraClient } from '@mastra/react';
import { DatabaseIcon, Save } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';

import { useDatasetSaveContext } from '../context/dataset-save-context';
import { useDatasetMutations } from '@/domains/datasets/hooks/use-dataset-mutations';
import { useDatasets } from '@/domains/datasets/hooks/use-datasets';

/** Extract text content from a thread message's content parts */
function extractTextFromParts(content: readonly { type: string; text?: string }[]): string {
  return content
    .filter(part => part.type === 'text' && part.text)
    .map(part => part.text!)
    .join('\n');
}

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

  // Sync ground truth when dialog opens with new initial value
  useEffect(() => {
    if (open) {
      setGroundTruth(initialGroundTruth);
    }
  }, [open, initialGroundTruth]);

  const { data, isLoading: isDatasetsLoading } = useDatasets();
  const { addItem } = useDatasetMutations();
  const datasets = data?.datasets ?? [];

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Save to Dataset</DialogTitle>
          <DialogDescription>Save as a dataset item for evaluation.</DialogDescription>
        </DialogHeader>
        <DialogBody className="py-1 space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="ds-target">Dataset</Label>
            <Select
              value={selectedDatasetId}
              onValueChange={setSelectedDatasetId}
              disabled={addItem.isPending || isDatasetsLoading}
            >
              <SelectTrigger id="ds-target">
                <SelectValue placeholder={isDatasetsLoading ? 'Loading...' : 'Select a dataset'} />
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
            <Label>Input (JSON)</Label>
            <CodeEditor
              value={input}
              onChange={onInputChange}
              showCopyButton={false}
              className="min-h-[120px] max-h-[240px]"
            />
          </div>

          <div className="grid gap-2">
            <Label>Ground Truth (JSON, optional)</Label>
            <CodeEditor
              value={groundTruth}
              onChange={setGroundTruth}
              showCopyButton={false}
              className="min-h-[80px] max-h-[160px]"
            />
          </div>
        </DialogBody>
        <DialogFooter className="px-6">
          <Button variant="default" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={addItem.isPending || !selectedDatasetId || datasets.length === 0}
          >
            <Icon size="sm">
              <Save />
            </Icon>
            {addItem.isPending ? 'Saving...' : 'Save Item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Dataset save action button shown on user messages in test chat mode.
 * Saves the individual message text as a dataset item.
 */
export function DatasetSaveAction() {
  const ctx = useDatasetSaveContext();
  if (!ctx?.enabled) return null;
  return <DatasetSaveActionInner />;
}

function DatasetSaveActionInner() {
  const ctx = useDatasetSaveContext();
  const message = useMessage();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [input, setInput] = useState('');

  const handleClick = useCallback(() => {
    const text = extractTextFromParts(message.content as readonly { type: string; text?: string }[]);
    setInput(JSON.stringify(text, null, 2));
    setDialogOpen(true);
  }, [message.content]);

  return (
    <>
      <IconButton
        variant="light"
        size="md"
        tooltip="Save to dataset"
        className="bg-transparent text-neutral3 hover:text-neutral6"
        onClick={handleClick}
      >
        <DatabaseIcon className="h-4 w-4" />
      </IconButton>
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
  return <SaveFullConversationInner />;
}

function SaveFullConversationInner() {
  const ctx = useDatasetSaveContext()!;
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

      // Split: everything up to (and including) the last user message is input,
      // the final assistant response becomes the ground truth seed
      const lastAssistantIdx = messages.length - 1;
      const lastMessage = messages[lastAssistantIdx];
      if (lastMessage && lastMessage.role === 'assistant') {
        const inputMessages = messages.slice(0, lastAssistantIdx);
        setInput(JSON.stringify(inputMessages, null, 2));
        setGroundTruth(JSON.stringify(lastMessage, null, 2));
      } else {
        // No trailing assistant message — use all messages as input
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
      <button
        type="button"
        onClick={handleClick}
        disabled={isFetching}
        className="flex items-center gap-1.5 text-neutral3 hover:text-neutral5 transition-colors mx-auto py-3 text-ui-xs leading-ui-xs cursor-pointer disabled:opacity-50"
      >
        {isFetching ? <Spinner className="h-3.5 w-3.5" /> : <DatabaseIcon className="h-3.5 w-3.5" />}
        Save full conversation to dataset
      </button>
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
