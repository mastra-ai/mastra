import type { ClipboardEvent } from 'react';
import { CopyButton } from '../CopyButton';
import { InputGroup, InputGroupAddon, inputGroupControlClassName } from '../InputGroup/input-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '../Tooltip';
import { useMiddleTruncation } from './use-middle-truncation';
import type { ControlSize } from '@/ds/primitives/control-size';
import { fieldTriggerWidthStyle } from '@/ds/primitives/form-element';
import { cn } from '@/lib/utils';

export type CopyFieldProps = {
  value: string;
  /** What's being copied, e.g. "organization ID": names the field and its copy button. */
  label: string;
  size?: ControlSize;
  disabled?: boolean;
  className?: string;
};

/**
 * A value people copy but never edit, like an ID, a key or a URL. It wears the field material with a copy button
 * inside, shows the value in monospace and cuts a long one in the middle (`org_01KJGEY5…YY27PGS`), keeping the end
 * people compare. Hovering a cut value shows it whole; copying copies it whole, by button or by selection.
 *
 * Width follows `fieldTriggerWidthStyle`: it fills its container, or, where a layout sets `--field-width: auto`
 * (a `SettingsRow`), hugs the value up to `--field-max-width`.
 */
export function CopyField({ value, label, size, disabled, className }: CopyFieldProps) {
  const { ref, text, truncated } = useMiddleTruncation<HTMLSpanElement>(value);

  // What's selected is the shortened text; put the real value on the clipboard instead.
  const copyWholeValue = (event: ClipboardEvent<HTMLElement>) => {
    if (!truncated) return;
    event.preventDefault();
    event.clipboardData.setData('text/plain', value);
  };

  return (
    <InputGroup size={size} aria-label={label} className={cn(fieldTriggerWidthStyle, 'flex-initial', className)}>
      <Tooltip disabled={!truncated}>
        <TooltipTrigger
          render={<span />}
          data-slot="input-group-control"
          translate="no"
          onCopy={copyWholeValue}
          className={cn(
            inputGroupControlClassName,
            'flex items-center font-mono text-muted-foreground',
            disabled && 'cursor-not-allowed',
          )}
        >
          {/* The whole value sizes the box (so it hugs short values); the visible line fits inside it. */}
          <span ref={ref} className="grid min-w-0 grid-cols-[minmax(0,max-content)]">
            {/* Drawn as CSS content, so it's never selected and never found as a second copy of the text. */}
            <span
              aria-hidden
              data-value={value}
              className="invisible col-start-1 row-start-1 h-0 overflow-hidden whitespace-pre select-none before:content-[attr(data-value)]"
            />
            <span
              aria-hidden={truncated || undefined}
              className="col-start-1 row-start-1 overflow-hidden whitespace-pre"
            >
              {text}
            </span>
          </span>
          {truncated && <span className="sr-only select-none">{value}</span>}
        </TooltipTrigger>
        <TooltipContent className="max-w-[min(32rem,90vw)] font-mono break-all">{value}</TooltipContent>
      </Tooltip>
      <InputGroupAddon align="inline-end">
        <CopyButton content={value} tooltip={`Copy ${label}`} variant="ghost" showToast={false} disabled={disabled} />
      </InputGroupAddon>
    </InputGroup>
  );
}
