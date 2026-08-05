import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';

import { Clock } from '../workflow-clock';
import type { WorkflowStepCardViewProps } from './types';
import { getNodeIndicators, getWorkflowCardAccentColor } from './workflow-card-badge-utils';
import { WorkflowCardBadges } from './workflow-card-badges';
import { WorkflowCardStatusIcon } from './workflow-card-status-icon';

const WorkflowForEachProgress = ({ foreachProgress }: Pick<WorkflowStepCardViewProps, 'foreachProgress'>) => {
  if (!foreachProgress) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 pb-2">
      <div className="bg-surface1 h-1.5 flex-1 overflow-hidden rounded-full">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            foreachProgress.iterationStatus === 'failed' ? 'bg-accent2' : 'bg-accent1',
          )}
          style={{
            width: `${
              foreachProgress.totalCount > 0 ? (foreachProgress.completedCount / foreachProgress.totalCount) * 100 : 0
            }%`,
          }}
        />
      </div>
      <Txt variant="ui-xs" className="text-neutral3 whitespace-nowrap">
        {foreachProgress.completedCount} / {foreachProgress.totalCount}
      </Txt>
    </div>
  );
};

const WorkflowSleepDetails = ({ duration, date }: Pick<WorkflowStepCardViewProps, 'duration' | 'date'>) => (
  <>
    {duration && (
      <Txt variant="ui-sm" className="text-neutral3 px-3 pb-2">
        sleeps for <strong>{duration}ms</strong>
      </Txt>
    )}
    {date && (
      <Txt variant="ui-sm" className="text-neutral3 px-3 pb-2">
        sleeps until <strong>{new Date(date).toLocaleString()}</strong>
      </Txt>
    )}
  </>
);

export const WorkflowStepCardView = ({
  label,
  description,
  displayStatus,
  hasStep,
  isNestedWorkflowStep,
  stepKey,
  isSelected,
  isWaiting,
  isHovered,
  onHoverChange,
  duration,
  date,
  isForEach,
  foreachProgress,
  mapConfig,
  canSuspend,
  isParallel,
  stepGraph,
  startedAt,
  endedAt,
  actionBar,
}: WorkflowStepCardViewProps) => {
  const badgeProps = { duration, date, isForEach, mapConfig, canSuspend, isParallel, stepGraph };
  const indicators = getNodeIndicators(badgeProps);
  const accentColor = getWorkflowCardAccentColor(indicators);

  return (
    <div
      data-workflow-node
      data-workflow-step-key={stepKey}
      data-workflow-step-status={displayStatus ?? 'idle'}
      data-workflow-step-active={isSelected ? 'true' : undefined}
      data-workflow-step-waiting={isWaiting ? 'true' : undefined}
      data-workflow-step-hovered={isHovered ? 'true' : undefined}
      data-testid={isNestedWorkflowStep ? 'workflow-nested-node' : 'workflow-default-node'}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      style={accentColor ? { borderLeftColor: accentColor } : undefined}
      className={cn(
        'bg-surface3 rounded-lg w-[274px] border border-border1 transition-colors hover:border-neutral6',
        accentColor && 'border-l-4',
        isHovered && !isSelected && 'border-neutral6',
        isWaiting && !isSelected && 'border-accent3',
        isSelected && 'border-accent1',
      )}
    >
      <div className={cn('flex items-center gap-2 px-3 pt-2', !description && 'pb-2')}>
        <WorkflowCardBadges indicators={indicators} className="shrink-0" />
        <WorkflowCardStatusIcon displayStatus={displayStatus} hasStep={hasStep} />
        <div className="min-w-0 flex-1">
          <Txt variant="ui-sm" className="text-neutral6 block truncate font-medium" title={label}>
            {label}
          </Txt>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {startedAt && <Clock startedAt={startedAt} endedAt={endedAt} />}
          {actionBar}
        </div>
      </div>

      {description && (
        <Txt variant="ui-sm" className="text-neutral3 px-3 pb-2">
          {description}
        </Txt>
      )}

      {isForEach && <WorkflowForEachProgress foreachProgress={foreachProgress} />}
      <WorkflowSleepDetails duration={duration} date={date} />
    </div>
  );
};
