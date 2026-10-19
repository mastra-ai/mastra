import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import type { FilterBarOption } from '@mastra/playground-ui/components/FilterBar';

import type { BoardFilterField } from './boardFilterFields';

function optionsKeepingPicked(field: BoardFilterField, selected: readonly string[]): FilterBarOption[] {
  const offered = new Set(field.suggestions.map(option => option.value));
  const orphaned = selected.filter(value => !offered.has(value)).map((value): FilterBarOption => ({ value }));
  return [...field.suggestions, ...orphaned];
}

function selectionHint(options: readonly FilterBarOption[], selected: readonly string[]): string | undefined {
  if (selected.length > 1) return `${selected.length} selected`;
  const only = options.find(option => option.value === selected[0]);
  return only?.label ?? selected[0];
}

function withValuePicked(selected: readonly string[], value: string, picked: boolean): string[] {
  if (picked) return [...selected, value];
  return selected.filter(entry => entry !== value);
}

export function BoardFilterSubmenu({
  field,
  selected,
  narrowing,
  onChange,
}: {
  field: BoardFilterField;
  selected: readonly string[];
  narrowing: boolean;
  onChange: (values: string[]) => void;
}) {
  const options = optionsKeepingPicked(field, selected);
  if (options.length === 0) return null;
  const picked = new Set(selected);
  const lockedPick = field.keepsOnePicked && selected.length === 1 ? selected[0] : undefined;
  const Icon = field.icon;

  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger hint={narrowing ? selectionHint(options, selected) : undefined}>
        {Icon && <Icon aria-hidden />}
        <span>{field.label}</span>
      </DropdownMenu.SubTrigger>
      <DropdownMenu.SubContent>
        {options.map(option => (
          <DropdownMenu.CheckboxItem
            key={option.value}
            checked={picked.has(option.value)}
            disabled={option.value === lockedPick}
            onCheckedChange={checked => onChange(withValuePicked(selected, option.value, checked))}
          >
            {option.start}
            <span>{option.label ?? option.value}</span>
          </DropdownMenu.CheckboxItem>
        ))}
      </DropdownMenu.SubContent>
    </DropdownMenu.Sub>
  );
}
