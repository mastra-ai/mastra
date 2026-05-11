import React from 'react';
import { Button } from './Button';
import type { ButtonProps } from './Button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { cn } from '@/lib/utils';

export interface ButtonWithTooltipProps extends ButtonProps {
  tooltipContent: React.ReactNode;
  /** When true, renders a small dot in the top-right corner of the button —
   *  a generic "this control has state worth noticing" affordance (active
   *  filter, applied customization, pending change, etc.). */
  indicator?: boolean;
}

export const ButtonWithTooltip = React.forwardRef<HTMLButtonElement, ButtonWithTooltipProps>(
  ({ tooltipContent, indicator, children, className, ...buttonProps }, ref) => {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button ref={ref} {...buttonProps} className={cn(indicator && 'relative', className)}>
            {children}
            {indicator && (
              <span
                aria-hidden
                className={cn(
                  'pointer-events-none absolute top-0.5 right-0.5 size-1.5 rounded-full bg-accent6 ring-1 ring-surface2',
                )}
              />
            )}
          </Button>
        </TooltipTrigger>
        {tooltipContent && <TooltipContent>{tooltipContent}</TooltipContent>}
      </Tooltip>
    );
  },
);

ButtonWithTooltip.displayName = 'ButtonWithTooltip';
