'use client';
import { Button } from '@mastra/playground-ui/components/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@mastra/playground-ui/components/Dialog';
import { SelectFieldBlock } from '@mastra/playground-ui/components/FormFieldBlocks';
import { Input } from '@mastra/playground-ui/components/Input';
import { Label } from '@mastra/playground-ui/components/Label';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useReducer } from 'react';
import { useDatasetMutations } from '../hooks/use-dataset-mutations';
import { SchemaConfigSection } from './schema-config-section';
import type { DatasetTargetType } from './target-type-options';
import { DATASET_TARGET_TYPE_OPTIONS, isDatasetTargetType } from './target-type-options';

export interface EditDatasetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dataset: {
    id: string;
    name: string;
    description?: string;
    targetType?: string | null;
    inputSchema?: Record<string, unknown> | null;
    groundTruthSchema?: Record<string, unknown> | null;
    requestContextSchema?: Record<string, unknown> | null;
  };
  onSuccess?: () => void;
}

type EditDatasetDialogFormProps = Omit<EditDatasetDialogProps, 'open'>;
type Dataset = EditDatasetDialogProps['dataset'];
type SchemaValue = Record<string, unknown> | null;

type EditDatasetFormState = {
  name: string;
  description: string;
  targetType: DatasetTargetType | '';
  inputSchema: SchemaValue;
  groundTruthSchema: SchemaValue;
  requestContextSchema: SchemaValue;
  validationError: string | null;
};

type EditDatasetFormAction =
  | { type: 'setStringField'; field: 'name' | 'description'; value: string }
  | { type: 'setTargetType'; value: DatasetTargetType | '' }
  | { type: 'setSchemas'; inputSchema: SchemaValue; groundTruthSchema: SchemaValue; requestContextSchema: SchemaValue }
  | { type: 'setValidationError'; validationError: string | null };

function getInitialFormState(dataset: Dataset): EditDatasetFormState {
  return {
    name: dataset.name,
    description: dataset.description ?? '',
    targetType: isDatasetTargetType(dataset.targetType) ? dataset.targetType : '',
    inputSchema: dataset.inputSchema ?? null,
    groundTruthSchema: dataset.groundTruthSchema ?? null,
    requestContextSchema: dataset.requestContextSchema ?? null,
    validationError: null,
  };
}

function editDatasetFormReducer(state: EditDatasetFormState, action: EditDatasetFormAction): EditDatasetFormState {
  switch (action.type) {
    case 'setStringField':
      return { ...state, [action.field]: action.value };
    case 'setTargetType':
      return { ...state, targetType: action.value };
    case 'setSchemas':
      return {
        ...state,
        inputSchema: action.inputSchema,
        groundTruthSchema: action.groundTruthSchema,
        requestContextSchema: action.requestContextSchema,
        validationError: null,
      };
    case 'setValidationError':
      return { ...state, validationError: action.validationError };
    default:
      return state;
  }
}

export function EditDatasetDialog({ open, onOpenChange, dataset, onSuccess }: EditDatasetDialogProps) {
  // The form lives inside DialogContent so it mounts/unmounts with the popup:
  // Base UI unmounts the popup's children after the exit transition completes,
  // which both resets the form state for the next open and keeps the closing
  // popup instance alive through its own exit transition. Keying a remount on
  // `open` here would destroy the popup mid-transition and orphan it on screen
  // (see https://github.com/mastra-ai/mastra/issues/17890).
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <EditDatasetDialogForm key={dataset.id} dataset={dataset} onOpenChange={onOpenChange} onSuccess={onSuccess} />
      </DialogContent>
    </Dialog>
  );
}

function EditDatasetDialogForm({ onOpenChange, dataset, onSuccess }: EditDatasetDialogFormProps) {
  const [formState, dispatch] = useReducer(editDatasetFormReducer, dataset, getInitialFormState);
  const { updateDataset } = useDatasetMutations();

  const handleSchemaChange = (schemas: {
    inputSchema: Record<string, unknown> | null;
    outputSchema: Record<string, unknown> | null;
    requestContextSchema: Record<string, unknown> | null;
  }) => {
    dispatch({
      type: 'setSchemas',
      inputSchema: schemas.inputSchema,
      groundTruthSchema: schemas.outputSchema,
      requestContextSchema: schemas.requestContextSchema,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: 'setValidationError', validationError: null });

    if (!formState.name.trim()) {
      toast.error('Dataset name is required');
      return;
    }

    try {
      await updateDataset.mutateAsync({
        datasetId: dataset.id,
        name: formState.name.trim(),
        description: formState.description.trim() || undefined,
        targetType: formState.targetType || undefined,
        inputSchema: formState.inputSchema,
        groundTruthSchema: formState.groundTruthSchema,
        requestContextSchema: formState.requestContextSchema,
      });

      toast.success('Dataset updated successfully');
      onOpenChange(false);
      onSuccess?.();
    } catch (err: unknown) {
      // Handle validation errors (existing items may fail new schema)
      // MastraClientError stores the parsed response body in `body`
      const body = (err as { body?: { cause?: { failingItems?: unknown[] } } })?.body;
      if (Array.isArray(body?.cause?.failingItems) && body.cause.failingItems.length > 0) {
        const count = body.cause.failingItems.length;
        dispatch({
          type: 'setValidationError',
          validationError: `${count} existing item(s) fail validation. Fix items or adjust schema.`,
        });
      } else {
        const error = err as { message?: string };
        toast.error(`Failed to update dataset: ${error?.message || 'Unknown error'}`);
      }
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit Dataset</DialogTitle>
      </DialogHeader>
      <DialogBody className="max-h-[70vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-dataset-name">Name *</Label>
            <Input
              id="edit-dataset-name"
              value={formState.name}
              onChange={e => dispatch({ type: 'setStringField', field: 'name', value: e.target.value })}
              placeholder="Enter dataset name"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-dataset-description">Description</Label>
            <Input
              id="edit-dataset-description"
              value={formState.description}
              onChange={e => dispatch({ type: 'setStringField', field: 'description', value: e.target.value })}
              placeholder="Enter dataset description (optional)"
            />
          </div>

          <SelectFieldBlock
            label="Target type"
            name="edit-dataset-target-type"
            placeholder="Select a target type (optional)"
            options={[...DATASET_TARGET_TYPE_OPTIONS]}
            value={formState.targetType}
            onValueChange={value => dispatch({ type: 'setTargetType', value: value as DatasetTargetType })}
            helpText="What this dataset evaluates. Drives the Target column and the Target filter."
            disabled={updateDataset.isPending}
          />

          <SchemaConfigSection
            inputSchema={formState.inputSchema}
            outputSchema={formState.groundTruthSchema}
            requestContextSchema={formState.requestContextSchema}
            onChange={handleSchemaChange}
            disabled={updateDataset.isPending}
            defaultOpen={!!(dataset.inputSchema || dataset.groundTruthSchema || dataset.requestContextSchema)}
          />

          {formState.validationError && (
            <div className="rounded-md border border-red-900/50 bg-red-950/20 p-3">
              <p className="text-sm text-red-200">{formState.validationError}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={updateDataset.isPending || !formState.name.trim()}>
              {updateDataset.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogBody>
    </>
  );
}
