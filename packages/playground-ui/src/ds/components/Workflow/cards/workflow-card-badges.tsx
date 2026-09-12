import type { WorkflowCardIndicator } from './workflow-card-badge-utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Icon } from '@/ds/icons/Icon';
import { cn } from '@/utils/cn';

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
            <TooltipTrigger
              render={
                <span
                  role="img"
                  tabIndex={0}
                  aria-label={indicator.label}
                  data-testid={`workflow-card-indicator-${indicator.id}`}
                  className="text-neutral5 focus-visible:ring-accent1 inline-flex size-5 shrink-0 items-center justify-center focus-visible:ring-1 focus-visible:outline-hidden"
                />
              }
            >
              <Icon size="sm">
                <IndicatorIcon className="text-current" style={{ color: indicator.color }} />
              </Icon>
            </TooltipTrigger>
            <TooltipContent>{indicator.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
};
