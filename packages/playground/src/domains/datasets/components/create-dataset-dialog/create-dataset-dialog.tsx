import { Dialog, DialogContent } from '@mastra/playground-ui/components/Dialog';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useDatasetMutations } from '@mastra/react/hooks/datasets';
import { useLayoutEffect, useRef, useState } from 'react';
import { CSVImportFlow } from '../csv-import/csv-import-flow';
import type { DatasetTargetType } from '../target-type-options';
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
  targetType?: DatasetTargetType;
  targetIds?: string[];
}

type Step = 'details' | 'schema' | 'items' | 'manual' | 'csv';

const STEP_NUMBER: Record<Step, number> = { details: 1, schema: 2, items: 3, manual: 3, csv: 3 };
const STEP_COUNT = 3;

const RESET_DELAY_MS = 150;

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Unknown error');
const itemCount = (count: number) => `${count} ${count === 1 ? 'item' : 'items'}`;

/**
 * Dataset creation wizard: details, an optional schema, then optional items.
 * Nothing is saved until the last step, which creates the dataset and then inserts its items.
 */
export function CreateDatasetDialog({
  open,
  onOpenChange,
  onSuccess,
  targetType,
  targetIds,
}: CreateDatasetDialogProps) {
  const [step, setStep] = useState<Step>('details');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schemas, setSchemas] = useState<DatasetSchemas>(EMPTY_SCHEMAS);
  const [droppedFile, setDroppedFile] = useState<File>();
  // A ref, not state: closing right after creation must see the new id, and a failed item insert must not create a second dataset.
  const createdId = useRef<string | null>(null);
  const successReported = useRef(false);
  const { createDataset, batchInsertItems } = useDatasetMutations();
  const pending = createDataset.isPending || batchInsertItems.isPending;

  // Reset once the exit animation is over so the closing dialog doesn't flash back to step 1.
  // Reopening sooner resets right away, before paint, so a new opening always starts fresh.
  useLayoutEffect(() => {
    if (open) return;
    const reset = () => {
      setStep('details');
      setName('');
      setDescription('');
      setSchemas(EMPTY_SCHEMAS);
      setDroppedFile(undefined);
      createdId.current = null;
      successReported.current = false;
    };
    const timer = setTimeout(reset, RESET_DELAY_MS);
    return () => {
      clearTimeout(timer);
      reset();
    };
  }, [open]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    const id = createdId.current;
    if (nextOpen || !id || successReported.current) return;
    successReported.current = true;
    onSuccess?.(id);
  };

  const close = () => handleOpenChange(false);

  const ensureDataset = async () => {
    if (createdId.current) return createdId.current;
    try {
      const dataset = await createDataset.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        inputSchema: schemas.inputSchema ?? undefined,
        groundTruthSchema: schemas.outputSchema ?? undefined,
        requestContextSchema: schemas.requestContextSchema ?? undefined,
        targetType,
        targetIds,
      });
      createdId.current = dataset.id;
      return dataset.id;
    } catch (error) {
      toast.error(`Failed to create dataset: ${errorMessage(error)}`);
      throw error;
    }
  };

  const insertItems = async (items: NewItem[]) => {
    const datasetId = await ensureDataset();
    try {
      await batchInsertItems.mutateAsync({ datasetId, items });
    } catch (error) {
      toast.error(`Dataset created, but its items could not be added: ${errorMessage(error)}`);
      throw error;
    }
  };

  const createEmpty = async () => {
    try {
      await ensureDataset();
    } catch {
      return;
    }
    toast.success('Dataset created');
    close();
  };

  const createWithItems = async (items: NewItem[]) => {
    try {
      await insertItems(items);
    } catch {
      return;
    }
    toast.success(`Dataset created with ${itemCount(items.length)}`);
    close();
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
    content = (
      <ManualItemsStep pending={pending} onBack={backToItems} onSubmit={items => void createWithItems(items)} />
    );
  } else if (step === 'csv') {
    content = (
      <CSVImportFlow
        inputSchema={schemas.inputSchema}
        groundTruthSchema={schemas.outputSchema}
        initialFile={droppedFile}
        onImport={insertItems}
        importLabel={count => `Create dataset with ${itemCount(count)}`}
        onComplete={close}
        onCancel={backToItems}
        cancelLabel="Back"
      />
    );
  } else {
    content = (
      <AddItemsStep
        pending={pending}
        onAddManually={() => setStep('manual')}
        onImportCsv={file => {
          setDroppedFile(file);
          setStep('csv');
        }}
        onBack={() => setStep('schema')}
        onCreate={() => void createEmpty()}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} pending={pending}>
      <DialogContent size="lg">
        <StepIndicator current={STEP_NUMBER[step]} total={STEP_COUNT} />
        {content}
      </DialogContent>
    </Dialog>
  );
}
