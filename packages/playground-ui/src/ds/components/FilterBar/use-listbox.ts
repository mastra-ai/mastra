import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';

/** Every whitespace-separated term of `query` must appear in `text` (case-insensitive). */
export function matchesQuery(text: string, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = text.toLowerCase();
  return terms.every(term => haystack.includes(term));
}

export type UseListboxOptions<T> = {
  options: readonly T[];
  getLabel: (option: T) => string;
  query?: string;
  onSelect: (option: T) => void;
};

/**
 * Highlight state for a listbox that keeps DOM focus elsewhere (a text input).
 * Filters `options` by `query`, tracks the highlighted index and maps keys:
 * ArrowUp/Down (wrapping), Home/End, Enter → `onSelect`.
 */
export function useListbox<T>({ options, getLabel, query = '', onSelect }: UseListboxOptions<T>) {
  const id = useId();
  const filtered = useMemo(() => options.filter(o => matchesQuery(getLabel(o), query)), [options, getLabel, query]);
  const [highlighted, setHighlighted] = useState(0);

  useEffect(() => {
    setHighlighted(0);
  }, [query, filtered.length]);

  const optionId = useCallback((index: number) => `${id}-option-${index}`, [id]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent): boolean => {
      if (filtered.length === 0) return false;
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setHighlighted(i => (i + 1) % filtered.length);
          return true;
        case 'ArrowUp':
          event.preventDefault();
          setHighlighted(i => (i <= 0 ? filtered.length - 1 : i - 1));
          return true;
        case 'Home':
          event.preventDefault();
          setHighlighted(0);
          return true;
        case 'End':
          event.preventDefault();
          setHighlighted(filtered.length - 1);
          return true;
        case 'Enter': {
          const option = filtered[highlighted];
          if (!option) return false;
          event.preventDefault();
          onSelect(option);
          return true;
        }
        default:
          return false;
      }
    },
    [filtered, highlighted, onSelect],
  );

  const getOptionProps = useCallback(
    (index: number) => ({
      id: optionId(index),
      role: 'option' as const,
      'aria-selected': index === highlighted,
      'data-highlighted': index === highlighted ? '' : undefined,
      onPointerMove: () => setHighlighted(index),
    }),
    [optionId, highlighted],
  );

  return {
    listboxId: `${id}-listbox`,
    filtered,
    highlighted,
    setHighlighted,
    activeDescendant: filtered.length > 0 ? optionId(highlighted) : undefined,
    handleKeyDown,
    getOptionProps,
  };
}
