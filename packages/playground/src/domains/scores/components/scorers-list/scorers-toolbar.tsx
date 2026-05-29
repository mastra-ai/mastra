import {
  Button,
  ButtonsGroup,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@mastra/playground-ui';
import { SearchIcon, XIcon } from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
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
  const id = useId();
  const [value, setValue] = useState(search);

  const debouncedSearch = useDebouncedCallback((next: string) => {
    onSearchChange(next);
  }, 300);

  useEffect(() => {
    debouncedSearch.cancel();
    setValue(search);
  }, [search, debouncedSearch]);

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  const handleClear = useCallback(() => {
    setValue('');
    onSearchChange('');
    debouncedSearch.cancel();
  }, [onSearchChange, debouncedSearch]);

  return (
    <div className="flex items-center gap-2 w-full max-w-[40rem]">
      {/* Search + source filter fused into one pill (ButtonsGroup spacing="close").
          `size="default"` to match the other list searches (e.g. /agents). */}
      <ButtonsGroup spacing="close" className="flex-1 min-w-0">
        <InputGroup variant="outline" size="default">
          <InputGroupAddon align="inline-start">
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            id={id}
            name={id}
            type="search"
            aria-label="Search scorers"
            placeholder="Filter by scorer name"
            value={value}
            onChange={event => {
              setValue(event.target.value);
              debouncedSearch(event.target.value);
            }}
          />
          {value && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton aria-label="Clear search" onClick={handleClear}>
                <XIcon />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
        <Select value={sourceFilter} onValueChange={onSourceFilterChange}>
          <SelectTrigger aria-label="Filter by source" className="rounded-full">
            <SelectValue placeholder="All sources" />
          </SelectTrigger>
          <SelectContent align="end">
            {SCORER_SOURCE_OPTIONS.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ButtonsGroup>

      {onReset && hasActiveFilters && (
        <Button onClick={onReset} variant="outline">
          <XIcon /> Reset
        </Button>
      )}
    </div>
  );
}
