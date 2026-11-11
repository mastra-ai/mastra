import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { ClearFiltersButton } from '@mastra/playground-ui/components/ClearFiltersButton';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@mastra/playground-ui/components/InputGroup';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { useListSearch } from '@mastra/playground-ui/hooks/use-list-search';
import { SearchIcon, XIcon } from 'lucide-react';
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
  const searchField = useListSearch({ value: search, onSearch: onSearchChange });

  // Clear the field too, so a typed-but-uncommitted term is dropped even when the controlled
  // `search` value is already '' (the field only resyncs when `search` changes).
  const handleReset = () => {
    searchField.clear();
    onReset?.();
  };

  return (
    <ActionRow>
      <ActionRow.Start>
        <div className="max-w-120 flex-1">
          <InputGroup size="sm" className="w-full max-w-120">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              {...searchField.inputProps}
              aria-label="Search scorers"
              placeholder="Search by scorer name"
            />
            {searchField.value && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton aria-label="Clear search" onClick={searchField.clear}>
                  <XIcon />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
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
