'use client';

import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Form } from '@mastra/playground-ui/components/Form';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { controlStateColorTransition } from '@mastra/playground-ui/primitives/transitions';
import { quietTextHover } from '@mastra/playground-ui/primitives/typography';
import { cn } from '@mastra/playground-ui/utils/cn';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useDatasetMutations } from '@mastra/react/hooks/datasets';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { createNameSuffix } from '../utils/default-names';
import { SchemaConfigSection } from './schema-config-section';
import type { DatasetTargetType } from './target-type-options';

export interface CreateDatasetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType?: DatasetTargetType;
  targetIds?: string[];
  /** Called with the new dataset id. When omitted, the dialog navigates to the new dataset. */
  onSuccess?: (datasetId: string) => void;
}

interface CreateDatasetFormValues {
  name: string;
  inputSchema?: Record<string, unknown>;
  groundTruthSchema?: Record<string, unknown>;
  requestContextSchema?: Record<string, unknown>;
}

export function CreateDatasetDialog({
  open,
  onOpenChange,
  targetType,
  targetIds,
  onSuccess,
}: CreateDatasetDialogProps) {
  const { createDataset } = useDatasetMutations();
  const navigate = useNavigate();

  const handleCreated = (datasetId: string) => {
    onOpenChange(false);
    if (onSuccess) {
      onSuccess(datasetId);
    } else {
      void navigate(`/datasets/${datasetId}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} pending={createDataset.isPending}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Create new dataset</DialogTitle>
          <DialogDescription>Datasets group test cases used to evaluate your agents and workflows.</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so every opening starts from a fresh form and a new default name. */}
        <CreateDatasetDialogForm
          createDataset={createDataset}
          targetType={targetType}
          targetIds={targetIds}
          onCreated={handleCreated}
        />
      </DialogContent>
    </Dialog>
  );
}

interface CreateDatasetDialogFormProps {
  createDataset: ReturnType<typeof useDatasetMutations>['createDataset'];
  targetType?: DatasetTargetType;
  targetIds?: string[];
  onCreated: (datasetId: string) => void;
}

function CreateDatasetDialogForm({ createDataset, targetType, targetIds, onCreated }: CreateDatasetDialogFormProps) {
  const { register, handleSubmit, setValue, watch } = useForm<CreateDatasetFormValues>({
    defaultValues: { name: `Dataset ${createNameSuffix()}` },
  });
  const [name, inputSchema, groundTruthSchema, requestContextSchema] = watch([
    'name',
    'inputSchema',
    'groundTruthSchema',
    'requestContextSchema',
  ]);
  const [showCustomSchema, setShowCustomSchema] = useState(!targetType);

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
        inputSchema: values.inputSchema,
        groundTruthSchema: values.groundTruthSchema,
        requestContextSchema: values.requestContextSchema,
        targetType,
        targetIds,
      });

      toast.success('Dataset created successfully');
      onCreated(result.id);
    } catch (error) {
      toast.error(`Failed to create dataset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  return (
    <Form onSubmit={onSubmit} className="min-h-0 flex-1">
      <DialogBody>
        <Field>
          <FieldLabel required>Name</FieldLabel>
          <Input required {...register('name')} placeholder="Enter dataset name" autoFocus />
        </Field>

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
      </DialogBody>
      <DialogFooter>
        <DialogCancel>Cancel</DialogCancel>
        <DialogAction type="submit" disabled={!name.trim()}>
          {createDataset.isPending ? 'Creating...' : 'Create Dataset'}
        </DialogAction>
      </DialogFooter>
    </Form>
  );
}
