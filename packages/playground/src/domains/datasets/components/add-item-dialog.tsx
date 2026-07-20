'use client';

import type { DatasetItemToolMock } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@mastra/playground-ui/components/Dialog';
import { Label } from '@mastra/playground-ui/components/Label';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useState } from 'react';
import { useDatasetMutations } from '../hooks/use-dataset-mutations';

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

/** Displays field-level validation errors */
function ValidationErrors({ field, errors }: { field: string; errors: Array<{ path: string; message: string }> }) {
  if (!errors.length) return null;

  return (
    <div className="mt-2 space-y-1">
      {errors.map((err, idx) => (
        <p key={idx} className="text-destructive text-xs">
          <code className="bg-destructive/10 rounded px-1">
            {field}
            {err.path !== '/' ? err.path : ''}
          </code>
          : {err.message}
        </p>
      ))}
    </div>
  );
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
  const [requestContext, setRequestContext] = useState('');
  const [validationErrors, setValidationErrors] = useState<SchemaValidationError | null>(null);
  const { addItem } = useDatasetMutations();

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

    let parsedTrajectory: unknown | undefined;
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
        requestContext: parsedRequestContext,
      });

      toast.success('Item added successfully');
      setValidationErrors(null);

      // Reset form
      setInput('{}');
      setGroundTruth('');
      setExpectedTrajectory('');
      setToolMocks('');
      setRequestContext('');
      onOpenChange(false);

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
    setInput('{}');
    setGroundTruth('');
    setExpectedTrajectory('');
    setToolMocks('');
    setRequestContext('');
    setValidationErrors(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Item</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="item-input">Input (JSON) *</Label>
              <CodeEditor value={input} onChange={handleInputChange} showCopyButton={false} className="min-h-[120px]" />
              {validationErrors?.field === 'input' && (
                <ValidationErrors field="input" errors={validationErrors.errors} />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-ground-truth">Ground Truth (JSON, optional)</Label>
              <CodeEditor
                value={groundTruth}
                onChange={handleGroundTruthChange}
                showCopyButton={false}
                className="min-h-[80px]"
              />
              {validationErrors?.field === 'groundTruth' && (
                <ValidationErrors field="groundTruth" errors={validationErrors.errors} />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-trajectory">Expected Trajectory (JSON, optional)</Label>
              <CodeEditor
                value={expectedTrajectory}
                onChange={setExpectedTrajectory}
                showCopyButton={false}
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-tool-mocks">Tool Mocks (JSON array, optional)</Label>
              <CodeEditor
                value={toolMocks}
                onChange={handleToolMocksChange}
                showCopyButton={false}
                className="min-h-[80px]"
              />
              {validationErrors?.field === 'toolMocks' && (
                <ValidationErrors field="toolMocks" errors={validationErrors.errors} />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-request-context">Request Context (JSON, optional)</Label>
              <CodeEditor
                value={requestContext}
                onChange={setRequestContext}
                showCopyButton={false}
                className="min-h-[80px]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={addItem.isPending}>
                {addItem.isPending ? 'Adding...' : 'Add Item'}
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
