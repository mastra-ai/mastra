import { useId, useRef, useState } from 'react';
import type { FocusEvent, KeyboardEvent } from 'react';
import { InputGroup, InputGroupInput } from '../InputGroup';
import type { InputGroupInputProps } from '../InputGroup';
import { AutosaveInputStatus } from './autosave-input-status';
import type { AutosaveInputStatusValue } from './autosave-input-status';

export type AutosaveInputProps = Omit<
  InputGroupInputProps,
  'value' | 'defaultValue' | 'onChange' | 'aria-label' | 'aria-labelledby' | 'readOnly'
> & {
  /** The saved value. A new one replaces the draft. */
  value: string;
  /** Saves a changed value. Throw to show the error; its message is what people read. */
  onSave: (next: string) => Promise<void>;
  /** Names the input, e.g. "Organization name". */
  label: string;
  /** Checks the draft before saving. Return the message to show, or `undefined` when it's fine. */
  validate?: (value: string) => string | undefined;
};

/** How long the check stays after a save. */
const SAVED_CHECK_MS = 1600;

const FALLBACK_ERROR = "Couldn't save. Try again.";

/**
 * Local state that belongs to one saved value. Each piece remembers the `value` it was made against, so a new value
 * from outside (a refetch, another tab) makes it stale, without syncing state in render or an effect.
 */
type Stamped<T> = { data: T; value: string };

function current<T>(stamped: Stamped<T> | undefined, value: string): T | undefined {
  return stamped?.value === value ? stamped.data : undefined;
}

function joinIds(...ids: (string | undefined)[]) {
  return ids.filter(Boolean).join(' ') || undefined;
}

function statusOf(saving: boolean, error: string | undefined, justSaved: boolean): AutosaveInputStatusValue {
  if (saving) return 'saving';
  if (error) return 'error';
  if (justSaved) return 'saved';
  return 'idle';
}

/**
 * A settings text field that saves itself: leaving it or pressing Enter saves a changed value, Escape puts the
 * saved one back. A loader shows while it saves, then a check; a failed save or an invalid value shows an alert
 * whose tooltip says why, and the draft stays so it can be fixed.
 */
export function AutosaveInput({
  value,
  onSave,
  label,
  validate,
  className,
  onBlur,
  onKeyDown,
  'aria-describedby': describedBy,
  ...props
}: AutosaveInputProps) {
  // What this field last saved, until the parent's `value` changes (usually to that same value).
  const [lastSave, setLastSave] = useState<Stamped<string>>();
  const saved = current(lastSave, value) ?? value;
  const [draftState, setDraftState] = useState<Stamped<string>>();
  const draft = current(draftState, saved) ?? saved;
  const [errorState, setErrorState] = useState<Stamped<string>>();
  const error = current(errorState, saved);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  // A save in flight, read synchronously so Enter followed by blur saves once.
  const savingRef = useRef(false);
  const checkTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const errorId = useId();

  const dirty = draft !== saved;

  function edit(next: string) {
    setDraftState({ data: next, value: saved });
    setErrorState(undefined);
    clearTimeout(checkTimerRef.current);
    setJustSaved(false);
  }

  function revert() {
    setDraftState(undefined);
    setErrorState(undefined);
  }

  async function save() {
    if (savingRef.current || !dirty) return;
    const invalid = validate?.(draft);
    if (invalid) {
      setErrorState({ data: invalid, value: saved });
      return;
    }
    setErrorState(undefined);
    savingRef.current = true;
    setSaving(true);
    try {
      await onSave(draft);
      setLastSave({ data: draft, value });
      setDraftState(undefined);
      setJustSaved(true);
      clearTimeout(checkTimerRef.current);
      checkTimerRef.current = setTimeout(() => setJustSaved(false), SAVED_CHECK_MS);
    } catch (err) {
      setErrorState({ data: err instanceof Error && err.message ? err.message : FALLBACK_ERROR, value: saved });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      void save();
    } else if (event.key === 'Escape' && !savingRef.current && (dirty || error)) {
      // Revert, and stay in the field. A clean field lets Escape through (to blur it or close a dialog), and so does
      // a field mid-save: the save already started, so there's nothing to revert yet.
      event.preventDefault();
      revert();
    }
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    onBlur?.(event);
    // Focus moving to the alert, to read the error, isn't leaving the field.
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.closest('[data-slot=input-group]')?.contains(next)) return;
    void save();
  }

  return (
    <InputGroup className={className}>
      <InputGroupInput
        {...props}
        aria-label={label}
        value={draft}
        readOnly={saving}
        aria-invalid={error ? true : undefined}
        aria-describedby={joinIds(describedBy, error ? errorId : undefined)}
        onChange={event => edit(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
      <AutosaveInputStatus status={statusOf(saving, error, justSaved)} label={label} error={error} errorId={errorId} />
    </InputGroup>
  );
}
