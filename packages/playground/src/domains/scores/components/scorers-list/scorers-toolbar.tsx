import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { ClearFiltersButton } from '@mastra/playground-ui/components/ClearFiltersButton';
import { SearchInput } from '@mastra/playground-ui/components/SearchInput';
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
  // Remount the search on Reset so a typed-but-uncommitted term is dropped: when `search` is
  // already '', Reset doesn't change it, so the field would keep showing the pending text.
  const [searchKey, setSearchKey] = useState(0);

  const handleReset = () => {
    setSearchKey(k => k + 1);
    onReset?.();
  };

  return (
    <ActionRow>
      <ActionRow.Start>
        <div className="max-w-120 flex-1">
          <SearchInput
            size="sm"
            debounceMs={300}
            shortcut
            className="max-w-120"
            key={searchKey}
            label="Search scorers"
            placeholder="Search by scorer name"
            value={search}
            onValueChange={onSearchChange}
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
