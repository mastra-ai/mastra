import { Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ds/components/Tooltip';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons/Icon';
import { controlStateColorTransition } from '@/ds/primitives/transitions';
import { quietTextHover } from '@/ds/primitives/typography';
import { cn } from '@/utils/cn';

interface RequestContextLabelProps {
  as?: 'label' | 'span';
  children: ReactNode;
  tooltip?: string;
}

export function RequestContextLabel({ as = 'span', children, tooltip }: RequestContextLabelProps) {
  const labelText = typeof children === 'string' ? children.replace(/\s*\([^)]*\)/g, '') : 'Request context';
  const ariaLabel = `${labelText} details`;

  return (
    <div className="flex items-center gap-1.5">
      <Txt as={as} variant="body" tone="muted">
        {children}
      </Txt>

      {tooltip && (
        <TooltipProvider delay={10}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={ariaLabel}
                className={cn(
                  quietTextHover,
                  controlStateColorTransition,
                  'rounded-sm focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:outline-none',
                )}
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
