import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { CircleDashed, HourglassIcon, Loader2, PauseIcon, ShieldAlert } from 'lucide-react';
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
  const { steps } = useCurrentRun();
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

  const stepKey = parentWorkflowName ? `${parentWorkflowName}.${stepId || label}` : stepId || label;

  const step = steps[stepKey];

  // Check if this is a tripwire (failed step with tripwire property)
  const isTripwire = step?.status === 'failed' && step?.tripwire !== undefined;
  const displayStatus = isTripwire ? 'tripwire' : step?.status;

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
        data-workflow-step-status={displayStatus ?? 'idle'}
        data-testid="workflow-default-node"
        className={cn(
          'bg-surface3 rounded-lg w-[274px] border-sm border-border1',
          hasSpecialBadge ? 'pt-0' : 'pt-2',
          displayStatus === 'success' && 'bg-accent1Darker',
          displayStatus === 'failed' && 'bg-accent2Darker',
          displayStatus === 'tripwire' && 'bg-amber-950/40 border-amber-500/30',
          displayStatus === 'suspended' && 'bg-accent3Darker',
          displayStatus === 'waiting' && 'bg-accent5Darker',
          displayStatus === 'running' && 'bg-accent6Darker',
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
            {displayStatus === 'tripwire' && <ShieldAlert className="text-amber-400" />}
            {displayStatus === 'failed' && <CrossIcon className="text-accent2" />}
            {displayStatus === 'success' && <CheckIcon className="text-accent1" />}
            {displayStatus === 'suspended' && <PauseIcon className="text-accent3" />}
            {displayStatus === 'waiting' && <HourglassIcon className="text-accent5" />}
            {displayStatus === 'running' && <Loader2 className="text-accent6 animate-spin" />}
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
          suspendOutput={step?.suspendOutput}
          error={isTripwire ? undefined : step?.error}
          tripwire={isTripwire ? step?.tripwire : undefined}
          mapConfig={mapConfig}
          status={displayStatus as any}
          stepKey={stepKey}
        />
      </div>

      {!withoutBottomHandle && (
        <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden', color: 'red' }} />
      )}
    </>
  );
}
