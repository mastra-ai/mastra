import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { cn } from '@mastra/playground-ui/utils/cn';

import type { WorkflowCardIndicator } from './workflow-card-badge-utils';

export interface WorkflowCardIndicatorListProps {
  indicators: WorkflowCardIndicator[];
  className?: string;
}

export const WorkflowCardBadges = ({ indicators, className }: WorkflowCardIndicatorListProps) => {
  if (!indicators.length) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {indicators.map(indicator => {
        const IndicatorIcon = indicator.icon;

        return (
          <Tooltip key={`badge-${indicator.id}`}>
            <TooltipTrigger asChild>
              <span
                role="img"
                tabIndex={0}
                aria-label={indicator.label}
                data-testid={`workflow-card-indicator-${indicator.id}`}
                className="text-neutral5 focus-visible:ring-accent1 inline-flex h-5 w-5 shrink-0 items-center justify-center focus-visible:ring-1 focus-visible:outline-hidden"
              >
                <Icon size="sm">
                  <IndicatorIcon className="text-current" style={{ color: indicator.color }} />
                </Icon>
              </span>
            </TooltipTrigger>
            <TooltipContent>{indicator.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
};
