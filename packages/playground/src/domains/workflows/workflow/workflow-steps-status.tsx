import {
  CheckIcon,
  CrossIcon,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Icon,
  Txt,
} from '@mastra/playground-ui';
import { CirclePause, HourglassIcon, Loader2, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import type { WorkflowRunStreamResult } from '../context/workflow-run-context';
import { StepDetail } from './workflow-status';
import type { TripwireInfo } from './workflow-status';

interface StepResult {
  status: string;
  output?: unknown;
  suspendOutput?: unknown;
  error?: unknown;
  tripwire?: {
    reason?: string;
    retry?: boolean;
    metadata?: unknown;
    processorId?: string;
  };
  suspendPayload?: unknown;
}

export interface WorkflowStepsStatusProps {
  steps: Record<string, StepResult>;
  workflowResult?: WorkflowRunStreamResult | null;
}

interface SelectedStep {
  stepId: string;
  status: string;
  result: Record<string, unknown>;
  tripwire?: TripwireInfo;
}

const StepStatusIcon = ({ status }: { status: string }) => (
  <Icon>
    {status === 'success' && <CheckIcon className="text-accent1" />}
    {status === 'failed' && <CrossIcon className="text-accent2" />}
    {status === 'tripwire' && <ShieldAlert className="text-amber-400" />}
    {status === 'suspended' && <CirclePause className="text-accent3" />}
    {status === 'waiting' && <HourglassIcon className="text-accent5" />}
    {status === 'running' && <Loader2 className="text-accent6 animate-spin" />}
  </Icon>
);

export function WorkflowStepsStatus({ steps, workflowResult }: WorkflowStepsStatusProps) {
  const filteredSteps = Object.entries(steps).filter(([key, _]) => key !== 'input' && !key.endsWith('.input'));
  const [selectedStep, setSelectedStep] = useState<SelectedStep | null>(null);

  if (filteredSteps.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 pt-5 border-t border-border1">
      <Txt as="p" variant="ui-md" className="text-neutral3">
        Status
      </Txt>
      <div className="flex flex-col gap-2">
        {filteredSteps.map(([stepId, step]) => {
          const { status } = step;
          let output = undefined;
          let suspendOutput = undefined;
          let error = undefined;

          if (step.status === 'suspended') {
            suspendOutput = step.suspendOutput;
          }
          if (step.status === 'success') {
            output = step.output;
          }
          if (step.status === 'failed') {
            error = step.error;
          }

          // Build tripwire info from step or workflow-level result
          // TripwireData is aligned with core schema: { reason, retry?, metadata?, processorId? }
          const tripwireInfo =
            step.status === 'failed' && step.tripwire
              ? step.tripwire
              : workflowResult?.status === 'tripwire'
                ? {
                    reason: workflowResult?.tripwire?.reason,
                    retry: workflowResult?.tripwire?.retry,
                    metadata: workflowResult?.tripwire?.metadata,
                    processorId: workflowResult?.tripwire?.processorId,
                  }
                : undefined;

          // Show tripwire status for failed steps with tripwire info
          const displayStatus = step.status === 'failed' && step.tripwire ? 'tripwire' : status;
          const result = (output ?? suspendOutput ?? error ?? {}) as Record<string, unknown>;

          return (
            <button
              key={stepId}
              type="button"
              onClick={() => setSelectedStep({ stepId, status: displayStatus, result, tripwire: tripwireInfo })}
              className="flex items-center gap-3 rounded-lg border border-border1 bg-surface4 px-3 py-2 text-left transition-colors hover:bg-surface5"
            >
              <StepStatusIcon status={displayStatus} />
              <Txt as="span" variant="ui-md" className="min-w-0 flex-1 truncate text-neutral6">
                {stepId.charAt(0).toUpperCase() + stepId.slice(1)}
              </Txt>
            </button>
          );
        })}
      </div>

      <Dialog open={Boolean(selectedStep)} onOpenChange={open => !open && setSelectedStep(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selectedStep ? selectedStep.stepId.charAt(0).toUpperCase() + selectedStep.stepId.slice(1) : ''}
            </DialogTitle>
            <DialogDescription>Step execution details</DialogDescription>
          </DialogHeader>
          <DialogBody className="max-h-[70vh]">
            {selectedStep && (
              <StepDetail status={selectedStep.status} result={selectedStep.result} tripwire={selectedStep.tripwire} />
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}
