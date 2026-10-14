import { ArrowUpDown } from 'lucide-react';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import type { DropdownMenuRadioOption } from '@/ds/components/DropdownMenu';

export type SortMenuProps<V extends string> = {
  label: string;
  options: readonly DropdownMenuRadioOption<V>[];
  value: V;
  onValueChange: (value: V) => void;
  baselineValue?: V;
};

export function SortMenu<V extends string>({ label, options, value, onValueChange, baselineValue }: SortMenuProps<V>) {
  const selected = options.find(option => option.value === value);
  const triggerLabel = selected ? `${label}: ${selected.label}` : label;
  const changed = baselineValue !== undefined && value !== baselineValue;
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        size="icon-sm"
        variant={changed ? 'primary' : 'default'}
        aria-label={triggerLabel}
        tooltip={triggerLabel}
      >
        <ArrowUpDown aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start">
        <DropdownMenu.Label>{label}</DropdownMenu.Label>
        <DropdownMenu.RadioOptions options={options} value={value} onValueChange={onValueChange} />
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

export type SortMenuSubProps<V extends string> = Omit<SortMenuProps<V>, 'label' | 'baselineValue'> & {
  label?: string;
};

function SortMenuSub<V extends string>({ label = 'Sort', ...props }: SortMenuSubProps<V>) {
  return <DropdownMenu.RadioSub label={label} icon={<ArrowUpDown aria-hidden />} {...props} />;
}

SortMenu.Sub = SortMenuSub;
