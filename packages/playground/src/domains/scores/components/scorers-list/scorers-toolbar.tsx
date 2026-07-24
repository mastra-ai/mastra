import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@mastra/playground-ui/components/InputGroup';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { SearchIcon, XIcon } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [value, setValue] = useState(search);
  // Tracks the last value this toolbar committed upstream, so the sync effect can tell
  // an external `search` change (e.g. a Reset button) from our own debounced echo.
  const committedRef = useRef(search);

  const debouncedSearch = useDebouncedCallback((next: string) => {
    committedRef.current = next;
    onSearchChange(next);
  }, 300);

  // Mirror an EXTERNAL `search` change into the local input only. Guarding on
  // committedRef avoids both rewinding the field mid-typing (which dropped a keystroke
  // landing between the debounce firing and the parent re-render) and a redundant
  // re-render on every commit, while still letting an external Reset clear the input.
  useEffect(() => {
    if (search !== committedRef.current) {
      committedRef.current = search;
      debouncedSearch.cancel();
      setValue(search);
    }
  }, [search, debouncedSearch]);

  // Cancel any pending commit on unmount.
  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setValue(event.target.value);
      debouncedSearch(event.target.value);
    },
    [debouncedSearch],
  );

  const handleClear = useCallback(() => {
    committedRef.current = '';
    debouncedSearch.cancel();
    setValue('');
    onSearchChange('');
  }, [onSearchChange, debouncedSearch]);

  // Reset is our own button, so clear the local field + cancel any pending commit before
  // delegating. The `search`-only sync effect can't catch this: an external reset sets
  // `search=''`, which equals committedRef when the user typed but hasn't committed yet, so
  // the guard never fires — leaving a stale term that the pending debounce would re-apply.
  const handleReset = useCallback(() => {
    committedRef.current = '';
    debouncedSearch.cancel();
    setValue('');
    onReset?.();
  }, [onReset, debouncedSearch]);

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
            name="scorer-search"
            type="search"
            aria-label="Search scorers"
            placeholder="Filter by scorer name"
            value={value}
            onChange={handleChange}
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
        <Button onClick={handleReset} variant="outline">
          <XIcon /> Reset
        </Button>
      )}
    </div>
  );
}
