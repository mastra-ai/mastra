import { useState } from 'react';
import { boardFilterOptions, boardFilterSummary } from './board-filter-fields';

import type { BoardFilterField } from './board-filter-fields';
import { BoardFilterOptions } from './board-filter-options';
import { SearchableBoardFilterContent } from './searchable-board-filter-content';
import { DropdownMenu } from '@/ds/components/DropdownMenu';

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
  const [searchKey, setSearchKey] = useState(0);
  const options = boardFilterOptions(field, selected);
  if (options.length === 0) return null;
  const Icon = field.icon;
  const searchable = options.length > SEARCHABLE_OPTION_COUNT;

  return (
    <DropdownMenu.Sub
      onOpenChange={open => {
        // Search state sits above the popup portal, so each open needs a fresh instance.
        if (open && searchable) setSearchKey(key => key + 1);
      }}
    >
      <DropdownMenu.SubTrigger hint={selected.length > 0 ? boardFilterSummary(field, selected) : undefined}>
        {Icon && <Icon aria-hidden />}
        <span>{field.label}</span>
      </DropdownMenu.SubTrigger>
      {searchable ? (
        <SearchableBoardFilterContent
          key={searchKey}
          label={field.label}
          options={options}
          selected={selected}
          onChange={onChange}
        />
      ) : (
        <DropdownMenu.SubContent>
          <BoardFilterOptions options={options} selected={selected} onChange={onChange} />
        </DropdownMenu.SubContent>
      )}
    </DropdownMenu.Sub>
  );
}
