import { Handle, Position } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import { CircleDashed, HourglassIcon, Loader2, PauseIcon } from 'lucide-react';
import { SerializedStepFlowEntry } from '@mastra/core/workflows';

import { cn } from '@/lib/utils';
import { useContext } from 'react';
import { WorkflowNestedGraphContext } from '../context/workflow-nested-graph-context';
import { useCurrentRun } from '../context/use-current-run';
import { CheckIcon, CrossIcon, Icon } from '@/ds/icons';
import { Txt } from '@/ds/components/Txt';
import { Badge } from '@/ds/components/Badge';
import { Clock } from './workflow-clock';
import { WorkflowStepActionBar } from './workflow-step-action-bar';
import { BADGE_COLORS, BADGE_ICONS, getNodeBadgeInfo } from './workflow-node-badges';

export type NestedNode = Node<
  {
    label: string;
    stepId?: string;
    description?: string;
    withoutTopHandle?: boolean;
    withoutBottomHandle?: boolean;
    stepGraph: SerializedStepFlowEntry[];
    mapConfig?: string;
    isParallel?: boolean;
    canSuspend?: boolean;
    isForEach?: boolean;
  },
  'nested-node'
>;

export interface WorkflowNestedNodeProps {
  parentWorkflowName?: string;
}

export function WorkflowNestedNode({ data, parentWorkflowName }: NodeProps<NestedNode> & WorkflowNestedNodeProps) {
  const { steps } = useCurrentRun();
  const { showNestedGraph } = useContext(WorkflowNestedGraphContext);

  const {
    label,
    stepId,
    description,
    withoutTopHandle,
    withoutBottomHandle,
    stepGraph,
    mapConfig,
    isParallel,
    canSuspend,
    isForEach,
  } = data;

  const fullLabel = parentWorkflowName ? `${parentWorkflowName}.${label}` : label;
  const stepKey = parentWorkflowName ? `${parentWorkflowName}.${stepId || label}` : stepId || label;

  const step = steps[stepKey];

  const { isForEachNode, isMapNode, isNestedWorkflow, hasSpecialBadge } = getNodeBadgeInfo({
    isForEach,
    mapConfig,
    canSuspend,
    isParallel,
    stepGraph,
  });

  return (
    <>
      {!withoutTopHandle && <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />}
      <div
        data-testid="workflow-nested-node"
        data-workflow-node
        data-workflow-step-status={step?.status}
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
            {isNestedWorkflow && (
              <Badge icon={<BADGE_ICONS.workflow className="text-current" style={{ color: BADGE_COLORS.workflow }} />}>
                WORKFLOW
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

        <WorkflowStepActionBar
          stepName={label}
          stepId={stepId}
          input={step?.input}
          resumeData={step?.resumeData}
          output={step?.output}
          error={step?.error}
          mapConfig={mapConfig}
          onShowNestedGraph={() => showNestedGraph({ label, fullStep: fullLabel, stepGraph })}
          status={step?.status}
        />
      </div>
      {!withoutBottomHandle && <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />}
    </>
  );
}
