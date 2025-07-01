import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { CircleDashed, HourglassIcon, Loader2, PauseIcon } from 'lucide-react';
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
    event?: string;
    duration?: number;
    date?: Date;
  },
  'default-node'
>;

export interface WorkflowDefaultNodeProps {
  onShowTrace?: ({ runId, stepName }: { runId: string; stepName: string }) => void;
  parentWorkflowName?: string;
}

export function WorkflowDefaultNode({
  data,
  onShowTrace,
  parentWorkflowName,
}: NodeProps<DefaultNode> & WorkflowDefaultNodeProps) {
  const { steps, isRunning, runId } = useCurrentRun();
  const { label, description, withoutTopHandle, withoutBottomHandle, mapConfig, event, duration, date } = data;

  const fullLabel = parentWorkflowName ? `${parentWorkflowName}.${label}` : label;

  const step = steps[fullLabel];

  return (
    <>
      {!withoutTopHandle && <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />}

      <div
        className={cn(
          'bg-surface3 rounded-lg w-[274px] border-sm border-border1 pt-2',
          step?.status === 'success' && 'ring-2 ring-accent1',
          step?.status === 'failed' && 'ring-2 ring-accent2',
          step?.status === 'suspended' && 'ring-2 ring-accent3',
          step?.status === 'waiting' && 'ring-2 ring-accent5',
        )}
      >
        <div className={cn('flex items-center gap-2 px-3', !description && 'pb-2')}>
          {isRunning && (
            <Icon>
              {step?.status === 'failed' && <CrossIcon className="text-accent2" />}
              {step?.status === 'success' && <CheckIcon className="text-accent1" />}
              {step?.status === 'suspended' && <PauseIcon className="text-accent3" />}
              {step?.status === 'waiting' && <HourglassIcon className="text-accent5" />}
              {step?.status === 'running' && <Loader2 className="text-icon6 animate-spin" />}
              {!step && <CircleDashed className="text-icon2" />}
            </Icon>
          )}
          <Txt variant="ui-lg" className="text-icon6 font-medium inline-flex items-center gap-1 justify-between w-full">
            {label} {step?.startedAt && <Clock startedAt={step.startedAt} endedAt={step.endedAt} />}
          </Txt>
        </div>

        {description && (
          <Txt variant="ui-sm" className="text-icon3 px-3 pb-2">
            {description}
          </Txt>
        )}

        {event && (
          <Txt variant="ui-sm" className="text-icon3 px-3 pb-2">
            waits for event: <strong>{event}</strong>
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
          onShowTrace={runId && onShowTrace ? () => onShowTrace?.({ runId, stepName: fullLabel }) : undefined}
        />
      </div>

      {!withoutBottomHandle && (
        <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden', color: 'red' }} />
      )}
    </>
  );
}
