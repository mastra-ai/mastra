import { Dialog, DialogContent } from '@mastra/playground-ui/components/Dialog';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useDatasetMutations } from '@mastra/react/hooks/datasets';
import { useRef, useState } from 'react';
import { CSVImportFlow } from '../csv-import/csv-import-flow';
import { JSONImportFlow } from '../json-import/json-import-flow';
import { AddItemsStep } from './add-items-step';
import { EMPTY_SCHEMAS } from './dataset-schemas';
import type { DatasetSchemas } from './dataset-schemas';
import { DetailsStep } from './details-step';
import { ManualItemsStep } from './manual-items-step';
import type { NewItem } from './manual-items-step';
import { SchemaStep } from './schema-step';
import { StepIndicator } from './step-indicator';

export interface CreateDatasetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once, when the dialog closes after the dataset was created. */
  onSuccess?: (datasetId: string) => void;
}

interface DatasetDraft {
  name: string;
  description: string;
  schemas: DatasetSchemas;
}

/** Creates the dataset (once, even across retries), then inserts the items. Rejects after reporting the failure. */
type SaveDataset = (draft: DatasetDraft, items: NewItem[]) => Promise<void>;

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Unknown error');
const itemCount = (count: number) => `${count} ${count === 1 ? 'item' : 'items'}`;

/**
 * Dataset creation wizard: details, an optional schema, then optional items.
 * Nothing is saved until the last step, which creates the dataset and then inserts its items.
 */
export function CreateDatasetDialog({ open, onOpenChange, onSuccess }: CreateDatasetDialogProps) {
  // A ref, not state: closing right after creation must see the new id, and a failed item insert must not create a second dataset.
  const createdId = useRef<string | null>(null);
  const { createDataset, batchInsertItems } = useDatasetMutations();
  const pending = createDataset.isPending || batchInsertItems.isPending;

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    const id = createdId.current;
    if (nextOpen || !id) return;
    createdId.current = null;
    onSuccess?.(id);
  };

  const ensureDataset = async ({ name, description, schemas }: DatasetDraft) => {
    if (createdId.current) return createdId.current;
    try {
      const dataset = await createDataset.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        inputSchema: schemas.inputSchema ?? undefined,
        groundTruthSchema: schemas.outputSchema ?? undefined,
        requestContextSchema: schemas.requestContextSchema ?? undefined,
      });
      createdId.current = dataset.id;
      return dataset.id;
    } catch (error) {
      toast.error(`Failed to create dataset: ${errorMessage(error)}`);
      throw error;
    }
  };

  const save: SaveDataset = async (draft, items) => {
    const datasetId = await ensureDataset(draft);
    if (items.length === 0) return;
    try {
      await batchInsertItems.mutateAsync({ datasetId, items });
    } catch (error) {
      toast.error(`Dataset created, but its items could not be added: ${errorMessage(error)}`);
      throw error;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} pending={pending}>
      <DialogContent size="lg">
        {/* Unmounted once the dialog has closed, so every opening starts from an empty draft. */}
        <CreateDatasetWizard pending={pending} save={save} onClose={() => handleOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

type Step = 'details' | 'schema' | 'items' | 'manual' | 'csv' | 'json';

const STEP_NUMBER: Record<Step, number> = { details: 1, schema: 2, items: 3, manual: 3, csv: 3, json: 3 };
const STEP_COUNT = 3;

interface CreateDatasetWizardProps {
  pending: boolean;
  save: SaveDataset;
  onClose: () => void;
}

function CreateDatasetWizard({ pending, save, onClose }: CreateDatasetWizardProps) {
  const [step, setStep] = useState<Step>('details');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schemas, setSchemas] = useState<DatasetSchemas>(EMPTY_SCHEMAS);
  const [droppedFile, setDroppedFile] = useState<File>();
  const draft: DatasetDraft = { name, description, schemas };

  const create = async (items: NewItem[]) => {
    try {
      await save(draft, items);
    } catch {
      return;
    }
    toast.success(items.length === 0 ? 'Dataset created' : `Dataset created with ${itemCount(items.length)}`);
    onClose();
  };

  const backToItems = () => {
    setDroppedFile(undefined);
    setStep('items');
  };

  let content;
  if (step === 'details') {
    content = (
      <DetailsStep
        name={name}
        description={description}
        onNameChange={setName}
        onDescriptionChange={setDescription}
        onNext={() => setStep('schema')}
      />
    );
  } else if (step === 'schema') {
    content = (
      <SchemaStep
        schemas={schemas}
        onSchemasChange={setSchemas}
        onBack={() => setStep('details')}
        onNext={() => setStep('items')}
      />
    );
  } else if (step === 'manual') {
    content = <ManualItemsStep pending={pending} onBack={backToItems} onSubmit={items => void create(items)} />;
  } else if (step === 'csv') {
    content = (
      <CSVImportFlow
        inputSchema={schemas.inputSchema}
        groundTruthSchema={schemas.outputSchema}
        initialFile={droppedFile}
        onImport={items => save(draft, items)}
        importLabel={count => `Create dataset with ${itemCount(count)}`}
        onComplete={onClose}
        onCancel={backToItems}
        cancelLabel="Back"
      />
    );
  } else if (step === 'json') {
    content = (
      <JSONImportFlow
        title="Import JSON"
        description="Upload a JSON file or paste the items. They are added when the dataset is created."
        initialFile={droppedFile}
        onImport={create}
        importLabel={count => `Create dataset with ${itemCount(count)}`}
        onCancel={backToItems}
        cancelLabel="Back"
      />
    );
  } else {
    content = (
      <AddItemsStep
        pending={pending}
        onAddManually={() => setStep('manual')}
        onImport={(format, file) => {
          setDroppedFile(file);
          setStep(format);
        }}
        onBack={() => setStep('schema')}
        onCreate={() => void create([])}
      />
    );
  }

  return (
    <>
      <StepIndicator current={STEP_NUMBER[step]} total={STEP_COUNT} />
      {content}
    </>
  );
}
