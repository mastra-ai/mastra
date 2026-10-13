import type { BatchInsertDatasetItemsParams } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import {
  DialogAction,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { Field, FieldError, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';

export type NewItem = BatchInsertDatasetItemsParams['items'][number];

interface ItemRow {
  key: number;
  input: string;
  groundTruth: string;
}

interface RowErrors {
  input?: string;
  groundTruth?: string;
}

export interface ManualItemsStepProps {
  pending: boolean;
  onBack: () => void;
  /** Receives the parsed rows once they are all valid JSON. */
  onSubmit: (items: NewItem[]) => void;
}

const emptyRow = (key: number): ItemRow => ({ key, input: '', groundTruth: '' });

const parseJson = (value: string): { ok: true; value: unknown } | { ok: false } => {
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch {
    return { ok: false };
  }
};

/** Parses every row; returns the items when all rows are valid, otherwise the per-row errors. */
function parseRows(rows: ItemRow[]): { items: NewItem[] } | { errors: Record<number, RowErrors> } {
  const items: NewItem[] = [];
  const errors: Record<number, RowErrors> = {};

  for (const row of rows) {
    const rowErrors: RowErrors = {};
    const input = parseJson(row.input);
    const groundTruth = row.groundTruth.trim() ? parseJson(row.groundTruth) : undefined;

    if (!input.ok) rowErrors.input = 'Input must be valid JSON';
    if (groundTruth && !groundTruth.ok) rowErrors.groundTruth = 'Ground truth must be valid JSON';

    if (rowErrors.input || rowErrors.groundTruth) {
      errors[row.key] = rowErrors;
    } else if (input.ok) {
      items.push(groundTruth?.ok ? { input: input.value, groundTruth: groundTruth.value } : { input: input.value });
    }
  }

  return Object.keys(errors).length > 0 ? { errors } : { items };
}

export function ManualItemsStep({ pending, onBack, onSubmit }: ManualItemsStepProps) {
  const nextKey = useRef(1);
  const [rows, setRows] = useState<ItemRow[]>(() => [emptyRow(0)]);
  const [errors, setErrors] = useState<Record<number, RowErrors>>({});

  const updateRow = (key: number, field: 'input' | 'groundTruth', value: string) => {
    setRows(current => current.map(row => (row.key === key ? { ...row, [field]: value } : row)));
    setErrors(current =>
      current[key]?.[field] ? { ...current, [key]: { ...current[key], [field]: undefined } } : current,
    );
  };

  const addRow = () => {
    setRows(current => [...current, emptyRow(nextKey.current++)]);
  };

  const removeRow = (key: number) => {
    setRows(current => current.filter(row => row.key !== key));
    setErrors(({ [key]: _removed, ...rest }) => rest);
  };

  const handleSubmit = () => {
    const result = parseRows(rows);
    if ('errors' in result) {
      setErrors(result.errors);
      return;
    }
    onSubmit(result.items);
  };

  const hasEmptyInput = rows.some(row => !row.input.trim());
  const submitLabel = `Create dataset with ${rows.length} ${rows.length === 1 ? 'item' : 'items'}`;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add items manually</DialogTitle>
        <DialogDescription>Each item needs a JSON input. Ground truth is optional.</DialogDescription>
      </DialogHeader>
      <DialogBody>
        <ol className="flex flex-col gap-6">
          {rows.map((row, index) => {
            const position = index + 1;
            const rowErrors = errors[row.key];
            return (
              <li key={row.key} className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <Txt as="span" variant="label">
                    Item {position}
                  </Txt>
                  {rows.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove item ${position}`}
                      onClick={() => removeRow(row.key)}
                      disabled={pending}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
                <Field invalid={Boolean(rowErrors?.input)}>
                  <FieldLabel required>Input (JSON)</FieldLabel>
                  <CodeEditor
                    aria-label={`Item ${position} input`}
                    value={row.input}
                    onChange={value => updateRow(row.key, 'input', value)}
                    showCopyButton={false}
                    className="min-h-24"
                  />
                  {rowErrors?.input && <FieldError>{rowErrors.input}</FieldError>}
                </Field>
                <Field invalid={Boolean(rowErrors?.groundTruth)}>
                  <FieldLabel>Ground truth (JSON, optional)</FieldLabel>
                  <CodeEditor
                    aria-label={`Item ${position} ground truth`}
                    value={row.groundTruth}
                    onChange={value => updateRow(row.key, 'groundTruth', value)}
                    showCopyButton={false}
                    className="min-h-24"
                  />
                  {rowErrors?.groundTruth && <FieldError>{rowErrors.groundTruth}</FieldError>}
                </Field>
              </li>
            );
          })}
        </ol>
        <Button variant="ghost" icon={<Plus />} onClick={addRow} disabled={pending} className="mt-4">
          Add another item
        </Button>
      </DialogBody>
      <DialogFooter>
        <Button onClick={onBack} disabled={pending}>
          Back
        </Button>
        <DialogAction onConfirm={handleSubmit} disabled={hasEmptyInput}>
          {pending ? 'Creating...' : submitLabel}
        </DialogAction>
      </DialogFooter>
    </>
  );
}
