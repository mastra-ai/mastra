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
import { useForm } from 'react-hook-form';
import { createNameSuffix } from '../utils/default-names';
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

interface CreateDatasetFormValues {
  name: string;
  description: string;
  scorerIds: string[];
  inputSchema?: Record<string, unknown>;
  groundTruthSchema?: Record<string, unknown>;
  requestContextSchema?: Record<string, unknown>;
}

export function CreateDatasetForm({ onSuccess, onCancel, targetType, targetIds }: CreateDatasetFormProps) {
  const { register, handleSubmit, setValue, watch } = useForm<CreateDatasetFormValues>({
    defaultValues: { name: `Dataset ${createNameSuffix()}`, description: '', scorerIds: [] },
  });
  const [name, scorerIds, inputSchema, groundTruthSchema, requestContextSchema] = watch([
    'name',
    'scorerIds',
    'inputSchema',
    'groundTruthSchema',
    'requestContextSchema',
  ]);
  const [showCustomSchema, setShowCustomSchema] = useState(!targetType);
  const { createDataset } = useDatasetMutations();

  const handleSchemaChange = (schemas: {
    inputSchema: Record<string, unknown> | null;
    outputSchema: Record<string, unknown> | null;
    requestContextSchema: Record<string, unknown> | null;
  }) => {
    setValue('inputSchema', schemas.inputSchema ?? undefined);
    setValue('groundTruthSchema', schemas.outputSchema ?? undefined);
    setValue('requestContextSchema', schemas.requestContextSchema ?? undefined);
  };

  const onSubmit = handleSubmit(async values => {
    if (!values.name.trim()) {
      toast.error('Dataset name is required');
      return;
    }

    try {
      const result = await createDataset.mutateAsync({
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        inputSchema: values.inputSchema,
        groundTruthSchema: values.groundTruthSchema,
        requestContextSchema: values.requestContextSchema,
        targetType,
        targetIds,
        scorerIds: values.scorerIds.length > 0 ? values.scorerIds : undefined,
      });

      toast.success('Dataset created successfully');

      onSuccess(result.id);
    } catch (error) {
      toast.error(`Failed to create dataset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  return (
    <Form onSubmit={onSubmit}>
      <Field>
        <FieldLabel required>Name</FieldLabel>
        <Input required {...register('name')} placeholder="Enter dataset name" autoFocus />
      </Field>

      <Field>
        <FieldLabel>Description</FieldLabel>
        <Input {...register('description')} placeholder="Enter dataset description (optional)" />
      </Field>

      <ScorerSelector
        selectedScorers={scorerIds}
        setSelectedScorers={nextScorerIds => setValue('scorerIds', nextScorerIds)}
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
