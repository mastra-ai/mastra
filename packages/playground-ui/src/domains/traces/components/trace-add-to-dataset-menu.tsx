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
          <Button
            size="sm"
            tooltip="Add to dataset"
            // In a header narrower than 900px, collapse to a round icon button so the trace
            // summary keeps its room; the label stays for screen readers.
            className="@max-[900px]:w-control-sm @max-[900px]:px-0"
          >
            <PlusIcon />
            <span className="@max-[900px]:sr-only">Add to dataset</span>
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
