import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { controlStateColorTransition } from '@mastra/playground-ui/primitives/transitions';
import { quietTextHover } from '@mastra/playground-ui/primitives/typography';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Info } from 'lucide-react';
import type { ReactNode } from 'react';

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
      <Txt as={as} variant="body" className="text-muted-foreground">
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
                  'focus-visible:ring-border-strong rounded-sm focus-visible:ring-2 focus-visible:outline-none',
                )}
              >
                <Icon size="sm">
                  <Info />
                </Icon>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px]">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
