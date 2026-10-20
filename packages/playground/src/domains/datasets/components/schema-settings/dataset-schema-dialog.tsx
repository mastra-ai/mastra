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
import { useState } from 'react';
import { SchemaEditorPane } from './schema-editor-pane';

export interface DatasetSchemaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dataset: DatasetRecord;
}

type SchemaKey = 'inputSchema' | 'groundTruthSchema' | 'requestContextSchema';
type SchemaValue = Record<string, unknown> | null;

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
  const [schemas, setSchemas] = useState<Record<SchemaKey, SchemaValue>>(() => ({
    inputSchema: dataset.inputSchema ?? null,
    groundTruthSchema: dataset.groundTruthSchema ?? null,
    requestContextSchema: dataset.requestContextSchema ?? null,
  }));
  const [invalidTabs, setInvalidTabs] = useState<ReadonlySet<SchemaKey>>(() => new Set());
  const [validationError, setValidationError] = useState<string | null>(null);

  const setSchema = (key: SchemaKey, schema: SchemaValue) => {
    setSchemas(previous => ({ ...previous, [key]: schema }));
    setValidationError(null);
  };

  const setValidity = (key: SchemaKey, valid: boolean) => {
    setInvalidTabs(previous => {
      const next = new Set(previous);
      if (valid) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSave = async () => {
    setValidationError(null);
    try {
      await updateDataset.mutateAsync({ datasetId: dataset.id, ...schemas });
      toast.success('Dataset schema saved');
      onSaved();
    } catch (error) {
      const failingCount = getFailingItemsCount(error);
      if (failingCount > 0) {
        setValidationError(`${failingCount} existing item(s) fail validation. Fix items or adjust schema.`);
      } else {
        toast.error(`Failed to save schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

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
              <SchemaEditorPane
                label={label}
                value={schemas[key]}
                onChange={schema => setSchema(key, schema)}
                onValidityChange={valid => setValidity(key, valid)}
              />
            </TabContent>
          ))}
        </Tabs>

        {validationError ? (
          <div role="alert">
            <Notice variant="destructive">{validationError}</Notice>
          </div>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <DialogCancel>Cancel</DialogCancel>
        <DialogAction onConfirm={handleSave} disabled={invalidTabs.size > 0 || updateDataset.isPending}>
          {updateDataset.isPending ? 'Saving...' : 'Save schema'}
        </DialogAction>
      </DialogFooter>
    </>
  );
}
