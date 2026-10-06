'use client';

import { Button } from '@mastra/playground-ui/components/Button';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Form } from '@mastra/playground-ui/components/Form';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { DatasetsIcon } from '@mastra/playground-ui/icons/DatasetsIcon';
import { controlStateColorTransition } from '@mastra/playground-ui/primitives/transitions';
import { quietTextHover } from '@mastra/playground-ui/primitives/typography';
import { cn } from '@mastra/playground-ui/utils/cn';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useDatasetMutations } from '@mastra/react/hooks/datasets';
import { X } from 'lucide-react';
import { useState } from 'react';
import { DEFAULT_SCORERS_HELPER_TEXT, DEFAULT_SCORERS_LABEL } from './default-scorers-copy';
import { ScorerSelector } from './experiment-trigger/scorer-selector';
import { SchemaConfigSection } from './schema-config-section';
import type { DatasetTargetType } from './target-type-options';

export interface CreateDatasetFormProps {
  onSuccess: (datasetId: string) => void;
  onCancel: () => void;
  targetType?: DatasetTargetType;
  targetIds?: string[];
}

export function CreateDatasetForm({ onSuccess, onCancel, targetType, targetIds }: CreateDatasetFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [inputSchema, setInputSchema] = useState<Record<string, unknown> | null>(null);
  const [groundTruthSchema, setGroundTruthSchema] = useState<Record<string, unknown> | null>(null);
  const [requestContextSchema, setRequestContextSchema] = useState<Record<string, unknown> | null>(null);
  const [scorerIds, setScorerIds] = useState<string[]>([]);
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
      const result = await createDataset.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        inputSchema,
        groundTruthSchema,
        requestContextSchema,
        targetType,
        targetIds,
        scorerIds: scorerIds.length > 0 ? scorerIds : undefined,
      });

      toast.success('Dataset created successfully');

      onSuccess(result.id);
    } catch (error) {
      toast.error(`Failed to create dataset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <Form onSubmit={handleSubmit}>
      <Field>
        <FieldLabel required>Name</FieldLabel>
        <Input
          required
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Enter dataset name"
          autoFocus
        />
      </Field>

      <Field>
        <FieldLabel>Description</FieldLabel>
        <Input
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Enter dataset description (optional)"
        />
      </Field>

      <ScorerSelector
        selectedScorers={scorerIds}
        setSelectedScorers={setScorerIds}
        disabled={createDataset.isPending}
        label={DEFAULT_SCORERS_LABEL}
        helperText={DEFAULT_SCORERS_HELPER_TEXT}
      />

      {targetType && !showCustomSchema ? (
        <button
          type="button"
          className={cn('self-start', quietTextHover, controlStateColorTransition)}
          onClick={() => setShowCustomSchema(true)}
        >
          <Txt as="span" variant="caption" className="block">
            + Custom schema
          </Txt>
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
        <Button icon={<X />} type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          icon={<DatasetsIcon />}
          type="submit"
          variant="primary"
          disabled={createDataset.isPending || !name.trim()}
        >
          {createDataset.isPending ? 'Creating...' : 'Create Dataset'}
        </Button>
      </div>
    </Form>
  );
}
