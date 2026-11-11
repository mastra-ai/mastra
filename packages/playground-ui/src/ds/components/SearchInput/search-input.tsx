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
 * Controlled by `value` (it follows every change the parent makes, e.g. a URL change or a Reset)
 * or keeping its own text from `defaultValue`. Either way `debounceMs` delays `onValueChange`
 * while typing; a controlled field shows what was typed until the parent's value moves.
 */
export type SearchInputProps = SearchInputBaseProps &
  ({ value: string; defaultValue?: never } | { value?: never; defaultValue?: string }) & {
    debounceMs?: number;
  };

type Draft = { text: string; over: string };

/** What the field shows: its own text, or the parent's value unless a draft was typed over it. */
function shownText({ value, ownText, draft }: { value?: string; ownText: string; draft?: Draft }) {
  if (value === undefined) return ownText;
  if (draft?.over === value) return draft.text;
  return value;
}

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
  // Typed text waiting on the debounce, and the parent's value it was typed over. It shows only
  // while that value hasn't moved: once the parent takes the text, or changes it some other way,
  // the field follows the parent again.
  const [draft, setDraft] = useState<Draft>();
  const text = shownText({ value, ownText, draft });
  const editable = !inputProps.disabled && !inputProps.readOnly;
  const hasButton = Boolean(onClose || (text && editable));
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
      if (value !== undefined) setDraft({ text: next, over: value });
      debouncedChange(next);
      return;
    }
    setDraft(undefined);
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
      {/* Always rendered so the field keeps its width when text appears (it can be sized by its
          content, e.g. joined in a ButtonsGroup). While empty only the button hides, so a click on
          its spot still lands on the addon, which focuses the input. */}
      <InputGroupAddon align="inline-end" aria-hidden={!hasButton}>
        <InputGroupButton
          aria-label={onClose ? 'Close search' : 'Clear search'}
          className={hasButton ? undefined : 'invisible'}
          inert={!hasButton}
          onClick={() => {
            if (editable) change('');
            if (onClose) onClose();
            else inputRef.current?.focus();
          }}
        >
          <XIcon />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
