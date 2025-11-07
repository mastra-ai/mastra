import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { CircleDashed, HourglassIcon, Loader2, PauseIcon } from 'lucide-react';
import { useCurrentRun } from '../context/use-current-run';
import { CheckIcon, CrossIcon, Icon } from '@/ds/icons';
import { Txt } from '@/ds/components/Txt';
import { Badge } from '@/ds/components/Badge';

import { Clock } from './workflow-clock';
import { BADGE_COLORS, BADGE_ICONS, getNodeBadgeInfo } from './workflow-node-badges';

import { cn } from '@/lib/utils';
import { WorkflowStepActionBar } from './workflow-step-action-bar';

export type DefaultNode = Node<
  {
    label: string;
    stepId?: string;
    description?: string;
    withoutTopHandle?: boolean;
    withoutBottomHandle?: boolean;
    mapConfig?: string;
    duration?: number;
    date?: Date;
    isParallel?: boolean;
    canSuspend?: boolean;
    isForEach?: boolean;
  },
  'default-node'
>;

export interface WorkflowDefaultNodeProps {
  parentWorkflowName?: string;
}

export function WorkflowDefaultNode({ data, parentWorkflowName }: NodeProps<DefaultNode> & WorkflowDefaultNodeProps) {
  const { steps, runId } = useCurrentRun();
  const {
    label,
    stepId,
    description,
    withoutTopHandle,
    withoutBottomHandle,
    mapConfig,
    duration,
    date,
    isParallel,
    canSuspend,
    isForEach,
  } = data;

  const fullLabel = parentWorkflowName ? `${parentWorkflowName}.${label}` : label;
  const stepKey = parentWorkflowName ? `${parentWorkflowName}.${stepId || label}` : stepId || label;

  const step = steps[stepKey];

  const { isSleepNode, isForEachNode, isMapNode, hasSpecialBadge } = getNodeBadgeInfo({
    duration,
    date,
    isForEach,
    mapConfig,
    canSuspend,
    isParallel,
  });

  return (
    <>
      {!withoutTopHandle && <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />}

      <div
        data-workflow-node
        data-workflow-step-status={step?.status ?? 'idle'}
        data-testid="workflow-default-node"
        className={cn(
          'bg-surface3 rounded-lg w-[274px] border-sm border-border1',
          hasSpecialBadge ? 'pt-0' : 'pt-2',
          step?.status === 'success' && 'bg-accent1Darker',
          step?.status === 'failed' && 'bg-accent2Darker',
          step?.status === 'suspended' && 'bg-accent3Darker',
          step?.status === 'waiting' && 'bg-accent5Darker',
          step?.status === 'running' && 'bg-accent6Darker',
        )}
      >
        {hasSpecialBadge && (
          <div className="px-3 pt-2 pb-1 flex gap-1.5 flex-wrap">
            {isSleepNode && (
              <Badge
                icon={
                  date ? (
                    <BADGE_ICONS.sleepUntil className="text-current" style={{ color: BADGE_COLORS.sleep }} />
                  ) : (
                    <BADGE_ICONS.sleep className="text-current" style={{ color: BADGE_COLORS.sleep }} />
                  )
                }
              >
                {date ? 'SLEEP UNTIL' : 'SLEEP'}
              </Badge>
            )}
            {canSuspend && (
              <Badge icon={<BADGE_ICONS.suspend className="text-current" style={{ color: BADGE_COLORS.suspend }} />}>
                SUSPEND/RESUME
              </Badge>
            )}
            {isParallel && (
              <Badge icon={<BADGE_ICONS.parallel className="text-current" style={{ color: BADGE_COLORS.parallel }} />}>
                PARALLEL
              </Badge>
            )}
            {isForEachNode && (
              <Badge icon={<BADGE_ICONS.forEach className="text-current" style={{ color: BADGE_COLORS.forEach }} />}>
                FOREACH
              </Badge>
            )}
            {isMapNode && (
              <Badge icon={<BADGE_ICONS.map className="text-current" style={{ color: BADGE_COLORS.map }} />}>MAP</Badge>
            )}
          </div>
        )}
        <div className={cn('flex items-center gap-2 px-3', !description && 'pb-2')}>
          <Icon>
            {step?.status === 'failed' && <CrossIcon className="text-accent2" />}
            {step?.status === 'success' && <CheckIcon className="text-accent1" />}
            {step?.status === 'suspended' && <PauseIcon className="text-accent3" />}
            {step?.status === 'waiting' && <HourglassIcon className="text-accent5" />}
            {step?.status === 'running' && <Loader2 className="text-accent6 animate-spin" />}
            {!step && <CircleDashed className="text-icon2" />}
          </Icon>

          <Txt variant="ui-lg" className="text-icon6 font-medium inline-flex items-center gap-1 justify-between w-full">
            {label} {step?.startedAt && <Clock startedAt={step.startedAt} endedAt={step.endedAt} />}
          </Txt>
        </div>

        {description && (
          <Txt variant="ui-sm" className="text-icon3 px-3 pb-2">
            {description}
          </Txt>
        )}
        {duration && (
          <Txt variant="ui-sm" className="text-icon3 px-3 pb-2">
            sleeps for <strong>{duration}ms</strong>
          </Txt>
        )}

        {date && (
          <Txt variant="ui-sm" className="text-icon3 px-3 pb-2">
            sleeps until <strong>{new Date(date).toLocaleString()}</strong>
          </Txt>
        )}

        <WorkflowStepActionBar
          stepName={label}
          stepId={stepId}
          input={step?.input}
          resumeData={step?.resumeData}
          output={step?.output}
          error={step?.error}
          mapConfig={mapConfig}
          status={step?.status}
        />
      </div>

      {!withoutBottomHandle && (
        <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden', color: 'red' }} />
      )}
    </>
  );
}
