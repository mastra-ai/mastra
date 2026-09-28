import { Columns3Icon, PlusIcon, Columns3, X } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { TRACE_CUSTOM_COLUMN_FIELDS, TRACE_CUSTOM_COLUMN_LABELS, TRACE_USAGE_COLUMNS } from '../trace-list-columns';
import type { TraceColumnPreferences, TraceCustomColumn, TraceOptionalColumn } from '../trace-list-columns';
import { Button } from '@/ds/components/Button';
import { Combobox } from '@/ds/components/Combobox';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ds/components/Dialog';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { FieldBlock } from '@/ds/components/FormFieldBlocks';

const METADATA_KEY_FIELD_NAME = 'trace-metadata-key';
const EMPTY_KEYS: readonly string[] = [];

const STANDARD_COLUMNS: readonly TraceOptionalColumn[] = ['type', 'input', 'duration', 'endTime', 'environment'];

const COLUMN_LABELS: Record<TraceOptionalColumn, string> = {
  type: 'Type',
  input: 'Input',
  duration: 'Duration',
  endTime: 'End',
  environment: 'Environment',
  inputTokens: 'Input tokens',
  outputTokens: 'Output tokens',
  totalTokens: 'Total tokens',
  estimatedCost: 'Estimated cost',
};

type TraceColumnsMenuProps = {
  preferences: TraceColumnPreferences;
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
};

export function TraceColumnsMenu({
  preferences,
  availableMetadataKeys = EMPTY_KEYS,
  usageDisabledReason,
  withQueryTrace = true,
  onToggleColumn,
  onAddCustomColumn,
  onRemoveCustomColumn,
  onAddMetadataColumn,
  onRemoveMetadataColumn,
  onReset,
}: TraceColumnsMenuProps) {
  const [isMetadataDialogOpen, setIsMetadataDialogOpen] = useState(false);
  const [metadataKey, setMetadataKey] = useState('');
  const [metadataError, setMetadataError] = useState<string | undefined>();

  // Keys already shown as columns are left out; a typed key that discovery
  // hasn't seen is kept in the list so the trigger can display it once picked.
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
          render={
            <Button variant="ghost" size="md" icon={<Columns3Icon aria-hidden />}>
              Columns
            </Button>
          }
        />
        <DropdownMenu.Content align="end" className="min-w-56">
          <DropdownMenu.Label>Standard columns</DropdownMenu.Label>
          {STANDARD_COLUMNS.map(column => (
            <DropdownMenu.CheckboxItem
              key={column}
              checked={preferences.visibleColumns.includes(column)}
              onCheckedChange={() => onToggleColumn(column)}
            >
              {COLUMN_LABELS[column]}
            </DropdownMenu.CheckboxItem>
          ))}

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
            <p className="px-2 py-1 text-meta text-placeholder" role="note">
              {usageDisabledReason}
            </p>
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

          {(withQueryTrace || preferences.metadataKeys.length > 0) && (
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
              {withQueryTrace && (
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

      {withQueryTrace && (
        <Dialog open={isMetadataDialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogContent>
            <form onSubmit={handleAddMetadata}>
              <DialogHeader>
                <DialogTitle>Add metadata column</DialogTitle>
                <DialogDescription>
                  Pick a top-level trace metadata key observed in the current time range, or type one. Only the key is
                  saved, never its values.
                </DialogDescription>
              </DialogHeader>
              <DialogBody>
                <FieldBlock.Column>
                  <FieldBlock.Label name={METADATA_KEY_FIELD_NAME}>Metadata key</FieldBlock.Label>
                  <Combobox
                    id={`input-${METADATA_KEY_FIELD_NAME}`}
                    name={METADATA_KEY_FIELD_NAME}
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
                    error={metadataError}
                  />
                </FieldBlock.Column>
              </DialogBody>
              <DialogFooter>
                <Button icon={<X />} type="button" onClick={() => handleDialogOpenChange(false)}>
                  Cancel
                </Button>
                <Button icon={<Columns3 />} type="submit" variant="primary">
                  Add column
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
