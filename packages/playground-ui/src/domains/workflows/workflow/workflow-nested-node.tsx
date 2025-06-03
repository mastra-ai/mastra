import { Handle, Position } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import { CircleDashed, Loader2, PauseIcon, Workflow } from 'lucide-react';
import { StepFlowEntry } from '@mastra/core/workflows';

import { Text } from '@/components/ui/text';

import { cn } from '@/lib/utils';
import { useContext, useState } from 'react';
import { WorkflowNestedGraphContext } from '../context/workflow-nested-graph-context';
import { useCurrentRun } from '../context/use-current-run';
import { CheckIcon, CrossIcon, Icon } from '@/ds/icons';
import { Txt } from '@/ds/components/Txt';
import { Clock } from './workflow-clock';
import { Button } from '@/ds/components/Button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { CodeDialogContent } from './workflow-code-dialog-content';

export type NestedNode = Node<
  {
    label: string;
    description?: string;
    withoutTopHandle?: boolean;
    withoutBottomHandle?: boolean;
    stepGraph: StepFlowEntry[];
    mapConfig?: string;
  },
  'nested-node'
>;

export function WorkflowNestedNode({
  data,
  parentWorkflowName,
}: NodeProps<NestedNode> & { parentWorkflowName?: string }) {
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [isOutputOpen, setIsOutputOpen] = useState(false);
  const [isErrorOpen, setIsErrorOpen] = useState(false);
  const [isMapConfigOpen, setIsMapConfigOpen] = useState(false);

  const { steps, isRunning } = useCurrentRun();
  const { showNestedGraph } = useContext(WorkflowNestedGraphContext);

  const { label, description, withoutTopHandle, withoutBottomHandle, stepGraph, mapConfig } = data;

  const fullLabel = parentWorkflowName ? `${parentWorkflowName}.${label}` : label;

  const step = steps[fullLabel];

  const dialogContentClass = 'bg-surface2 rounded-lg border-sm border-border1 max-w-4xl w-full px-0';
  const dialogTitleClass = 'border-b-sm border-border1 pb-4 px-6';

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

        <div className="flex flex-wrap items-center bg-surface4 border-t-sm border-border1 px-2 py-1 gap-2 rounded-b-lg">
          <Button onClick={() => showNestedGraph({ label, fullStep: fullLabel, stepGraph })}>View workflow</Button>
          {mapConfig && (
            <>
              <Button onClick={() => setIsMapConfigOpen(true)}>Map config</Button>

              <Dialog open={isMapConfigOpen} onOpenChange={setIsMapConfigOpen}>
                <DialogContent className={dialogContentClass}>
                  <DialogTitle className={dialogTitleClass}>{label} map config</DialogTitle>

                  <div className="px-4 overflow-hidden">
                    <CodeDialogContent data={mapConfig} />
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
          {step?.input && (
            <>
              <Button onClick={() => setIsInputOpen(true)}>Input</Button>

              <Dialog open={isInputOpen} onOpenChange={setIsInputOpen}>
                <DialogContent className={dialogContentClass}>
                  <DialogTitle className={dialogTitleClass}>{label} input</DialogTitle>

                  <div className="px-4 overflow-hidden">
                    <CodeDialogContent data={step.input} />
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}

          {step?.output && (
            <>
              <Button onClick={() => setIsOutputOpen(true)}>Output</Button>

              <Dialog open={isOutputOpen} onOpenChange={setIsOutputOpen}>
                <DialogContent className={dialogContentClass}>
                  <DialogTitle className={dialogTitleClass}>{label} output</DialogTitle>
                  <div className="px-4 overflow-hidden">
                    <CodeDialogContent data={step.output} />
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}

          {step?.error && (
            <>
              <Button onClick={() => setIsErrorOpen(true)}>Error</Button>

              <Dialog open={isErrorOpen} onOpenChange={setIsErrorOpen}>
                <DialogContent className={dialogContentClass}>
                  <DialogTitle className={dialogTitleClass}>{label} error</DialogTitle>

                  <div className="px-4 overflow-hidden">
                    <CodeDialogContent data={step?.error} />
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>
      {!withoutBottomHandle && <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />}
    </>
  );
}
