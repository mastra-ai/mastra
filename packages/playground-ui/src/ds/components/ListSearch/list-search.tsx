import { SearchIcon, XIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { Field, FieldLabel } from '@/ds/components/Field';
import type { InputProps } from '@/ds/components/Input';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/ds/components/InputGroup';
import { useKeydown } from '@/lib/keyboard';

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
    inputRef.current?.focus();
  }, [onSearch, debouncedSearch]);

  return (
    <Field className="w-full max-w-120">
      <FieldLabel className="sr-only">{label}</FieldLabel>
      <InputGroup size={size ?? undefined}>
        <InputGroupAddon>
          <SearchIcon aria-hidden />
        </InputGroupAddon>
        <InputGroupInput ref={inputRef} placeholder={placeholder} value={internalValue} onChange={handleChange} />
        {internalValue ? (
          <InputGroupAddon align="inline-end">
            <InputGroupButton aria-label="Clear search" onClick={handleReset}>
              <XIcon />
            </InputGroupButton>
          </InputGroupAddon>
        ) : null}
      </InputGroup>
    </Field>
  );
};
