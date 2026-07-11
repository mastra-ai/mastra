'use client';
import { Button } from '@mastra/playground-ui/components/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@mastra/playground-ui/components/Dialog';
import { SelectFieldBlock } from '@mastra/playground-ui/components/FormFieldBlocks';
import { Input } from '@mastra/playground-ui/components/Input';
import { Label } from '@mastra/playground-ui/components/Label';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useState } from 'react';
import { useDatasetMutations } from '../hooks/use-dataset-mutations';
import { SchemaConfigSection } from './schema-config-section';
import type { DatasetTargetType } from './target-type-options';
import { DATASET_TARGET_TYPE_OPTIONS } from './target-type-options';

export interface CreateDatasetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (datasetId: string) => void;
  /** If provided, auto-attaches the dataset to this target on create */
  targetType?: DatasetTargetType;
  targetIds?: string[];
}

export function CreateDatasetDialog({
  open,
  onOpenChange,
  onSuccess,
  targetType,
  targetIds,
}: CreateDatasetDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [inputSchema, setInputSchema] = useState<Record<string, unknown> | null>(null);
  const [groundTruthSchema, setGroundTruthSchema] = useState<Record<string, unknown> | null>(null);
  const [requestContextSchema, setRequestContextSchema] = useState<Record<string, unknown> | null>(null);
  const [showCustomSchema, setShowCustomSchema] = useState(!targetType);
  // Only relevant for the generic (non-scoped) create. When the dialog is opened from an agent/
  // workflow context, `targetType` is supplied via props and this picker is hidden.
  const [selectedTargetType, setSelectedTargetType] = useState<DatasetTargetType | ''>('');
  const { createDataset } = useDatasetMutations();

  // Props win when the dialog is pre-scoped to a target; otherwise use the user's pick (if any).
  const isPreScoped = Boolean(targetType);
  const effectiveTargetType = targetType ?? (selectedTargetType || undefined);

  const handleSchemaChange = (schemas: {
    inputSchema: Record<string, unknown> | null;
    outputSchema: Record<string, unknown> | null;
    requestContextSchema: Record<string, unknown> | null;
  }) => {
    setInputSchema(schemas.inputSchema);
    setGroundTruthSchema(schemas.outputSchema);
    setRequestContextSchema(schemas.requestContextSchema);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Dataset name is required');
      return;
    }

    try {
      const result = (await createDataset.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        inputSchema,
        groundTruthSchema,
        requestContextSchema,
        targetType: effectiveTargetType,
        targetIds,
      })) as { id: string };

      toast.success('Dataset created successfully');

      // Reset form
      setName('');
      setDescription('');
      setInputSchema(null);
      setGroundTruthSchema(null);
      setRequestContextSchema(null);
      setSelectedTargetType('');
      setShowCustomSchema(!targetType);
      onOpenChange(false);

      // Navigate to new dataset
      onSuccess?.(result.id);
    } catch (error) {
      toast.error(`Failed to create dataset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCancel = () => {
    setName('');
    setDescription('');
    setInputSchema(null);
    setGroundTruthSchema(null);
    setRequestContextSchema(null);
    setSelectedTargetType('');
    setShowCustomSchema(!targetType);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Dataset</DialogTitle>
        </DialogHeader>
        <DialogBody className="max-h-[70vh] overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dataset-name">Name *</Label>
              <Input
                id="dataset-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter dataset name"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataset-description">Description</Label>
              <Input
                id="dataset-description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Enter dataset description (optional)"
              />
            </div>

            {!isPreScoped && (
              <SelectFieldBlock
                label="Target type"
                name="dataset-target-type"
                placeholder="Select a target type (optional)"
                options={[...DATASET_TARGET_TYPE_OPTIONS]}
                value={selectedTargetType}
                onValueChange={value => setSelectedTargetType(value as DatasetTargetType)}
                helpText="What this dataset evaluates. Drives the Target column and the Target filter."
                disabled={createDataset.isPending}
              />
            )}

            {targetType && !showCustomSchema ? (
              <button
                type="button"
                className="text-xs text-neutral3 hover:text-accent1 transition-colors"
                onClick={() => setShowCustomSchema(true)}
              >
                + Custom schema
              </button>
            ) : (
              <SchemaConfigSection
                inputSchema={inputSchema}
                outputSchema={groundTruthSchema}
                requestContextSchema={requestContextSchema}
                onChange={handleSchemaChange}
                disabled={createDataset.isPending}
              />
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={createDataset.isPending || !name.trim()}>
                {createDataset.isPending ? 'Creating...' : 'Create Dataset'}
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
