'use client';

import type { DatasetItemToolMock, AddDatasetItemParams } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { FieldBlock, fieldErrorId } from '@mastra/playground-ui/components/FormFieldBlocks';
import { SideDialog } from '@mastra/playground-ui/components/SideDialog';
import { toast } from '@mastra/playground-ui/utils/toast';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useDatasetMutations } from '../hooks/use-dataset-mutations';
import { DatasetItemScorerSelector } from './dataset-detail/dataset-item-scorer-selector';
import { DatasetFieldErrors } from './dataset-field-errors';

/** Schema validation error from API */
interface SchemaValidationError {
  field: 'input' | 'groundTruth' | 'toolMocks';
  errors: Array<{ path: string; message: string }>;
}

/** Parses API error message to extract schema validation details */
function parseValidationError(error: unknown): SchemaValidationError | null {
  if (!(error instanceof Error)) return null;

  // API error format: "HTTP error! status: 400 - {\"error\":\"...\",\"field\":\"...\",\"errors\":[...]}"
  const match = error.message.match(/- ({.*})$/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1]);
    if (parsed.field && Array.isArray(parsed.errors)) {
      return { field: parsed.field, errors: parsed.errors };
    }
  } catch {
    // Not valid JSON
  }
  return null;
}

export interface AddItemDialogProps {
  datasetId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddItemDialog({ datasetId, open, onOpenChange, onSuccess }: AddItemDialogProps) {
  const [input, setInput] = useState('{}');
  const [groundTruth, setGroundTruth] = useState('');
  const [expectedTrajectory, setExpectedTrajectory] = useState('');
  const [toolMocks, setToolMocks] = useState('');
  const [scorerOverrideEnabled, setScorerOverrideEnabled] = useState(false);
  const [selectedScorerIds, setSelectedScorerIds] = useState<string[]>([]);
  const [requestContext, setRequestContext] = useState('');
  const [validationErrors, setValidationErrors] = useState<SchemaValidationError | null>(null);
  const { addItem } = useDatasetMutations();

  const resetForm = () => {
    setInput('{}');
    setGroundTruth('');
    setExpectedTrajectory('');
    setToolMocks('');
    setScorerOverrideEnabled(false);
    setSelectedScorerIds([]);
    setRequestContext('');
    setValidationErrors(null);
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Parse and validate input JSON
    let parsedInput: unknown;
    try {
      parsedInput = JSON.parse(input);
    } catch {
      toast.error('Input must be valid JSON');
      return;
    }

    // Parse groundTruth if provided
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

    // Parse toolMocks if provided — must be a JSON array.
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

    // Parse requestContext if provided
    let parsedRequestContext: Record<string, unknown> | undefined;
    if (requestContext.trim()) {
      try {
        parsedRequestContext = JSON.parse(requestContext);
      } catch {
        toast.error('Request Context must be valid JSON');
        return;
      }
    }

    try {
      await addItem.mutateAsync({
        datasetId,
        input: parsedInput,
        groundTruth: parsedGroundTruth,
        expectedTrajectory: parsedTrajectory,
        toolMocks: parsedToolMocks,
        scorerIds: scorerOverrideEnabled ? selectedScorerIds : undefined,
        requestContext: parsedRequestContext,
      });

      toast.success('Item added successfully');
      handleDialogOpenChange(false);
      onSuccess?.();
    } catch (error) {
      // Check for schema validation error from API
      const schemaError = parseValidationError(error);
      if (schemaError) {
        setValidationErrors(schemaError);
      } else {
        toast.error(`Failed to add item: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  // Clear validation errors when input changes
  const handleInputChange = (value: string) => {
    setInput(value);
    if (validationErrors?.field === 'input') {
      setValidationErrors(null);
    }
  };

  // Clear validation errors when groundTruth changes
  const handleGroundTruthChange = (value: string) => {
    setGroundTruth(value);
    if (validationErrors?.field === 'groundTruth') {
      setValidationErrors(null);
    }
  };

  // Clear validation errors when toolMocks changes
  const handleToolMocksChange = (value: string) => {
    setToolMocks(value);
    if (validationErrors?.field === 'toolMocks') {
      setValidationErrors(null);
    }
  };

  const handleCancel = () => {
    handleDialogOpenChange(false);
  };

  return (
    <SideDialog
      dialogTitle="Add Item"
      dialogDescription="Create a new dataset item"
      isOpen={open}
      onClose={handleCancel}
      level={1}
    >
      <SideDialog.Top>Add Item</SideDialog.Top>

      <SideDialog.Content>
        <SideDialog.Header>
          <SideDialog.Heading>Add Item</SideDialog.Heading>
        </SideDialog.Header>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <FieldBlock.Label name="item-input" required>
              Input (JSON)
            </FieldBlock.Label>
            <CodeEditor
              id="input-item-input"
              aria-invalid={validationErrors?.field === 'input' ? true : undefined}
              aria-describedby={validationErrors?.field === 'input' ? fieldErrorId('item-input') : undefined}
              value={input}
              onChange={handleInputChange}
              showCopyButton={false}
              className="min-h-[240px]"
            />
            {validationErrors?.field === 'input' && (
              <DatasetFieldErrors name="item-input" field="input" errors={validationErrors.errors} />
            )}
          </div>

          <div className="grid gap-2">
            <FieldBlock.Label name="item-ground-truth">Ground Truth (JSON, optional)</FieldBlock.Label>
            <CodeEditor
              id="input-item-ground-truth"
              aria-invalid={validationErrors?.field === 'groundTruth' ? true : undefined}
              aria-describedby={
                validationErrors?.field === 'groundTruth' ? fieldErrorId('item-ground-truth') : undefined
              }
              value={groundTruth}
              onChange={handleGroundTruthChange}
              showCopyButton={false}
              className="min-h-[200px]"
            />
            {validationErrors?.field === 'groundTruth' && (
              <DatasetFieldErrors name="item-ground-truth" field="groundTruth" errors={validationErrors.errors} />
            )}
          </div>

          <div className="grid gap-2">
            <FieldBlock.Label name="item-trajectory">Expected Trajectory (JSON, optional)</FieldBlock.Label>
            <CodeEditor
              id="input-item-trajectory"
              value={expectedTrajectory}
              onChange={setExpectedTrajectory}
              showCopyButton={false}
              className="min-h-[200px]"
            />
          </div>

          <div className="grid gap-2">
            <FieldBlock.Label name="item-tool-mocks">Tool Mocks (JSON array, optional)</FieldBlock.Label>
            <CodeEditor
              id="input-item-tool-mocks"
              aria-invalid={validationErrors?.field === 'toolMocks' ? true : undefined}
              aria-describedby={validationErrors?.field === 'toolMocks' ? fieldErrorId('item-tool-mocks') : undefined}
              value={toolMocks}
              onChange={handleToolMocksChange}
              showCopyButton={false}
              className="min-h-[200px]"
            />
            {validationErrors?.field === 'toolMocks' && (
              <DatasetFieldErrors name="item-tool-mocks" field="toolMocks" errors={validationErrors.errors} />
            )}
          </div>

          <DatasetItemScorerSelector
            overrideEnabled={scorerOverrideEnabled}
            onOverrideEnabledChange={setScorerOverrideEnabled}
            selectedScorerIds={selectedScorerIds}
            onSelectedScorerIdsChange={setSelectedScorerIds}
            disabled={addItem.isPending}
          />

          <div className="grid gap-2">
            <FieldBlock.Label name="item-request-context">Request Context (JSON, optional)</FieldBlock.Label>
            <CodeEditor
              id="input-item-request-context"
              value={requestContext}
              onChange={setRequestContext}
              showCopyButton={false}
              className="min-h-[200px]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button icon={<X />} type="button" onClick={handleCancel}>
              Cancel
            </Button>
            <Button icon={<Plus />} type="submit" variant="primary" disabled={addItem.isPending}>
              {addItem.isPending ? 'Adding...' : 'Add Item'}
            </Button>
          </div>
        </form>
      </SideDialog.Content>
    </SideDialog>
  );
}
