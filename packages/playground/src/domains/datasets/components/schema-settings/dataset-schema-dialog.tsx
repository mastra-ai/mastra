import type { DatasetRecord } from '@mastra/client-js';
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
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useDatasetMutations } from '@mastra/react/hooks/datasets';
import { Controller, useForm } from 'react-hook-form';
import { SchemaEditorPane } from './schema-editor-pane';

export interface DatasetSchemaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dataset: DatasetRecord;
}

type SchemaKey = 'inputSchema' | 'groundTruthSchema' | 'requestContextSchema';
type SchemaValue = Record<string, unknown> | null;
type DatasetSchemaFormValues = Record<SchemaKey, SchemaValue>;

const SCHEMA_TABS: Array<{ key: SchemaKey; label: string }> = [
  { key: 'inputSchema', label: 'Input' },
  { key: 'groundTruthSchema', label: 'Ground truth' },
  { key: 'requestContextSchema', label: 'Request context' },
];

export function DatasetSchemaDialog({ open, onOpenChange, dataset }: DatasetSchemaDialogProps) {
  const { updateDataset } = useDatasetMutations();

  return (
    <Dialog open={open} onOpenChange={onOpenChange} pending={updateDataset.isPending}>
      <DialogContent size="full">
        <DialogHeader>
          <DialogTitle>Dataset schema</DialogTitle>
          <DialogDescription>
            JSON Schemas validate the items of this dataset. Leave a schema empty to skip validation.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so every opening starts from the dataset's current schemas. */}
        <DatasetSchemaForm dataset={dataset} updateDataset={updateDataset} onSaved={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

interface DatasetSchemaFormProps {
  dataset: DatasetRecord;
  updateDataset: ReturnType<typeof useDatasetMutations>['updateDataset'];
  onSaved: () => void;
}

function getFailingItemsCount(error: unknown): number {
  const failingItems = (error as { body?: { cause?: { failingItems?: unknown } } })?.body?.cause?.failingItems;
  return Array.isArray(failingItems) ? failingItems.length : 0;
}

function DatasetSchemaForm({ dataset, updateDataset, onSaved }: DatasetSchemaFormProps) {
  const {
    control,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<DatasetSchemaFormValues>({
    defaultValues: {
      inputSchema: dataset.inputSchema ?? null,
      groundTruthSchema: dataset.groundTruthSchema ?? null,
      requestContextSchema: dataset.requestContextSchema ?? null,
    },
  });
  const hasInvalidSchema = SCHEMA_TABS.some(({ key }) => errors[key]);

  const setValidity = (key: SchemaKey, valid: boolean) => {
    if (valid) clearErrors(key);
    else setError(key, { type: 'invalid' });
  };

  const onSave = handleSubmit(async schemas => {
    try {
      await updateDataset.mutateAsync({ datasetId: dataset.id, ...schemas });
      toast.success('Dataset schema saved');
      onSaved();
    } catch (error) {
      const failingCount = getFailingItemsCount(error);
      if (failingCount > 0) {
        setError('root.server', {
          message: `${failingCount} existing item(s) fail validation. Fix items or adjust schema.`,
        });
      } else {
        toast.error(`Failed to save schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  });

  return (
    <>
      <DialogBody layout="fill">
        <Tabs defaultTab={SCHEMA_TABS[0].key} className="flex min-h-0 flex-1 flex-col">
          <TabList>
            {SCHEMA_TABS.map(({ key, label }) => (
              <Tab key={key} value={key}>
                {label}
              </Tab>
            ))}
          </TabList>
          {SCHEMA_TABS.map(({ key, label }) => (
            <TabContent key={key} value={key} keepMounted className="min-h-0 flex-1">
              <Controller
                control={control}
                name={key}
                render={({ field }) => (
                  <SchemaEditorPane
                    label={label}
                    value={field.value}
                    onChange={schema => {
                      field.onChange(schema);
                      clearErrors('root.server');
                    }}
                    onValidityChange={valid => setValidity(key, valid)}
                  />
                )}
              />
            </TabContent>
          ))}
        </Tabs>

        {errors.root?.server ? (
          <div role="alert">
            <Notice variant="destructive">{errors.root.server.message}</Notice>
          </div>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <DialogCancel>Cancel</DialogCancel>
        <DialogAction onConfirm={onSave} disabled={hasInvalidSchema || updateDataset.isPending}>
          {updateDataset.isPending ? 'Saving...' : 'Save schema'}
        </DialogAction>
      </DialogFooter>
    </>
  );
}
