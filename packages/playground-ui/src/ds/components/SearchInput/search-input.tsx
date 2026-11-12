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

/**
 * Typed text waiting on the debounce, the parent's value it was typed over, and the search this
 * field had already sent then (the parent may still be applying it, e.g. through the URL).
 */
type Draft = { text: string; over: string; sent?: string };

/** What the field shows: its own text, or the parent's value unless a draft was typed over it. */
function shownText({ value, ownText, draft }: { value?: string; ownText: string; draft?: Draft }) {
  if (value === undefined) return ownText;
  if (draft && (draft.over === value || draft.sent === value)) return draft.text;
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
  // while its search is still pending and that value hasn't moved: once the search is applied,
  // cancelled, or the parent changes the value some other way, the field follows the parent.
  const [draft, setDraft] = useState<Draft>();
  // The last search this field sent and the parent hasn't applied yet.
  const sentRef = useRef<string>(undefined);
  const report = (next: string) => {
    sentRef.current = next;
    onValueChange(next);
  };
  const debouncedChange = useDebouncedCallback((next: string) => {
    setDraft(undefined);
    report(next);
  }, debounceMs);
  const text = shownText({ value, ownText, draft: debouncedChange.isPending() ? draft : undefined });
  const editable = !inputProps.disabled && !inputProps.readOnly;
  const hasButton = Boolean(onClose || (text && editable));
  const inputRef = useRef<HTMLInputElement>(null);

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

  // When the parent's value moves, a search still waiting on the debounce is stale (a Reset or URL
  // change replaced the text) unless the parent is only applying what this field already sent.
  useEffect(() => {
    if (value !== undefined && value === sentRef.current) {
      sentRef.current = undefined;
      return;
    }
    debouncedChange.cancel();
  }, [value, debouncedChange]);

  const change = (next: string) => {
    setOwnText(next);
    if (next && debounceMs > 0) {
      if (value !== undefined) setDraft({ text: next, over: value, sent: sentRef.current });
      debouncedChange(next);
      return;
    }
    setDraft(undefined);
    debouncedChange.cancel();
    report(next);
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
