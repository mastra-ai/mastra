import { useEffect, useRef, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { SearchInput } from '@/ds/components/SearchInput';
import type { SearchInputProps } from '@/ds/components/SearchInput';
import { useKeydown } from '@/lib/keyboard';

export type ListSearchProps = {
  onSearch: (search: string) => void;
  label: string;
  placeholder: string;
  debounceMs?: number;
  size?: SearchInputProps['size'];
  /**
   * Optional controlled value. When provided, ListSearch stays in sync with this
   * prop — useful when the parent needs to clear the input programmatically
   * (e.g. from a Reset button). If omitted, ListSearch manages its own state.
   */
  value?: string;
  /**
   * Opts out of the Cmd/Ctrl+Shift+F focus shortcut. Pass this on secondary
   * instances so two search fields on the same page don't fight over focus.
   */
  shortcutDisabled?: boolean;
};

export const ListSearch = ({
  onSearch,
  label,
  placeholder,
  debounceMs = 300,
  size,
  value: controlledValue,
  shortcutDisabled = false,
}: ListSearchProps) => {
  const [internalValue, setInternalValue] = useState(controlledValue ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useKeydown(
    {
      'mod+shift+f': () => {
        inputRef.current?.focus();
        inputRef.current?.select();
      },
    },
    { enabled: !shortcutDisabled },
  );

  const debouncedSearch = useDebouncedCallback((val: string) => {
    onSearch(val);
  }, debounceMs);

  // Sync internal state with controlled value (e.g. parent Reset clears it to '').
  // Also cancel any pending debounced callback so a stale handleChange call
  // can't overwrite the newly-applied controlled value.
  useEffect(() => {
    if (controlledValue !== undefined) {
      debouncedSearch.cancel();
      setInternalValue(controlledValue);
    }
  }, [controlledValue, debouncedSearch]);

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  const searchNowOrDebounced = (next: string) => {
    setInternalValue(next);
    if (next) {
      debouncedSearch(next);
      return;
    }
    debouncedSearch.cancel();
    onSearch('');
  };

  return (
    <SearchInput
      ref={inputRef}
      label={label}
      placeholder={placeholder}
      size={size}
      value={internalValue}
      onValueChange={searchNowOrDebounced}
      className="w-full max-w-120"
    />
  );
};
