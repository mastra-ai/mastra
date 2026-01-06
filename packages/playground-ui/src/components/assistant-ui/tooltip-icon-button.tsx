'use client';

import { forwardRef } from 'react';

import { ButtonProps } from '@/ds/components/Button/Button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { cn } from '@/lib/utils';

export type TooltipIconButtonProps = ButtonProps & {
  tooltip: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
};

export const TooltipIconButton = forwardRef<HTMLButtonElement, TooltipIconButtonProps>(
  ({ children, tooltip, side = 'bottom', className, ...rest }, ref) => {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              {...rest}
              className={cn(
                'bg-surface2 border-sm border-border1 px-lg text-ui-md inline-flex items-center justify-center rounded-md border h-button-md gap-md hover:bg-surface4 text-icon3 hover:text-icon6',
                'size-6 p-1',
                className,
              )}
              ref={ref}
              aria-label={tooltip}
            >
              {children}
            </button>
          </TooltipTrigger>
          <TooltipContent side={side}>{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  },
);

TooltipIconButton.displayName = 'TooltipIconButton';
