import { Columns3Icon, PlusIcon, Columns3, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { TRACE_USAGE_COLUMNS } from '../trace-list-columns';
import type { TraceColumnPreferences, TraceOptionalColumn } from '../trace-list-columns';
import { Button } from '@/ds/components/Button';
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
import { TextFieldBlock } from '@/ds/components/FormFieldBlocks';

const STANDARD_COLUMNS: readonly TraceOptionalColumn[] = ['input', 'entity', 'duration'];

const COLUMN_LABELS: Record<TraceOptionalColumn, string> = {
  input: 'Input',
  entity: 'Entity',
  duration: 'Duration',
  inputTokens: 'Input tokens',
  outputTokens: 'Output tokens',
  estimatedCost: 'Estimated cost',
};

type TraceColumnsMenuProps = {
  preferences: TraceColumnPreferences;
  usageDisabledReason?: string;
  onToggleColumn: (column: TraceOptionalColumn) => void;
  onAddMetadataColumn: (key: string) => void;
  onRemoveMetadataColumn: (key: string) => void;
  onReset: () => void;
};

export function TraceColumnsMenu({
  preferences,
  usageDisabledReason,
  onToggleColumn,
  onAddMetadataColumn,
  onRemoveMetadataColumn,
  onReset,
}: TraceColumnsMenuProps) {
  const [isMetadataDialogOpen, setIsMetadataDialogOpen] = useState(false);
  const [metadataKey, setMetadataKey] = useState('');
  const [metadataError, setMetadataError] = useState<string | undefined>();

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
            <p className="text-ui-xs leading-ui-sm text-neutral2 px-2 py-1" role="note">
              {usageDisabledReason}
            </p>
          )}

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
          <DropdownMenu.Item onSelect={() => setIsMetadataDialogOpen(true)}>
            <PlusIcon aria-hidden />
            Add metadata column
          </DropdownMenu.Item>

          <DropdownMenu.Separator />
          <DropdownMenu.Item onSelect={onReset}>Reset to defaults</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>

      <Dialog open={isMetadataDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <form onSubmit={handleAddMetadata}>
            <DialogHeader>
              <DialogTitle>Add metadata column</DialogTitle>
              <DialogDescription>
                Enter a top-level trace metadata key. Only the key is saved, never its values.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <TextFieldBlock
                name="trace-metadata-key"
                label="Metadata key"
                value={metadataKey}
                onChange={event => {
                  setMetadataKey(event.target.value);
                  setMetadataError(undefined);
                }}
                placeholder="tenantId"
                autoFocus
                errorMsg={metadataError}
              />
            </DialogBody>
            <DialogFooter>
              <Button icon={<X />} type="button" variant="outline" onClick={() => handleDialogOpenChange(false)}>
                Cancel
              </Button>
              <Button icon={<Columns3 />} type="submit" variant="primary">
                Add column
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
