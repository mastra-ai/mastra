'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/ds/components/Dialog';
import { Button } from '@/ds/components/Button';
import { SchemaField } from './schema-field';
import { useDatasetMutations } from '../../hooks/use-dataset-mutations';
import { toast } from '@/lib/toast';

interface SchemaSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  datasetId: string;
  initialInputSchema?: Record<string, unknown> | null;
  initialOutputSchema?: Record<string, unknown> | null;
}

/**
 * Dialog for managing dataset input/output schemas.
 * Shows validation error if existing items fail schema validation.
 */
export function SchemaSettingsDialog({
  open,
  onOpenChange,
  datasetId,
  initialInputSchema,
  initialOutputSchema,
}: SchemaSettingsDialogProps) {
  const [inputSchema, setInputSchema] = useState<Record<string, unknown> | null>(initialInputSchema ?? null);
  const [outputSchema, setOutputSchema] = useState<Record<string, unknown> | null>(initialOutputSchema ?? null);
  const [validationError, setValidationError] = useState<{
    input?: string;
    output?: string;
    general?: string;
  }>({});

  const { updateDataset } = useDatasetMutations();

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setInputSchema(initialInputSchema ?? null);
      setOutputSchema(initialOutputSchema ?? null);
      setValidationError({});
    }
  }, [open, initialInputSchema, initialOutputSchema]);

  const handleSave = async () => {
    setValidationError({});

    try {
      await updateDataset.mutateAsync({
        datasetId,
        inputSchema,
        outputSchema,
      });
      toast.success('Schema settings saved');
      onOpenChange(false);
    } catch (err: unknown) {
      // Handle SchemaUpdateValidationError from API
      // This enforces success criterion #8: users cannot enable schema if items fail
      const error = err as { cause?: { failingItems?: unknown[] }; message?: string };
      if (error?.cause?.failingItems) {
        const failingItems = error.cause.failingItems;
        const count = failingItems.length;
        setValidationError({
          general: `${count} existing item(s) fail validation. Fix items or adjust schema.`,
        });
      } else {
        setValidationError({
          general: error?.message || 'Failed to update schema',
        });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Schema Settings</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-6 py-4 max-h-[70vh]">
          <p className="text-sm text-neutral3">
            Configure JSON Schema validation for dataset items. Imported schemas are copied and can be modified.
          </p>

          <SchemaField
            label="Input Schema"
            schemaType="input"
            value={inputSchema}
            onChange={setInputSchema}
            error={validationError.input}
          />

          <SchemaField
            label="Expected Output Schema"
            schemaType="output"
            value={outputSchema}
            onChange={setOutputSchema}
            error={validationError.output}
          />

          {validationError.general && (
            <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-md">
              <p className="text-sm text-red-200">{validationError.general}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-border1">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="light" onClick={handleSave} disabled={updateDataset.isPending}>
              {updateDataset.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
