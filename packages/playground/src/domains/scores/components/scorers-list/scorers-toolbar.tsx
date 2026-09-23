import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { Button } from '@mastra/playground-ui/components/Button';
import { SelectFieldBlock } from '@mastra/playground-ui/components/FormFieldBlocks';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { XIcon } from 'lucide-react';
import { useState } from 'react';
import { SCORER_SOURCE_OPTIONS } from './constants';

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
  // Remount the search on Reset so a typed-but-uncommitted term is dropped even when the
  // controlled `search` value is already '' (ListSearch only resyncs on value change).
  const [searchKey, setSearchKey] = useState(0);

  const handleReset = () => {
    setSearchKey(k => k + 1);
    onReset?.();
  };

  return (
    <ActionRow>
      <ActionRow.Start>
        <div className="max-w-120 flex-1">
          <ListSearch
            key={searchKey}
            label="Search scorers"
            placeholder="Filter by scorer name"
            value={search}
            onSearch={onSearchChange}
          />
        </div>
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
          <Button onClick={handleReset} size="sm" variant="default" icon={<XIcon />}>
            Reset
          </Button>
        )}
      </ActionRow.Start>
    </ActionRow>
  );
}
