'use client';
import { Button } from '@mastra/playground-ui/components/Button';
import { TextFieldBlock } from '@mastra/playground-ui/components/FormFieldBlocks';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useState } from 'react';
import { useDatasetMutations } from '../hooks/use-dataset-mutations';
import { SchemaConfigSection } from './schema-config-section';
import type { DatasetTargetType } from './target-type-options';

export interface CreateDatasetFormProps {
  onSuccess: (datasetId: string) => void;
  onCancel: () => void;
  /** If provided, auto-attaches the dataset to this target on create */
  targetType?: DatasetTargetType;
  targetIds?: string[];
}

export function CreateDatasetForm({ onSuccess, onCancel, targetType, targetIds }: CreateDatasetFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [inputSchema, setInputSchema] = useState<Record<string, unknown> | null>(null);
  const [groundTruthSchema, setGroundTruthSchema] = useState<Record<string, unknown> | null>(null);
  const [requestContextSchema, setRequestContextSchema] = useState<Record<string, unknown> | null>(null);
  const [showCustomSchema, setShowCustomSchema] = useState(!targetType);
  const { createDataset } = useDatasetMutations();

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
        targetType,
        targetIds,
      })) as { id: string };

      toast.success('Dataset created successfully');

      onSuccess(result.id);
    } catch (error) {
      toast.error(`Failed to create dataset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextFieldBlock
        name="dataset-name"
        label="Name"
        required
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Enter dataset name"
        autoFocus
      />

      <TextFieldBlock
        name="dataset-description"
        label="Description"
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Enter dataset description (optional)"
      />

      {targetType && !showCustomSchema ? (
        <button
          type="button"
          className="text-neutral3 hover:text-accent1 text-xs transition-colors"
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
        <Button type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={createDataset.isPending || !name.trim()}>
          {createDataset.isPending ? 'Creating...' : 'Create Dataset'}
        </Button>
      </div>
    </form>
  );
}
