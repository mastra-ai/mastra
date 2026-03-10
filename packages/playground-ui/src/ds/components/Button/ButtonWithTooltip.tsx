import React from 'react';
import { Button, type ButtonProps } from './Button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';

export interface ButtonWithTooltipProps extends ButtonProps {
  tooltipContent: React.ReactNode;
}

export const ButtonWithTooltip = React.forwardRef<HTMLButtonElement, ButtonWithTooltipProps>(
  ({ tooltipContent, ...buttonProps }, ref) => {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button ref={ref} {...buttonProps} />
        </TooltipTrigger>
        {tooltipContent && <TooltipContent>{tooltipContent}</TooltipContent>}
      </Tooltip>
    );
  },
);

ButtonWithTooltip.displayName = 'ButtonWithTooltip';
