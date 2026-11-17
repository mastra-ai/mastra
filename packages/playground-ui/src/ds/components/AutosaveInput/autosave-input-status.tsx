import { InputGroupAddon } from '../InputGroup';
import { AutosaveInputGlyph, glyphClassName } from './autosave-input-glyph';
import type { AutosaveInputStatusValue } from './autosave-input-glyph';
import { cn } from '@/lib/utils';

export type { AutosaveInputStatusValue } from './autosave-input-glyph';

export type AutosaveInputStatusProps = {
  status: AutosaveInputStatusValue;
  label: string;
  /** Shown in the alert's tooltip while `status` is `error`. */
  error?: string;
  /** The tooltip's id, which the input also points `aria-describedby` at. */
  errorId: string;
};

/**
 * The end of an `AutosaveInput`: empty while idle, then a loader, a check, or an alert whose tooltip shows `error`.
 * Always rendered, so the field's width never changes. Exported for stories that pin each state.
 */
export function AutosaveInputStatus({ status, label, error, errorId }: AutosaveInputStatusProps) {
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
        <span className={cn('flex items-center justify-center', glyphClassName)}>
          <AutosaveInputGlyph status={status} label={label} error={error} errorId={errorId} />
        </span>
      </InputGroupAddon>
      <span className="sr-only" role="status">
        {announcement(status, label)}
      </span>
    </>
  );
}

function announcement(status: AutosaveInputStatusValue, label: string) {
  if (status === 'saving') return `Saving ${label}`;
  if (status === 'saved') return `${label} saved`;
  return '';
}
