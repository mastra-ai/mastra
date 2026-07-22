'use client';

import type { DatasetItem, DatasetItemToolMock } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { Input } from '@mastra/playground-ui/components/Input';
import { Label } from '@mastra/playground-ui/components/Label';
import { toast } from '@mastra/playground-ui/utils/toast';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useDatasetMutations } from '../../hooks/use-dataset-mutations';

interface SchemaValidationError {
  field: 'input' | 'groundTruth' | 'toolMocks';
  errors: Array<{ path: string; message: string }>;
}

function parseValidationError(error: unknown): SchemaValidationError | null {
  if (!(error instanceof Error)) return null;

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

function ValidationErrors({ field, errors }: { field: string; errors: Array<{ path: string; message: string }> }) {
  if (!errors.length) return null;

  return (
    <div className="mt-2 space-y-1">
      {errors.map((err, idx) => (
        <p key={idx} className="text-xs text-destructive">
          <code className="bg-destructive/10 px-1 rounded">
            {field}
            {err.path !== '/' ? err.path : ''}
          </code>
          : {err.message}
        </p>
      ))}
    </div>
  );
}

export interface EditModeContentProps {
  inputValue: string;
  setInputValue: (value: string) => void;
  groundTruthValue: string;
  setGroundTruthValue: (value: string) => void;
  metadataValue: string;
  setMetadataValue: (value: string) => void;
  trajectoryValue: string;
  setTrajectoryValue: (value: string) => void;
  toolMocksValue: string;
  setToolMocksValue: (value: string) => void;
  requestContextValue: string;
  setRequestContextValue: (value: string) => void;
  validationErrors: SchemaValidationError | null;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  children?: ReactNode;
}

export function EditModeContent({
  inputValue,
  setInputValue,
  groundTruthValue,
  setGroundTruthValue,
  metadataValue,
  setMetadataValue,
  trajectoryValue,
  setTrajectoryValue,
  toolMocksValue,
  setToolMocksValue,
  requestContextValue,
  setRequestContextValue,
  validationErrors,
  onSave,
  onCancel,
  isSaving,
  children,
}: EditModeContentProps) {
  return (
    <>
      <div className="mb-4">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <Pencil className="w-5 h-5" /> Edit Item
        </h3>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label>Input (JSON) *</Label>
          <CodeEditor value={inputValue} onChange={setInputValue} showCopyButton={false} className="min-h-[120px]" />
          {validationErrors?.field === 'input' && <ValidationErrors field="input" errors={validationErrors.errors} />}
        </div>

        <div className="space-y-2">
          <Label>Ground Truth (JSON, optional)</Label>
          <CodeEditor
            value={groundTruthValue}
            onChange={setGroundTruthValue}
            showCopyButton={false}
            className="min-h-[100px]"
          />
          {validationErrors?.field === 'groundTruth' && (
            <ValidationErrors field="groundTruth" errors={validationErrors.errors} />
          )}
        </div>

        <div className="space-y-2">
          <Label>Expected Trajectory (JSON, optional)</Label>
          <CodeEditor
            value={trajectoryValue}
            onChange={setTrajectoryValue}
            showCopyButton={false}
            className="min-h-[80px]"
          />
        </div>

        <div className="space-y-2">
          <Label>Tool Mocks (JSON array, optional)</Label>
          <p className="text-xs text-muted-foreground">
            Ordered static mocks served in place of executing the tool. Each entry is{' '}
            <code>{`{ "toolName", "args", "output" }`}</code>. Calling a mocked tool with non-matching args fails the
            item; unmocked tools run live.
          </p>
          <CodeEditor
            value={toolMocksValue}
            onChange={setToolMocksValue}
            showCopyButton={false}
            className="min-h-[100px]"
          />
          {validationErrors?.field === 'toolMocks' && (
            <ValidationErrors field="toolMocks" errors={validationErrors.errors} />
          )}
        </div>

        {children}

        <div className="space-y-2">
          <Label>Request Context (JSON, optional)</Label>
          <CodeEditor
            value={requestContextValue}
            onChange={setRequestContextValue}
            showCopyButton={false}
            className="min-h-[80px]"
          />
        </div>

        <div className="space-y-2">
          <Label>Metadata (JSON, optional)</Label>
          <CodeEditor
            value={metadataValue}
            onChange={setMetadataValue}
            showCopyButton={false}
            className="min-h-[80px]"
          />
        </div>

        <div className="flex gap-2 pt-4">
          <Button variant="primary" onClick={onSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
        </div>
      </div>
    </>
  );
}

const formatOptionalJson = (value: unknown) => (value == null ? '' : JSON.stringify(value, null, 2));

export interface DatasetItemEditFormProps {
  item: DatasetItem;
  onSuccess: () => void;
  onCancel: () => void;
}

export function DatasetItemEditForm({ item, onSuccess, onCancel }: DatasetItemEditFormProps) {
  const [inputValue, setInputValue] = useState(() => JSON.stringify(item.input, null, 2));
  const [groundTruthValue, setGroundTruthValue] = useState(() => formatOptionalJson(item.groundTruth));
  const [metadataValue, setMetadataValue] = useState(() => formatOptionalJson(item.metadata));
  const [trajectoryValue, setTrajectoryValue] = useState(() => formatOptionalJson(item.expectedTrajectory));
  const [toolMocksValue, setToolMocksValue] = useState(() =>
    item.toolMocks?.length ? JSON.stringify(item.toolMocks, null, 2) : '',
  );
  const [timeoutValue, setTimeoutValue] = useState(() => item.timeout?.toString() ?? '');
  const [requestContextValue, setRequestContextValue] = useState(() => formatOptionalJson(item.requestContext));
  const [validationErrors, setValidationErrors] = useState<SchemaValidationError | null>(null);
  const { updateItem } = useDatasetMutations();

  const handleSave = async () => {
    let parsedInput: unknown;
    try {
      parsedInput = JSON.parse(inputValue);
    } catch {
      toast.error('Input must be valid JSON');
      return;
    }

    let parsedGroundTruth: unknown | undefined;
    if (groundTruthValue.trim()) {
      try {
        parsedGroundTruth = JSON.parse(groundTruthValue);
      } catch {
        toast.error('Ground Truth must be valid JSON');
        return;
      }
    }

    let parsedMetadata: Record<string, unknown> | undefined;
    if (metadataValue.trim()) {
      try {
        parsedMetadata = JSON.parse(metadataValue);
      } catch {
        toast.error('Metadata must be valid JSON');
        return;
      }
    }

    let parsedTrajectory: unknown | null = null;
    if (trajectoryValue.trim()) {
      try {
        parsedTrajectory = JSON.parse(trajectoryValue);
      } catch {
        toast.error('Expected Trajectory must be valid JSON');
        return;
      }
    }

    let parsedToolMocks: DatasetItemToolMock[] | undefined;
    if (toolMocksValue.trim()) {
      try {
        const parsed = JSON.parse(toolMocksValue);
        if (!Array.isArray(parsed)) {
          toast.error('Tool Mocks must be a JSON array');
          return;
        }
        parsedToolMocks = parsed;
      } catch {
        toast.error('Tool Mocks must be valid JSON');
        return;
      }
    } else {
      parsedToolMocks = [];
    }

    let parsedTimeout: number | undefined;
    if (timeoutValue.trim()) {
      const timeout = Number(timeoutValue);
      if (!Number.isFinite(timeout) || !Number.isInteger(timeout) || timeout <= 0) {
        toast.error('Item timeout must be a positive whole number');
        return;
      }
      parsedTimeout = timeout;
    } else if (item.timeout !== undefined) {
      toast.error('An existing item timeout cannot be cleared; enter a positive whole number');
      return;
    }

    let parsedRequestContext: Record<string, unknown> | undefined;
    if (requestContextValue.trim()) {
      try {
        parsedRequestContext = JSON.parse(requestContextValue);
      } catch {
        toast.error('Request Context must be valid JSON');
        return;
      }
    }

    try {
      await updateItem.mutateAsync({
        datasetId: item.datasetId,
        itemId: item.id,
        input: parsedInput,
        groundTruth: parsedGroundTruth,
        metadata: parsedMetadata,
        expectedTrajectory: parsedTrajectory,
        toolMocks: parsedToolMocks,
        timeout: parsedTimeout,
        requestContext: parsedRequestContext,
      });

      toast.success('Item updated successfully');
      setValidationErrors(null);
      onSuccess();
    } catch (error) {
      const schemaError = parseValidationError(error);
      if (schemaError) {
        setValidationErrors(schemaError);
      } else {
        toast.error(`Failed to update item: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  const handleInputValueChange = (value: string) => {
    setInputValue(value);
    if (validationErrors?.field === 'input') {
      setValidationErrors(null);
    }
  };

  const handleGroundTruthValueChange = (value: string) => {
    setGroundTruthValue(value);
    if (validationErrors?.field === 'groundTruth') {
      setValidationErrors(null);
    }
  };

  const handleToolMocksValueChange = (value: string) => {
    setToolMocksValue(value);
    if (validationErrors?.field === 'toolMocks') {
      setValidationErrors(null);
    }
  };

  return (
    <EditModeContent
      inputValue={inputValue}
      setInputValue={handleInputValueChange}
      groundTruthValue={groundTruthValue}
      setGroundTruthValue={handleGroundTruthValueChange}
      metadataValue={metadataValue}
      setMetadataValue={setMetadataValue}
      trajectoryValue={trajectoryValue}
      setTrajectoryValue={setTrajectoryValue}
      toolMocksValue={toolMocksValue}
      setToolMocksValue={handleToolMocksValueChange}
      requestContextValue={requestContextValue}
      setRequestContextValue={setRequestContextValue}
      validationErrors={validationErrors}
      onSave={handleSave}
      onCancel={onCancel}
      isSaving={updateItem.isPending}
    >
      <div className="space-y-2">
        <Label htmlFor="edit-item-timeout">Item timeout (ms, optional)</Label>
        <p className="text-xs text-muted-foreground">
          Overrides the experiment-level item timeout. Enter a positive whole number of milliseconds.
        </p>
        <Input
          id="edit-item-timeout"
          type="number"
          min={1}
          step={1}
          value={timeoutValue}
          onChange={event => setTimeoutValue(event.target.value)}
        />
      </div>
    </EditModeContent>
  );
}
