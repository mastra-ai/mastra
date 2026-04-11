import { useCallback, useEffect, useId, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { SearchFieldBlock } from '@/ds/components/FormFieldBlocks/fields/search-field-block';
import type { InputProps } from '@/ds/components/Input';

export type ListSearchProps = {
  onSearch: (search: string) => void;
  label: string;
  placeholder: string;
  debounceMs?: number;
  size?: InputProps['size'];
  /**
   * Optional controlled value. When provided, ListSearch stays in sync with this
   * prop — useful when the parent needs to clear the input programmatically
   * (e.g. from a Reset button). If omitted, ListSearch manages its own state.
   */
  value?: string;
};

export const ListSearch = ({
  onSearch,
  label,
  placeholder,
  debounceMs = 300,
  size,
  value: controlledValue,
}: ListSearchProps) => {
  const id = useId();
  const [internalValue, setInternalValue] = useState(controlledValue ?? '');

  // Sync internal state with controlled value (e.g. parent Reset clears it to '').
  useEffect(() => {
    if (controlledValue !== undefined) {
      setInternalValue(controlledValue);
    }
  }, [controlledValue]);

  const debouncedSearch = useDebouncedCallback((val: string) => {
    onSearch(val);
  }, debounceMs);

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInternalValue(e.target.value);
      debouncedSearch(e.target.value);
    },
    [debouncedSearch],
  );

  const handleReset = useCallback(() => {
    setInternalValue('');
    onSearch('');
    debouncedSearch.cancel();
  }, [onSearch, debouncedSearch]);

  return (
    <SearchFieldBlock
      name={id}
      label={label}
      labelIsHidden
      placeholder={placeholder}
      value={internalValue}
      onChange={handleChange}
      onReset={handleReset}
      size={size}
      className="w-full max-w-[30rem]"
    />
  );
};
