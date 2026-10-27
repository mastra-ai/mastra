import { Columns3Icon, PlusIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  TRACE_COLUMN_CATALOGS,
  TRACE_CUSTOM_COLUMN_FIELDS,
  TRACE_CUSTOM_COLUMN_LABELS,
  TRACE_USAGE_COLUMNS,
} from '../trace-list-columns';
import type {
  TraceColumnCatalog,
  TraceColumnPreferences,
  TraceCustomColumn,
  TraceOptionalColumn,
} from '../trace-list-columns';
import { Button } from '@/ds/components/Button';
import { Combobox } from '@/ds/components/Combobox';
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
} from '@/ds/components/Dialog';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { Field, FieldError, FieldLabel } from '@/ds/components/Field';
import { Form } from '@/ds/components/Form';
import { Txt } from '@/ds/components/Txt';

const EMPTY_KEYS: readonly string[] = [];

const COLUMN_LABELS: Record<TraceOptionalColumn, string> = {
  type: 'Primitive type',
  input: 'Input',
  output: 'Output',
  duration: 'Duration',
  traceCount: 'Traces',
  timeToFirstChunk: 'Time to first chunk',
  endTime: 'End',
  environment: 'Environment',
  model: 'Model',
  provider: 'Provider',
  inputTokens: 'Input tokens',
  outputTokens: 'Output tokens',
  totalTokens: 'Total tokens',
  estimatedCost: 'Estimated cost',
};

type TraceColumnsMenuProps = {
  preferences: TraceColumnPreferences;
  /** Which columns the list offers. Defaults to the traces catalog. */
  catalog?: TraceColumnCatalog;
  /** Top-level metadata keys observed on traces in the current time range, offered in the picker. */
  availableMetadataKeys?: readonly string[];
  usageDisabledReason?: string;
  /** When false (server without the trace-query API), metadata columns can't be added. Defaults to true. */
  withQueryTrace?: boolean;
  onToggleColumn: (column: TraceOptionalColumn) => void;
  onAddCustomColumn: (field: TraceCustomColumn) => void;
  onRemoveCustomColumn: (field: TraceCustomColumn) => void;
  onAddMetadataColumn: (key: string) => void;
  onRemoveMetadataColumn: (key: string) => void;
  onReset: () => void;
  /** Keeps the trigger in place but inert, e.g. while capabilities load. */
  disabled?: boolean;
};

export function TraceColumnsMenu({
  preferences,
  catalog = TRACE_COLUMN_CATALOGS.traces,
  availableMetadataKeys = EMPTY_KEYS,
  usageDisabledReason,
  withQueryTrace = true,
  onToggleColumn,
  onAddCustomColumn,
  onRemoveCustomColumn,
  onAddMetadataColumn,
  onRemoveMetadataColumn,
  onReset,
  disabled,
}: TraceColumnsMenuProps) {
  const withMetadata = catalog.metadata && withQueryTrace;
  const [isMetadataDialogOpen, setIsMetadataDialogOpen] = useState(false);
  const [metadataKey, setMetadataKey] = useState('');
  const [metadataError, setMetadataError] = useState<string | undefined>();

  const metadataKeyOptions = useMemo(() => {
    const keys = availableMetadataKeys.filter(key => !preferences.metadataKeys.includes(key));
    if (metadataKey && !keys.includes(metadataKey)) keys.push(metadataKey);
    return keys.map(key => ({ label: key, value: key }));
  }, [availableMetadataKeys, preferences.metadataKeys, metadataKey]);

  const handleDialogOpenChange = (open: boolean) => {
    setIsMetadataDialogOpen(open);
    if (!open) {
      setMetadataKey('');
      setMetadataError(undefined);
    }
  };

  const handleAddMetadata = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedKey = metadataKey.trim();
    if (!normalizedKey) {
      setMetadataError('Enter a metadata key.');
      return;
    }
    if (preferences.metadataKeys.includes(normalizedKey)) {
      setMetadataError('That metadata column is already visible.');
      return;
    }

    onAddMetadataColumn(normalizedKey);
    handleDialogOpenChange(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenu.Trigger
          disabled={disabled}
          render={
            <Button variant="ghost" size="md" icon={<Columns3Icon aria-hidden />}>
              Columns
            </Button>
          }
        />
        <DropdownMenu.Content align="end" className="min-w-56">
          <DropdownMenu.Label>Standard columns</DropdownMenu.Label>
          {catalog.standardColumns.map(column => (
            <DropdownMenu.CheckboxItem
              key={column}
              checked={preferences.visibleColumns.includes(column)}
              onCheckedChange={() => onToggleColumn(column)}
            >
              {COLUMN_LABELS[column]}
            </DropdownMenu.CheckboxItem>
          ))}

          {catalog.usage && (
            <>
              <DropdownMenu.Separator />
              <DropdownMenu.Label>Usage columns</DropdownMenu.Label>
              {TRACE_USAGE_COLUMNS.map(column => (
                <DropdownMenu.CheckboxItem
                  key={column}
                  checked={preferences.visibleColumns.includes(column)}
                  disabled={Boolean(usageDisabledReason)}
                  onCheckedChange={() => onToggleColumn(column)}
                >
                  {COLUMN_LABELS[column]}
                </DropdownMenu.CheckboxItem>
              ))}
              {usageDisabledReason && (
                <Txt variant="meta" tone="faint" className="px-2 py-1" role="note">
                  {usageDisabledReason}
                </Txt>
              )}
            </>
          )}

          <DropdownMenu.Separator />
          <DropdownMenu.Label>Custom columns</DropdownMenu.Label>
          {TRACE_CUSTOM_COLUMN_FIELDS.map(field => {
            const isVisible = preferences.customColumns.includes(field);
            return (
              <DropdownMenu.CheckboxItem
                key={field}
                checked={isVisible}
                onCheckedChange={() => (isVisible ? onRemoveCustomColumn(field) : onAddCustomColumn(field))}
              >
                {TRACE_CUSTOM_COLUMN_LABELS[field]}
              </DropdownMenu.CheckboxItem>
            );
          })}

          {catalog.metadata && (withQueryTrace || preferences.metadataKeys.length > 0) && (
            <>
              <DropdownMenu.Separator />
              <DropdownMenu.Label>Metadata columns</DropdownMenu.Label>
              {preferences.metadataKeys.map(key => (
                <DropdownMenu.CheckboxItem
                  key={key}
                  checked
                  title={key}
                  onCheckedChange={() => onRemoveMetadataColumn(key)}
                >
                  {key}
                </DropdownMenu.CheckboxItem>
              ))}
              {withMetadata && (
                <DropdownMenu.Item onSelect={() => setIsMetadataDialogOpen(true)}>
                  <PlusIcon aria-hidden />
                  Add metadata column
                </DropdownMenu.Item>
              )}
            </>
          )}

          <DropdownMenu.Separator />
          <DropdownMenu.Item onSelect={onReset}>Reset to defaults</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>

      {withMetadata && (
        <Dialog open={isMetadataDialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogContent>
            <Form onSubmit={handleAddMetadata} className="gap-0">
              <DialogHeader>
                <DialogTitle>Add metadata column</DialogTitle>
                <DialogDescription>
                  Pick a top-level trace metadata key observed in the current time range, or type one. Only the key is
                  saved, never its values.
                </DialogDescription>
              </DialogHeader>
              <DialogBody>
                <Field invalid={Boolean(metadataError)}>
                  <FieldLabel>Metadata key</FieldLabel>
                  <Combobox
                    options={metadataKeyOptions}
                    value={metadataKey}
                    onValueChange={key => {
                      setMetadataKey(key);
                      setMetadataError(undefined);
                    }}
                    allowCustomValue
                    placeholder="Select a metadata key…"
                    searchPlaceholder="Search metadata keys…"
                    emptyText="No metadata keys observed. Type one to add it."
                  />
                  <FieldError>{metadataError}</FieldError>
                </Field>
              </DialogBody>
              <DialogFooter>
                <DialogCancel>Cancel</DialogCancel>
                <DialogAction type="submit">Add column</DialogAction>
              </DialogFooter>
            </Form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
