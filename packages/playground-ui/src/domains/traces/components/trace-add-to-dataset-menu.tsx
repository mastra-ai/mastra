import { CircleDotIcon, ListTreeIcon, PlusIcon } from 'lucide-react';
import { Button } from '@/ds/components/Button';
import { DropdownMenu } from '@/ds/components/DropdownMenu';

export interface TraceAddToDatasetMenuProps {
  /** The span open in the trace; "This span" is disabled without one. */
  selectedSpanId?: string;
  /** Called with the span id for "This span", and with nothing for "Full trace". */
  onSave: (spanId?: string) => void;
}

export function TraceAddToDatasetMenu({ selectedSpanId, onSave }: TraceAddToDatasetMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <Button size="sm">
            <PlusIcon />
            Add to dataset
          </Button>
        }
      />
      <DropdownMenu.Content align="end">
        <DropdownMenu.Item disabled={!selectedSpanId} onSelect={() => onSave(selectedSpanId)}>
          <CircleDotIcon />
          This span
        </DropdownMenu.Item>
        <DropdownMenu.Item onSelect={() => onSave()}>
          <ListTreeIcon />
          Full trace
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
