import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { CircleDashed, HourglassIcon, Loader2, PauseIcon, Timer, CalendarClock, List } from 'lucide-react';
import { useCurrentRun } from '../context/use-current-run';
import { CheckIcon, CrossIcon, Icon } from '@/ds/icons';
import { Txt } from '@/ds/components/Txt';

import { Clock } from './workflow-clock';

import { cn } from '@/lib/utils';
import { WorkflowStepActionBar } from './workflow-step-action-bar';

export type DefaultNode = Node<
  {
    label: string;
    description?: string;
    withoutTopHandle?: boolean;
    withoutBottomHandle?: boolean;
    mapConfig?: string;
    duration?: number;
    date?: Date;
  },
  'default-node'
>;

export interface WorkflowDefaultNodeProps {
  parentWorkflowName?: string;
}

export function WorkflowDefaultNode({ data, parentWorkflowName }: NodeProps<DefaultNode> & WorkflowDefaultNodeProps) {
  const { steps, runId } = useCurrentRun();
  const { label, description, withoutTopHandle, withoutBottomHandle, mapConfig, duration, date } = data;

  const fullLabel = parentWorkflowName ? `${parentWorkflowName}.${label}` : label;

  const step = steps[fullLabel];

  const isSleepNode = Boolean(duration || date);
  const sleepIconColor = '#A855F7'; // Purple color for sleep nodes
  const isForEachNode = Boolean(mapConfig);
  const forEachIconColor = '#F97316'; // Orange color for forEach nodes

  return (
    <>
      {!withoutTopHandle && <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />}

      <div
        data-workflow-node
        data-workflow-step-status={step?.status ?? 'idle'}
        data-testid="workflow-default-node"
        className={cn(
          'bg-surface3 rounded-lg w-[274px] border-sm border-border1 pt-2',
          step?.status === 'success' && 'bg-accent1Darker',
          step?.status === 'failed' && 'bg-accent2Darker',
          step?.status === 'suspended' && 'bg-accent3Darker',
          step?.status === 'waiting' && 'bg-accent5Darker',
          step?.status === 'running' && 'bg-accent6Darker',
        )}
      >
        <div className={cn('flex items-center gap-2 px-3', !description && 'pb-2')}>
          <Icon>
            {step?.status === 'failed' && <CrossIcon className="text-accent2" />}
            {step?.status === 'success' && <CheckIcon className="text-accent1" />}
            {step?.status === 'suspended' && <PauseIcon className="text-accent3" />}
            {step?.status === 'waiting' && <HourglassIcon className="text-accent5" />}
            {step?.status === 'running' && <Loader2 className="text-accent6 animate-spin" />}
            {!step &&
              isSleepNode &&
              (date ? (
                <CalendarClock className="text-icon2" style={{ color: sleepIconColor }} />
              ) : (
                <Timer className="text-icon2" style={{ color: sleepIconColor }} />
              ))}
            {!step && !isSleepNode && isForEachNode && (
              <List className="text-icon2" style={{ color: forEachIconColor }} />
            )}
            {!step && !isSleepNode && !isForEachNode && <CircleDashed className="text-icon2" />}
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
