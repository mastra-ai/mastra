'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/ds/components/Dialog';
import { Button } from '@/ds/components/Button';
import { Label } from '@/ds/components/Label';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { toast } from '@/lib/toast';
import { useDatasetMutations } from '../hooks/use-dataset-mutations';

/** Schema validation error from API */
interface SchemaValidationError {
  field: 'input' | 'groundTruth';
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

export interface AddItemDialogProps {
  datasetId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddItemDialog({ datasetId, open, onOpenChange, onSuccess }: AddItemDialogProps) {
  const [input, setInput] = useState('{}');
  const [groundTruth, setGroundTruth] = useState('');
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

    try {
      await addItem.mutateAsync({
        datasetId,
        input: parsedInput,
        groundTruth: parsedGroundTruth,
      });

      toast.success('Item added successfully');
      setValidationErrors(null);

      // Reset form
      setInput('{}');
      setGroundTruth('');
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

  const handleCancel = () => {
    setInput('{}');
    setGroundTruth('');
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

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="standard" size="default" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" variant="cta" size="default" disabled={addItem.isPending}>
                {addItem.isPending ? 'Adding...' : 'Add Item'}
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
