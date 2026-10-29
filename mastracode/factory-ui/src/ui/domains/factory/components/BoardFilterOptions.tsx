import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';

import type { BoardFilterOption } from './boardFilterFields';

export interface BoardFilterOptionsProps {
  options: readonly BoardFilterOption[];
  selected: readonly string[];
  onChange: (values: string[]) => void;
}

export function BoardFilterOptions({ options, selected, onChange }: BoardFilterOptionsProps) {
  const picked = new Set(selected);
  return options.map(option => (
    <DropdownMenu.CheckboxItem
      key={option.value}
      checked={picked.has(option.value)}
      onCheckedChange={checked =>
        onChange(checked ? [...selected, option.value] : selected.filter(value => value !== option.value))
      }
    >
      {option.start}
      <span>{option.label ?? option.value}</span>
    </DropdownMenu.CheckboxItem>
  ));
}
