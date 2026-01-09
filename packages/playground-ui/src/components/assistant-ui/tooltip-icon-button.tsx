import { forwardRef } from 'react';

import { Button, ButtonProps } from '@/ds/components/Button/Button';
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
            <Button {...rest} className={cn('size-6 p-1', className)} ref={ref} aria-label={tooltip}>
              {children}
            </Button>
          </TooltipTrigger>
          <TooltipContent side={side}>{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  },
);

TooltipIconButton.displayName = 'TooltipIconButton';
