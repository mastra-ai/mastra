import { MAX_SAVED_VIEW_NAME_CHARS } from './saved-view-schema';
import { textFieldAutofillProps } from '@/ds/primitives/password-manager-autofill';

// Uncontrolled so blur is the one exit: Enter blurs, Escape restores the name first, blur commits.
export function SavedViewNameInput({ name, onCommit }: { name: string; onCommit: (name: string) => void }) {
  return (
    <input
      autoFocus
      aria-label="View name"
      defaultValue={name}
      maxLength={MAX_SAVED_VIEW_NAME_CHARS}
      {...textFieldAutofillProps(undefined)}
      onFocus={event => event.currentTarget.select()}
      onBlur={event => onCommit(event.currentTarget.value)}
      onKeyDown={event => {
        if (event.key === 'Escape') event.currentTarget.value = name;
        if (event.key === 'Enter' || event.key === 'Escape') {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      className="field-sizing-content min-w-12 bg-transparent text-foreground outline-hidden"
    />
  );
}
