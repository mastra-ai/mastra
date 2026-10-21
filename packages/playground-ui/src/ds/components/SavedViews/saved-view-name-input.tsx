import { useRef } from 'react';
import { MAX_SAVED_VIEW_NAME_CHARS } from './saved-view-schema';
import { passwordManagerOptOutProps } from '@/ds/primitives/password-manager-autofill';

// Uncontrolled so blur is the one exit: Enter blurs, Escape restores the name (or cancels) first, blur commits.
export function SavedViewNameInput({
  name,
  onCommit,
  onCancel,
}: {
  name: string;
  onCommit: (name: string) => void;
  /** Escape calls this instead of restoring the name. */
  onCancel?: () => void;
}) {
  const cancelled = useRef(false);
  return (
    <input
      autoFocus
      aria-label="View name"
      defaultValue={name}
      maxLength={MAX_SAVED_VIEW_NAME_CHARS}
      {...passwordManagerOptOutProps}
      onFocus={event => event.currentTarget.select()}
      onBlur={event => {
        if (cancelled.current && onCancel) onCancel();
        else onCommit(event.currentTarget.value);
      }}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          if (onCancel) cancelled.current = true;
          else event.currentTarget.value = name;
        }
        if (event.key === 'Enter' || event.key === 'Escape') {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      className="field-sizing-content min-w-12 bg-transparent text-foreground outline-hidden"
    />
  );
}
