import { Tooltip, TooltipContent, TooltipTrigger } from '../Tooltip';
import type { AutosaveInputStatusProps } from './autosave-input-status';
import { IconCheckmark2Medium } from '@/ds/icons/central/IconCheckmark2Medium';
import { IconExclamationCircle } from '@/ds/icons/central/IconExclamationCircle';
import { IconLoadingCircle } from '@/ds/icons/central/IconLoadingCircle';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';
import './autosave-input.css';

export type AutosaveInputStatusValue = 'idle' | 'saving' | 'saved' | 'error';

/** The loader, check and alert are icons from one set at one icon size, and they share one slot that size. */
export const glyphClassName = 'size-icon-sm shrink-0';

/** The icon an `AutosaveInputStatus` shows: a loader, a check, or an alert whose tooltip says what went wrong. */
export function AutosaveInputGlyph({ status, label, error, errorId }: AutosaveInputStatusProps) {
  if (status === 'saving') {
    return <IconLoadingCircle className={cn(glyphClassName, 'motion-safe:animate-spin')} aria-hidden />;
  }
  if (status === 'saved') {
    return <IconCheckmark2Medium className={cn('autosave-input-glyph', glyphClassName)} aria-hidden />;
  }
  if (status === 'error') {
    return (
      <Tooltip>
        <TooltipTrigger
          // The alert is the only way to read the error, so its tooltip opens at once.
          delay={0}
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
    );
  }
  return null;
}
