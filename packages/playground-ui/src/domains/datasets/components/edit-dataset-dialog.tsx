'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/ds/components/Dialog';
import { Button } from '@/ds/components/Button';
import { Input } from '@/ds/components/Input';
import { Label } from '@/ds/components/Label';
import { toast } from '@/lib/toast';
import { useDatasetMutations } from '../hooks/use-dataset-mutations';
import { SchemaConfigSection } from './schema-config-section';

export interface EditDatasetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dataset: {
    id: string;
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown> | null;
    groundTruthSchema?: Record<string, unknown> | null;
  };
  onSuccess?: () => void;
}

export function EditDatasetDialog({ open, onOpenChange, dataset, onSuccess }: EditDatasetDialogProps) {
  const [name, setName] = useState(dataset.name);
  const [description, setDescription] = useState(dataset.description ?? '');
  const [inputSchema, setInputSchema] = useState<Record<string, unknown> | null>(dataset.inputSchema ?? null);
  const [groundTruthSchema, setGroundTruthSchema] = useState<Record<string, unknown> | null>(
    dataset.groundTruthSchema ?? null,
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const { updateDataset } = useDatasetMutations();

  // Sync form state when dataset prop changes
  useEffect(() => {
    setName(dataset.name);
    setDescription(dataset.description ?? '');
    setInputSchema(dataset.inputSchema ?? null);
    setGroundTruthSchema(dataset.groundTruthSchema ?? null);
    setValidationError(null);
  }, [dataset.name, dataset.description, dataset.inputSchema, dataset.groundTruthSchema]);

  const handleSchemaChange = (schemas: {
    inputSchema: Record<string, unknown> | null;
    outputSchema: Record<string, unknown> | null;
  }) => {
    setInputSchema(schemas.inputSchema);
    setGroundTruthSchema(schemas.outputSchema);
    // Clear validation error when user changes schema
    setValidationError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!name.trim()) {
      toast.error('Dataset name is required');
      return;
    }

    try {
      await updateDataset.mutateAsync({
        datasetId: dataset.id,
        name: name.trim(),
        description: description.trim() || undefined,
        inputSchema,
        groundTruthSchema,
      });

      toast.success('Dataset updated successfully');
      onOpenChange(false);
      onSuccess?.();
    } catch (err: unknown) {
      // Handle validation errors (existing items may fail new schema)
      const error = err as { cause?: { failingItems?: unknown[] }; message?: string };
      if (error?.cause?.failingItems) {
        const count = error.cause.failingItems.length;
        setValidationError(`${count} existing item(s) fail validation. Fix items or adjust schema.`);
      } else {
        toast.error(`Failed to update dataset: ${error?.message || 'Unknown error'}`);
      }
    }
  };

  const handleCancel = () => {
    // Reset to original values
    setName(dataset.name);
    setDescription(dataset.description ?? '');
    setInputSchema(dataset.inputSchema ?? null);
    setGroundTruthSchema(dataset.groundTruthSchema ?? null);
    setValidationError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Dataset</DialogTitle>
        </DialogHeader>
        <DialogBody className="max-h-[70vh] overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-dataset-name">Name *</Label>
              <Input
                id="edit-dataset-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter dataset name"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-dataset-description">Description</Label>
              <Input
                id="edit-dataset-description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Enter dataset description (optional)"
              />
            </div>

            <SchemaConfigSection
              inputSchema={inputSchema}
              outputSchema={groundTruthSchema}
              onChange={handleSchemaChange}
              disabled={updateDataset.isPending}
              defaultOpen={!!(dataset.inputSchema || dataset.groundTruthSchema)}
            />

            {validationError && (
              <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-md">
                <p className="text-sm text-red-200">{validationError}</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="standard" size="default" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" variant="cta" size="default" disabled={updateDataset.isPending || !name.trim()}>
                {updateDataset.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
