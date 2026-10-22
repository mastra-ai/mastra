import { Info } from 'lucide-react';
import * as React from 'react';

import { cn } from '../../../lib/utils';
import { Icon } from '../../icons/Icon';
import { controlStateColorTransition, focusRing } from '../../primitives/transitions';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';
import type { TooltipContentProps } from './tooltip';

type InfoTooltipProps = {
  /** The explanation shown in the tooltip, and read to screen readers as the icon's description. */
  children: React.ReactNode;
  side?: TooltipContentProps['side'];
  align?: TooltipContentProps['align'];
  /** Layout of the tooltip body, such as a wider `max-w-*` or `space-y-*` for rich content. */
  contentClassName?: string;
} &
  /** What the icon is about, e.g. "Version information": an icon-only button needs a name. */
  ({ 'aria-label': string; 'aria-labelledby'?: never } | { 'aria-label'?: never; 'aria-labelledby': string });

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
            // The popup stays mounted (hidden) while closed, so screen readers always get the text.
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
      <TooltipContent
        id={descriptionId}
        keepMounted
        side={side}
        align={align}
        className={cn('max-w-64', contentClassName)}
      >
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

export { InfoTooltip };
export type { InfoTooltipProps };
