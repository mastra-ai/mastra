import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';

import { BoardFilterOptions } from './BoardFilterOptions';
import { SearchableBoardFilterContent } from './SearchableBoardFilterContent';
import { boardFilterOptions, boardFilterSummary } from './boardFilterFields';
import type { BoardFilterField } from './boardFilterFields';

const SEARCHABLE_OPTION_COUNT = 8;

export function BoardFilterSubmenu({
  field,
  selected,
  onChange,
}: {
  field: BoardFilterField;
  selected: readonly string[];
  onChange: (values: string[]) => void;
}) {
  const options = boardFilterOptions(field, selected);
  if (options.length === 0) return null;
  const Icon = field.icon;

  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger hint={selected.length > 0 ? boardFilterSummary(field, selected) : undefined}>
        {Icon && <Icon aria-hidden />}
        <span>{field.label}</span>
      </DropdownMenu.SubTrigger>
      {options.length > SEARCHABLE_OPTION_COUNT ? (
        <SearchableBoardFilterContent label={field.label} options={options} selected={selected} onChange={onChange} />
      ) : (
        <DropdownMenu.SubContent>
          <BoardFilterOptions options={options} selected={selected} onChange={onChange} />
        </DropdownMenu.SubContent>
      )}
    </DropdownMenu.Sub>
  );
}
