import { SearchIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Ref } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/ds/components/InputGroup';
import type { InputGroupInputProps, InputGroupProps } from '@/ds/components/InputGroup';
import { useKeydown } from '@/lib/keyboard';
import { mergeRefs } from '@/lib/merge-refs';

type SearchInputBaseProps = Omit<
  InputGroupInputProps,
  'value' | 'defaultValue' | 'onChange' | 'type' | 'ref' | 'error'
> & {
  /** The field's accessible name. */
  label: string;
  /** Called with the text as it changes; with `debounceMs`, after the pause and right away when cleared. */
  onValueChange: (value: string) => void;
  /** Cmd/Ctrl+Shift+F focuses the field. Give it to the one main search of a page. */
  shortcut?: boolean;
  /** Shows a Close button that clears the text and calls this, e.g. to collapse the search. */
  onClose?: () => void;
  size?: InputGroupProps['size'];
  className?: string;
  ref?: Ref<HTMLInputElement>;
};

/**
 * Controlled (`value`, reported on every keystroke) or keeping its own text (`defaultValue`,
 * optionally reported after `debounceMs`). To reset a field that keeps its own text, remount it
 * with a `key`.
 */
export type SearchInputProps = SearchInputBaseProps &
  (
    | { value: string; defaultValue?: never; debounceMs?: never }
    | { value?: never; defaultValue?: string; debounceMs?: number }
  );

/**
 * A search field: an `InputGroup` with a search icon and a clear button, nothing styled of its
 * own. Compose `InputGroup` directly for anything this doesn't cover.
 */
export function SearchInput({
  label,
  value,
  defaultValue = '',
  onValueChange,
  debounceMs = 0,
  shortcut = false,
  onClose,
  size,
  className,
  ref,
  ...inputProps
}: SearchInputProps) {
  const [ownText, setOwnText] = useState(defaultValue);
  const text = value ?? ownText;
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedChange = useDebouncedCallback(onValueChange, debounceMs);

  useKeydown(
    {
      'mod+shift+f': () => {
        inputRef.current?.focus();
        inputRef.current?.select();
      },
    },
    { enabled: shortcut },
  );

  useEffect(() => () => debouncedChange.cancel(), [debouncedChange]);

  const change = (next: string) => {
    setOwnText(next);
    if (next && debounceMs > 0) {
      debouncedChange(next);
      return;
    }
    debouncedChange.cancel();
    onValueChange(next);
  };

  return (
    <InputGroup size={size} className={className}>
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput
        {...inputProps}
        ref={mergeRefs(inputRef, ref)}
        type="search"
        aria-label={label}
        value={text}
        onChange={event => change(event.target.value)}
      />
      {(onClose || text) && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            aria-label={onClose ? 'Close search' : 'Clear search'}
            onClick={() => {
              change('');
              if (onClose) onClose();
              else inputRef.current?.focus();
            }}
          >
            <XIcon />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}
