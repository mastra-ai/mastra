import { useState } from 'react';
import { useVNextNetworkChat } from '@/services/vnext-network-chat-provider';
import { Button } from '@/ds/components/Button';
import Spinner from '@/components/ui/spinner';
import { CheckIcon, CrossIcon, Icon } from '@/ds/icons';
import { Txt } from '@/ds/components/Txt';
import { Clock } from '@/domains/workflows/workflow/workflow-clock';
import { Badge } from '@/ds/components/Badge';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { WorkflowGraph } from '@/domains/workflows/workflow/workflow-graph';
import { Dialog, DialogContent, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { WorkflowRunProvider } from '@/domains/workflows/context/workflow-run-context';
import { useWorkflowRuns } from '@/hooks/use-workflow-runs';
import { useWorkflow } from '@/hooks/use-workflows';
import { useMessage } from '@assistant-ui/react';

const LabelMappings = {
  'routing-step': 'Decision making process',
  'agent-step': 'Agent execution',
  'workflow-step': 'Workflow execution',
  'final-step': 'Task completed',
};

export const StepDropdown = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { state } = useVNextNetworkChat();
  const message = useMessage();

  const id = message?.metadata?.custom?.id as string | undefined;

  if (!id) return <div>Something is wrong</div>;
  const currentState = state[id];

  const latestStepId = currentState.executionSteps[currentState.executionSteps.length - 1];
  const hasFinished = latestStepId === 'finish';

  return (
    <div className="space-y-2">
      <Button onClick={() => setIsExpanded(!isExpanded)}>
        {hasFinished ? (
          <>
            <Icon>
              <CheckIcon className="text-accent1" />
            </Icon>
            Done
          </>
        ) : (
          <>
            <Icon>
              <Spinner className="animate-spin" />
            </Icon>
            Thinking...
          </>
        )}

        <Icon className="ml-2">
          <ChevronDown className={clsx('transition-transform -rotate-90', isExpanded && 'rotate-0')} />
        </Icon>
      </Button>

      {isExpanded ? <Steps id={id} /> : null}
    </div>
  );
};

const Steps = ({ id }: { id: string }) => {
  const { state } = useVNextNetworkChat();
  const currentState = state[id];

  return (
    <ol className="flex flex-col gap-px rounded-lg overflow-hidden">
      {currentState.executionSteps
        .filter(stepId => stepId !== 'start')
        .map((stepId: any, index: number) => (
          <StepEntry key={index} stepId={stepId} step={currentState.steps[stepId] || {}} runId={currentState.runId} />
        ))}
    </ol>
  );
};

const StepEntry = ({ stepId, step, runId }: { stepId: any; step: any; runId?: string }) => {
  const [expanded, setExpanded] = useState(false);
  const stepResult = step['step-result'];

  if (stepId === 'finish') {
    return (
      <div className="bg-surface4 py-2 px-3 text-icon6 flex items-center gap-4 justify-between">
        <Txt variant="ui-sm" className="text-icon6">
          Process completed
        </Txt>
      </div>
    );
  }

  return (
    <li>
      <button
        className="bg-surface4 py-2 px-3 text-icon6 flex items-center gap-4 justify-between w-full text-left"
        onClick={() => setExpanded(s => !s)}
      >
        <div className="flex items-center gap-2">
          <StatusIcon status={stepResult ? stepResult?.status : 'loading'} />
          <Txt variant="ui-sm" className="text-icon6">
            {LabelMappings[stepId as keyof typeof LabelMappings] || stepId}
          </Txt>
        </div>

        {step.metadata?.startTime && <StepClock step={step} />}
      </button>

      {stepId === 'routing-step' && expanded && (
        <div className="bg-surface1 p-3 space-y-4">
          <div>
            <Txt variant="ui-sm" className="text-icon3 font-medium">
              Selection reason:
            </Txt>

            <Txt variant="ui-sm" className="text-icon6">
              {stepResult?.output?.selectionReason || 'N/A'}
            </Txt>
          </div>

          <div>
            <Txt variant="ui-sm" className="text-icon3 font-medium">
              Resource ID
            </Txt>

            <Txt variant="ui-sm" className="text-icon6">
              {stepResult?.output?.resourceId || 'N/A'}
            </Txt>
          </div>
        </div>
      )}

      {stepId === 'final-step' && expanded && (
        <div className="bg-surface1 p-3 space-y-4">
          <div>
            <Txt variant="ui-sm" className="text-icon3 font-medium">
              Task:
            </Txt>

            <Txt variant="ui-sm" className="text-icon6">
              {stepResult?.output?.task || 'N/A'}
            </Txt>
          </div>

          <div>
            <Txt variant="ui-sm" className="text-icon3 font-medium">
              Number of iterations:
            </Txt>

            <Txt variant="ui-sm" className="text-icon6">
              {stepResult?.output?.iteration || 'N/A'}
            </Txt>
          </div>
        </div>
      )}

      {stepId === 'workflow-step' && stepResult?.output?.resourceId ? (
        <WorkflowStepResultDialog
          open={expanded}
          onOpenChange={setExpanded}
          workflowId={stepResult?.output?.resourceId}
          runId={runId}
        />
      ) : null}
    </li>
  );
};

interface WorkflowStepResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: string;
  runId?: string;
}

const WorkflowStepResultDialog = ({ open, onOpenChange, workflowId, runId }: WorkflowStepResultDialogProps) => {
  const { runs } = useWorkflowRuns(workflowId);
  const { workflow, isLoading } = useWorkflow(workflowId);
  const run = runs?.runs.find((run: any) => run.runId === runId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogContent className="h-[90vh] w-[90%] max-w-[unset]">
          <div className="flex-1 h-full">
            <DialogTitle>Workflow details</DialogTitle>
            <WorkflowRunProvider snapshot={typeof run?.snapshot === 'object' ? run.snapshot : undefined}>
              <WorkflowGraph workflowId={workflowId} workflow={workflow!} isLoading={isLoading} />
            </WorkflowRunProvider>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
};

const StatusIcon = ({ status }: { status: 'error' | 'success' | 'loading' }) => {
  if (status === 'error') {
    return (
      <Icon>
        <CrossIcon className="text-accent2" />
      </Icon>
    );
  }

  if (status === 'success') {
    return (
      <Icon>
        <CheckIcon className="text-accent1" />
      </Icon>
    );
  }

  return (
    <Icon>
      <Spinner className="animate-spin" />
    </Icon>
  );
};

const StepClock = ({ step }: { step: any }) => {
  return (
    <Badge>
      <Clock startedAt={step.metadata.startTime} endedAt={step.metadata?.endTime} />
    </Badge>
  );
};
