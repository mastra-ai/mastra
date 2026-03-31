import { useCallback, useEffect, useId, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import type { InputProps } from '@/ds/components/Input';
import { SearchFieldBlock } from '@/ds/components/FormFieldBlocks/fields/search-field-block';

export type ListSearchProps = {
  onSearch: (search: string) => void;
  label: string;
  placeholder: string;
  debounceMs?: number;
  size?: InputProps['size'];
};

export const ListSearch = ({ onSearch, label, placeholder, debounceMs = 300, size }: ListSearchProps) => {
  const id = useId();
  const [value, setValue] = useState('');

  const debouncedSearch = useDebouncedCallback((val: string) => {
    onSearch(val);
  }, debounceMs);

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(e.target.value);
      debouncedSearch(e.target.value);
    },
    [debouncedSearch],
  );

  const handleReset = useCallback(() => {
    setValue('');
    onSearch('');
    debouncedSearch.cancel();
  }, [onSearch, debouncedSearch]);

  return (
    <SearchFieldBlock
      name={id}
      label={label}
      labelIsHidden
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
      onReset={handleReset}
      size={size}
      className="w-full max-w-[30rem]"
    />
  );
};
