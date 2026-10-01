import { Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { FieldLabel } from '@/ds/components/Field';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ds/components/Tooltip';
import { Icon } from '@/ds/icons/Icon';
import { controlStateColorTransition, focusRing } from '@/ds/primitives/transitions';
import { quietTextHover } from '@/ds/primitives/typography';
import { cn } from '@/utils/cn';

interface RequestContextLabelProps {
  children: ReactNode;
  tooltip?: string;
}

export function RequestContextLabel({ children, tooltip }: RequestContextLabelProps) {
  const labelText = typeof children === 'string' ? children.replace(/\s*\([^)]*\)/g, '') : 'Request context';
  const ariaLabel = `${labelText} details`;

  return (
    <div className="flex items-center gap-1.5">
      <FieldLabel>{children}</FieldLabel>

      {tooltip && (
        <TooltipProvider delay={10}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={ariaLabel}
                className={cn(quietTextHover, controlStateColorTransition, 'rounded-sm', focusRing)}
              >
                <Icon size="xs">
                  <Info />
                </Icon>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-60">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
