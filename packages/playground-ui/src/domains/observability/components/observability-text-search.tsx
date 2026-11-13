import { useId } from 'react';
import { effectiveTextSearch } from '../lib/text-search';
import { SearchInput } from '@/ds/components/SearchInput';
import { Txt } from '@/ds/components/Txt';

export type ObservabilityTextSearchProps = {
  value: string;
  onValueChange: (value: string) => void;
  label: string;
};

/** Capability gating belongs to the caller; invalid drafts never become query predicates. */
export function ObservabilityTextSearch({ value, onValueChange, label }: ObservabilityTextSearchProps) {
  const hintId = useId();
  const invalid = Boolean(value.trim()) && effectiveTextSearch(value) === undefined;
  return (
    <div>
      <SearchInput
        label={label}
        placeholder={label}
        value={value}
        onValueChange={onValueChange}
        debounceMs={300}
        aria-describedby={invalid ? hintId : undefined}
        aria-invalid={invalid}
      />
      {invalid && <Txt id={hintId}>Enter between 3 and 256 characters to search</Txt>}
    </div>
  );
}
