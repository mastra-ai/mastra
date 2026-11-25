import { useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../Tooltip';
import { IconCheckmark2Medium } from '@/ds/icons/central/IconCheckmark2Medium';
import { IconExclamationCircle } from '@/ds/icons/central/IconExclamationCircle';
import { IconSquareBehindSquare1 } from '@/ds/icons/central/IconSquareBehindSquare1';
import type { CopyStatus } from '@/hooks/use-copy-to-clipboard';

export type CopyIconProps = {
  status: CopyStatus;
  /** Shown until it's copied. Default: the copy icon. */
  icon?: ReactNode;
  className?: string;
};

/** The icon of a control that copies: a checkmark in the same place once it's copied. */
export function CopyIcon({ status, icon, className }: CopyIconProps) {
  if (status === 'copied') return <IconCheckmark2Medium aria-hidden className={className} />;
  if (status === 'failed') return <IconExclamationCircle aria-hidden className={className} />;
  return icon ?? <IconSquareBehindSquare1 aria-hidden className={className} />;
}

const STATUS_LABELS = { copied: 'Copied', failed: 'Failed' } as const;

export type CopyLabelProps = {
  status: CopyStatus;
  /** Shown until it's copied, e.g. "Copy prompt". */
  children: string;
};

/** The label of a control that copies: "Copied" once it's copied, in the width of its longest text. */
export function CopyLabel({ status, children }: CopyLabelProps) {
  return (
    <span className="inline-grid text-start">
      {/* Drawn as CSS content, so it only holds the width: never read out, selected or found as more text. */}
      {[children, ...Object.values(STATUS_LABELS)].map(text => (
        <span
          key={text}
          aria-hidden
          data-label={text}
          className="invisible col-start-1 row-start-1 before:content-[attr(data-label)]"
        />
      ))}
      <span className="col-start-1 row-start-1">{status === 'idle' ? children : STATUS_LABELS[status]}</span>
    </span>
  );
}

const STATUS_TOOLTIPS = { copied: 'Copied', failed: 'Couldn’t copy' } as const;

export type CopyTooltipProps = {
  status: CopyStatus;
  /** Shown until it's copied, e.g. "Copy run ID". */
  label: ReactNode;
  /** Opens the tooltip on copy, for a control with no icon to turn into a checkmark. */
  openOnCopy?: boolean;
  /** The control that copies. */
  children: ReactElement;
};

/** The tooltip of a control that copies: stays open through the click and says "Copied". */
export function CopyTooltip({ status, label, openOnCopy = false, children }: CopyTooltipProps) {
  const [open, setOpen] = useState(false);
  // Escape, or the pointer leaving, closes what the copy opened. The next copy opens it again.
  const [dismissed, setDismissed] = useState(false);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    setDismissed(!nextOpen);
  }

  return (
    <Tooltip open={open || (openOnCopy && status !== 'idle' && !dismissed)} onOpenChange={handleOpenChange}>
      <TooltipTrigger closeOnClick={false} onClick={() => setDismissed(false)} render={children} />
      <TooltipContent>{status === 'idle' ? label : STATUS_TOOLTIPS[status]}</TooltipContent>
    </Tooltip>
  );
}
