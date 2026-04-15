import { Button, ButtonsGroup, SelectFieldBlock, ListSearch } from '@mastra/playground-ui';
import { XIcon } from 'lucide-react';
import { SCORER_SOURCE_OPTIONS } from './scorers-list';

export interface ScorersToolbarProps {
  search: string;
  onSearchChange: (query: string) => void;
  sourceFilter: string;
  onSourceFilterChange: (value: string) => void;
  onReset?: () => void;
  hasActiveFilters?: boolean;
}

export function ScorersToolbar({
  search,
  onSearchChange,
  sourceFilter,
  onSourceFilterChange,
  onReset,
  hasActiveFilters,
}: ScorersToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ListSearch label="Search scorers" placeholder="Filter by scorer name" value={search} onSearch={onSearchChange} />
      <ButtonsGroup>
        <SelectFieldBlock
          label="Source"
          labelIsHidden
          name="filter-source"
          options={[...SCORER_SOURCE_OPTIONS]}
          value={sourceFilter}
          onValueChange={onSourceFilterChange}
          className="whitespace-nowrap"
        />
        {onReset && hasActiveFilters && (
          <Button onClick={onReset} size="sm" variant="light">
            <XIcon className="size-3" /> Reset
          </Button>
        )}
      </ButtonsGroup>
    </div>
  );
}
