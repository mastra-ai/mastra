import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { useKeydown } from '@/lib/keyboard';

export type UseListSearchOptions = {
  /** Called with the search text, debounced while typing and right away when cleared. */
  onSearch: (search: string) => void;
  debounceMs?: number;
  /** Keeps the field in sync when the parent changes the search, e.g. a Reset button clearing it. */
  value?: string;
  /** Cmd/Ctrl+Shift+F focuses the field. Turn it off on a second search on the same page. */
  shortcut?: boolean;
};

/**
 * The behaviour of a list page's search field: its text, a debounced `onSearch`, a clear action
 * and the Cmd/Ctrl+Shift+F focus shortcut. The field itself is an `InputGroup`:
 *
 * ```tsx
 * const search = useListSearch({ onSearch: setSearch });
 * <InputGroup size="sm">
 *   <InputGroupAddon><SearchIcon /></InputGroupAddon>
 *   <InputGroupInput {...search.inputProps} aria-label="Search agents" placeholder="Search by name" />
 * </InputGroup>
 * ```
 */
export function useListSearch({ onSearch, debounceMs = 300, value, shortcut = true }: UseListSearchOptions) {
  const [text, setText] = useState(value ?? '');
  const ref = useRef<HTMLInputElement>(null);
  const debouncedSearch = useDebouncedCallback(onSearch, debounceMs);

  useKeydown(
    {
      'mod+shift+f': () => {
        ref.current?.focus();
        ref.current?.select();
      },
    },
    { enabled: shortcut },
  );

  // A parent update (e.g. Reset clearing it) wins over a debounced call still pending.
  useEffect(() => {
    if (value === undefined) return;
    debouncedSearch.cancel();
    setText(value);
  }, [value, debouncedSearch]);

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  const search = (next: string) => {
    setText(next);
    if (next) {
      debouncedSearch(next);
      return;
    }
    debouncedSearch.cancel();
    onSearch('');
  };

  return {
    value: text,
    clear: () => {
      search('');
      ref.current?.focus();
    },
    inputProps: {
      ref,
      type: 'search' as const,
      value: text,
      onChange: (event: ChangeEvent<HTMLInputElement>) => search(event.target.value),
    },
  };
}
