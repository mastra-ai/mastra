import { Txt, cn } from '@mastra/playground-ui';

import { Clock } from '../workflow-clock';
import type { WorkflowStepCardViewProps } from './types';
import { getNodeBadgeInfo } from './workflow-card-badge-utils';
import { WorkflowCardBadges } from './workflow-card-badges';
import { WorkflowCardStatusIcon } from './workflow-card-status-icon';

const WorkflowForEachProgress = ({ foreachProgress }: Pick<WorkflowStepCardViewProps, 'foreachProgress'>) => {
  if (!foreachProgress) {
    return null;
  }

  return (
    <div className="px-3 pb-2 flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface1 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            foreachProgress.iterationStatus === 'failed' ? 'bg-accent2' : 'bg-accent1',
          )}
          style={{
            width: `${
              foreachProgress.totalCount > 0
                ? (foreachProgress.completedCount / foreachProgress.totalCount) * 100
                : 0
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
  const hasSpecialBadge = getNodeBadgeInfo(badgeProps).hasSpecialBadge;

  return (
    <div
      data-workflow-node
      data-workflow-step-status={displayStatus ?? 'idle'}
      data-testid={isNestedWorkflowStep ? 'workflow-nested-node' : 'workflow-default-node'}
      className={cn(
        'bg-surface3 rounded-lg w-[274px] border border-border1',
        hasSpecialBadge ? 'pt-0' : 'pt-2',
        displayStatus === 'success' && 'bg-accent1Darker',
        displayStatus === 'failed' && 'bg-accent2Darker',
        displayStatus === 'tripwire' && 'bg-amber-950/40 border-amber-500/30',
        displayStatus === 'suspended' && 'bg-accent3Darker',
        displayStatus === 'waiting' && 'bg-accent5Darker',
        displayStatus === 'running' && 'bg-accent6Darker',
      )}
    >
      <WorkflowCardBadges {...badgeProps} />
      <div className={cn('flex items-center gap-2 px-3', !description && 'pb-2')}>
        <WorkflowCardStatusIcon displayStatus={displayStatus} hasStep={hasStep} />
        <Txt variant="ui-lg" className="text-neutral6 font-medium inline-flex items-center gap-1 justify-between w-full">
          {label} {startedAt && <Clock startedAt={startedAt} endedAt={endedAt} />}
        </Txt>
      </div>

      {description && (
        <Txt variant="ui-sm" className="text-neutral3 px-3 pb-2">
          {description}
        </Txt>
      )}

      {isForEach && <WorkflowForEachProgress foreachProgress={foreachProgress} />}
      <WorkflowSleepDetails duration={duration} date={date} />
      {actionBar}
    </div>
  );
};
