import { useId, useRef, useState } from 'react';
import type { FocusEvent, KeyboardEvent } from 'react';
import { InputGroup, InputGroupAddon, InputGroupInput } from '../InputGroup';
import type { InputGroupInputProps } from '../InputGroup';
import { Tooltip, TooltipContent, TooltipTrigger } from '../Tooltip';
import { IconCheckmark2Medium } from '@/ds/icons/central/IconCheckmark2Medium';
import { IconExclamationCircle } from '@/ds/icons/central/IconExclamationCircle';
import { IconLoadingCircle } from '@/ds/icons/central/IconLoadingCircle';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';
import './autosave-input.css';

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
  /** Checks the draft before saving. Return the message to show, or `null` when it's fine. */
  validate?: (value: string) => string | null;
};

/** How long the check stays after a save. */
const SAVED_CHECK_MS = 1600;

/**
 * The loader, check and alert are icons from one set at one icon size, so they read as the same size, and they share
 * one slot at the end of the field, so swapping them moves nothing.
 */
const glyphClassName = 'size-icon-md shrink-0';

export type AutosaveInputStatusValue = 'idle' | 'saving' | 'saved' | 'error';

/**
 * A settings text field that saves itself: leaving it or pressing Enter saves a changed value, Escape puts the
 * saved one back. A spinner shows while it saves, then a check; a failed save or an invalid value shows an alert
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
  ...props
}: AutosaveInputProps) {
  const [draft, setDraft] = useState(value);
  const [saved, setSaved] = useState(value);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A save in flight, read synchronously so Enter followed by blur saves once.
  const savingRef = useRef(false);
  const checkTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const errorId = useId();

  // A new saved value from outside (a refetch, another tab) replaces the draft.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(value);
    setSaved(value);
    setError(null);
  }

  const dirty = draft !== saved;

  function hideCheck() {
    clearTimeout(checkTimerRef.current);
    setJustSaved(false);
  }

  async function save() {
    if (savingRef.current || !dirty) return;
    const invalid = validate?.(draft) ?? null;
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    savingRef.current = true;
    setSaving(true);
    const submitted = draft;
    try {
      await onSave(submitted);
      setSaved(submitted);
      setJustSaved(true);
      clearTimeout(checkTimerRef.current);
      checkTimerRef.current = setTimeout(() => setJustSaved(false), SAVED_CHECK_MS);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Couldn't save. Try again.");
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
    } else if (event.key === 'Escape' && (dirty || error)) {
      // Revert, and stay in the field. A clean field lets Escape through (to blur it or close a dialog).
      event.preventDefault();
      setDraft(saved);
      setError(null);
    }
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    onBlur?.(event);
    // Focus moving to the alert, to read the error, isn't leaving the field.
    if (event.currentTarget.closest('[data-slot=input-group]')?.contains(event.relatedTarget)) return;
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
        aria-describedby={error ? errorId : undefined}
        onChange={event => {
          setDraft(event.target.value);
          setError(null);
          hideCheck();
        }}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
      <AutosaveInputStatus
        status={saving ? 'saving' : error ? 'error' : justSaved ? 'saved' : 'idle'}
        label={label}
        error={error}
        errorId={errorId}
      />
    </InputGroup>
  );
}

/**
 * The end of an `AutosaveInput`: empty while idle, then a loader, a check, or an alert whose tooltip shows `error`.
 * Always rendered, so the field's width never changes. Exported for stories that pin each state.
 */
export function AutosaveInputStatus({
  status,
  label,
  error,
  errorId,
}: {
  status: AutosaveInputStatusValue;
  label: string;
  error?: string | null;
  errorId: string;
}) {
  return (
    <>
      <InputGroupAddon
        align="inline-end"
        className={cn(
          // The addon colours its glyphs through --control-icon.
          status === 'error' && '[--control-icon:var(--color-destructive-foreground)]',
          status === 'saved' && '[--control-icon:var(--color-success-indicator)]',
        )}
      >
        <span className="flex size-icon-md items-center justify-center">
          {status === 'saving' ? (
            <IconLoadingCircle className={cn(glyphClassName, 'motion-safe:animate-spin')} aria-hidden />
          ) : status === 'error' ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label={`${label} error`}
                    aria-describedby={errorId}
                    className={cn('autosave-input-glyph flex cursor-help rounded-full', focusRing)}
                  />
                }
              >
                <IconExclamationCircle className={glyphClassName} aria-hidden />
              </TooltipTrigger>
              {/* Kept mounted (hidden) while closed, so the input and the alert can point screen readers at it. */}
              <TooltipContent id={errorId} keepMounted side="top" className="max-w-64">
                {error}
              </TooltipContent>
            </Tooltip>
          ) : status === 'saved' ? (
            <IconCheckmark2Medium className={cn('autosave-input-glyph', glyphClassName)} aria-hidden />
          ) : null}
        </span>
      </InputGroupAddon>
      <span className="sr-only" role="status">
        {status === 'saving' ? `Saving ${label}` : status === 'saved' ? `${label} saved` : ''}
      </span>
    </>
  );
}
