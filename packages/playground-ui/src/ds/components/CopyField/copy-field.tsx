'use client';

import type { ClipboardEvent } from 'react';
import { InputGroup, InputGroupAddon, InputGroupButton, inputGroupControlClassName } from '../InputGroup/input-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../Tooltip';
import { useMiddleTruncation } from './use-middle-truncation';
import { IconCheckmark2Medium } from '@/ds/icons/central/IconCheckmark2Medium';
import { IconSquareBehindSquare1 } from '@/ds/icons/central/IconSquareBehindSquare1';
import { fieldTriggerWidthStyle } from '@/ds/primitives/form-element';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { cn } from '@/lib/utils';

export type CopyFieldProps = {
  value: string;
  /** What's being copied, e.g. "organization ID": names the field and its copy button. */
  label: string;
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
export function CopyField({ value, label, className }: CopyFieldProps) {
  const { ref, text, truncated } = useMiddleTruncation<HTMLSpanElement>(value);
  const { isCopied, handleCopy } = useCopyToClipboard({ text: value, showToast: false });

  // What's selected is the shortened text; put the real value on the clipboard instead.
  const copyWholeValue = (event: ClipboardEvent<HTMLElement>) => {
    if (!truncated) return;
    // Only a selection inside this value: one that runs into the next row keeps its own text.
    const selection = window.getSelection();
    const field = event.currentTarget;
    if (!selection || !field.contains(selection.anchorNode) || !field.contains(selection.focusNode)) return;
    event.preventDefault();
    event.clipboardData.setData('text/plain', value);
  };

  // The app may set tooltips to open instantly; this field keeps the standard delay so hovering past it is quiet.
  return (
    <TooltipProvider>
      <InputGroup aria-label={label} className={cn(fieldTriggerWidthStyle, 'flex-initial', className)}>
        <Tooltip disabled={!truncated}>
          <TooltipTrigger
            render={<span />}
            data-slot="input-group-control"
            translate="no"
            onCopy={copyWholeValue}
            className={cn(inputGroupControlClassName, 'flex items-center font-mono font-normal text-muted-foreground')}
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
          <InputGroupButton onClick={handleCopy} tooltip="Copy" aria-label={`Copy ${label}`}>
            {isCopied ? <IconCheckmark2Medium /> : <IconSquareBehindSquare1 />}
          </InputGroupButton>
          <span role="status" className="sr-only">
            {isCopied ? `${label} copied` : ''}
          </span>
        </InputGroupAddon>
      </InputGroup>
    </TooltipProvider>
  );
}
