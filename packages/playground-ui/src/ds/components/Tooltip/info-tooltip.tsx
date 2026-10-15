import { Info } from 'lucide-react';
import * as React from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';
import type { TooltipContentProps } from './tooltip';
import { Icon } from '@/ds/icons/Icon';
import { controlStateColorTransition, focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

type InfoTooltipProps = {
  /** The explanation shown in the tooltip, and read to screen readers as the icon's description. */
  children: React.ReactNode;
  /** What the icon is about, e.g. "About Display name". Give this or `aria-labelledby`. */
  'aria-label'?: string;
  'aria-labelledby'?: string;
  side?: TooltipContentProps['side'];
  align?: TooltipContentProps['align'];
  /** Layout of the tooltip body, such as a wider `max-w-*` or `space-y-*` for rich content. */
  contentClassName?: string;
};

/** A muted info icon that explains the thing next to it in a tooltip, on hover or keyboard focus. */
function InfoTooltip({ children, side = 'top', align, contentClassName, ...name }: InfoTooltipProps) {
  const descriptionId = React.useId();

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            {...name}
            // The tooltip only mounts while open, so screen readers get the text from this copy.
            aria-describedby={descriptionId}
            // A step quieter than the placeholder grey at rest, so it reads as a hint, not a control.
            className={cn(
              'flex shrink-0 cursor-help items-center rounded-full text-placeholder/80 hover:text-muted-foreground focus-visible:text-muted-foreground',
              controlStateColorTransition,
              focusRing,
            )}
          />
        }
      >
        <Icon size="xs">
          <Info />
        </Icon>
      </TooltipTrigger>
      <TooltipContent side={side} align={align} className={cn('max-w-64', contentClassName)}>
        {children}
      </TooltipContent>
      <span id={descriptionId} hidden>
        {children}
      </span>
    </Tooltip>
  );
}

export { InfoTooltip };
export type { InfoTooltipProps };
