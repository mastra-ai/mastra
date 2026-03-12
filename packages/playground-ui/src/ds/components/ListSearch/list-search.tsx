import { useCallback, useId, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { SearchFieldBlock } from '@/ds/components/FormFieldBlocks/fields/search-field-block';

export type ListSearchProps = {
  onSearch: (search: string) => void;
  label: string;
  placeholder: string;
  debounceMs?: number;
};

export const ListSearch = ({ onSearch, label, placeholder, debounceMs = 300 }: ListSearchProps) => {
  const id = useId();
  const [value, setValue] = useState('');

  const debouncedSearch = useDebouncedCallback((val: string) => {
    onSearch(val);
  }, debounceMs);

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
      className="w-full max-w-[30rem] "
    />
  );
};
