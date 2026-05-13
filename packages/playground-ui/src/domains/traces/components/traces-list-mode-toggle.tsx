import { ChevronDownIcon } from 'lucide-react';
import type { TraceListMode } from '../trace-filters';
import { Button } from '@/ds/components/Button';
import { DropdownMenu } from '@/ds/components/DropdownMenu';

const TRACES_LIST_MODE_LABELS: Record<TraceListMode, string> = {
  traces: 'Top-level traces only',
  branches: 'All traces, nested too',
};

export interface TracesListModeToggleProps {
  value: TraceListMode;
  onChange: (mode: TraceListMode) => void;
  disabled?: boolean;
}

/**
 * Dropdown switcher between the two list modes on the Observability traces page:
 * - `traces` — one row per top-level run (each trace's root anchor).
 * - `branches` — one row per anchor span, including ones nested inside other runs.
 */
export function TracesListModeToggle({ value, onChange, disabled }: TracesListModeToggleProps) {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <Button size="md" variant="default" disabled={disabled}>
          {TRACES_LIST_MODE_LABELS[value]}
          <ChevronDownIcon />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start">
        <DropdownMenu.RadioGroup value={value} onValueChange={v => onChange(v as TraceListMode)}>
          <DropdownMenu.RadioItem value="traces">{TRACES_LIST_MODE_LABELS.traces}</DropdownMenu.RadioItem>
          <DropdownMenu.RadioItem value="branches">{TRACES_LIST_MODE_LABELS.branches}</DropdownMenu.RadioItem>
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
