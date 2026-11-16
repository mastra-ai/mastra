import type { SearchInputProps } from './search-input';

/** A list page's search: the toolbar size, typing reported after a pause, and Cmd/Ctrl+Shift+F. */
export const listSearchProps = {
  size: 'sm',
  debounceMs: 300,
  shortcut: true,
} as const satisfies Pick<SearchInputProps, 'size' | 'debounceMs' | 'shortcut'>;
