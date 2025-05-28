import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { CircleDashed, Loader2, PauseIcon } from 'lucide-react';
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
  },
  'default-node'
>;

export interface WorkflowDefaultNodeProps {
  data: DefaultNode['data'];
  onShowTrace?: ({ runId, stepName }: { runId: string; stepName: string }) => void;
  parentWorkflowName?: string;
}

export function WorkflowDefaultNode({
  data,
  onShowTrace,
  parentWorkflowName,
}: NodeProps<DefaultNode> & WorkflowDefaultNodeProps) {
  const { steps, isRunning, runId } = useCurrentRun();
  const { label, description, withoutTopHandle, withoutBottomHandle } = data;

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
        )}
      >
        <div className={cn('flex items-center gap-2 px-3', !description && 'pb-2')}>
          {isRunning && (
            <Icon>
              {step?.status === 'failed' && <CrossIcon className="text-accent2" />}
              {step?.status === 'success' && <CheckIcon className="text-accent1" />}
              {step?.status === 'suspended' && <PauseIcon className="text-icon3" />}
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

        <WorkflowStepActionBar
          stepName={label}
          input={step?.input}
          output={step?.output}
          error={step?.error}
          mapConfig={data.mapConfig}
          onShowTrace={runId ? () => onShowTrace?.({ runId, stepName: fullLabel }) : undefined}
        />
      </div>

      {!withoutBottomHandle && (
        <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden', color: 'red' }} />
      )}
    </>
  );
}
