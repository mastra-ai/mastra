import { SearchIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Ref } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/ds/components/InputGroup';
import type { InputGroupInputProps, InputGroupProps } from '@/ds/components/InputGroup';
import { useKeydown } from '@/lib/keyboard';
import { mergeRefs } from '@/lib/merge-refs';

export type SearchInputProps = Omit<InputGroupInputProps, 'value' | 'onChange' | 'type' | 'ref' | 'error'> & {
  /** The field's accessible name. */
  label: string;
  /** The search text. Without it the field keeps its own text, e.g. a list search that only reports changes. */
  value?: string;
  /** Called with the text as it changes, after `debounceMs` while typing and right away when cleared. */
  onValueChange: (value: string) => void;
  debounceMs?: number;
  /** Cmd/Ctrl+Shift+F focuses the field. Give it to the one main search of a page. */
  shortcut?: boolean;
  /** Shows a Close button that clears the text and calls this, e.g. to collapse the search. */
  onClose?: () => void;
  size?: InputGroupProps['size'];
  className?: string;
  ref?: Ref<HTMLInputElement>;
};

/**
 * A search field: an `InputGroup` with a search icon and a clear button, nothing styled of its
 * own. Compose `InputGroup` directly for anything this doesn't cover.
 */
export function SearchInput({
  label,
  value,
  onValueChange,
  debounceMs = 0,
  shortcut = false,
  onClose,
  size,
  className,
  ref,
  ...inputProps
}: SearchInputProps) {
  const [text, setText] = useState(value ?? '');
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

  // The parent's text wins over a debounced change still pending (e.g. a Reset clearing it).
  useEffect(() => {
    if (value === undefined) return;
    debouncedChange.cancel();
    setText(value);
  }, [value, debouncedChange]);

  useEffect(() => () => debouncedChange.cancel(), [debouncedChange]);

  const change = (next: string) => {
    setText(next);
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
