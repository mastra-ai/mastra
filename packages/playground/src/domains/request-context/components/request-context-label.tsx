import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
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
      <Txt as={as} variant="ui-md" className="text-neutral3">
        {children}
      </Txt>

      {tooltip && (
        <TooltipProvider delay={10}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={ariaLabel}
                className="rounded-sm text-neutral3 transition-colors hover:text-neutral6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border2"
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
