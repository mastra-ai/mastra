import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { ClearFiltersButton } from '@mastra/playground-ui/components/ClearFiltersButton';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
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
        <Select value={sourceFilter} onValueChange={onSourceFilterChange}>
          <SelectTrigger aria-label="Source" size="sm" className="w-auto whitespace-nowrap">
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            {SCORER_SOURCE_OPTIONS.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {onReset && hasActiveFilters && <ClearFiltersButton onClick={handleReset} />}
      </ActionRow.Start>
    </ActionRow>
  );
}
