import { useContext, useMemo } from 'react';
import type { WorkflowRunStreamStep } from './workflow-run-context';
import { WorkflowRunContext } from './workflow-run-context';

export type TripwireData = {
  reason: string;
  retry?: boolean;
  metadata?: unknown;
  processorId?: string;
};

export type Step = Pick<
  WorkflowRunStreamStep,
  | 'status'
  | 'error'
  | 'tripwire'
  | 'startedAt'
  | 'endedAt'
  | 'output'
  | 'suspendOutput'
  | 'suspendPayload'
  | 'foreachProgress'
> & {
  input?: WorkflowRunStreamStep['payload'];
  resumeData?: WorkflowRunStreamStep['resumePayload'];
};

type UseCurrentRunReturnType = {
  steps: Record<string, Step>;
  runId?: string;
};

const toRunStep = (step: WorkflowRunStreamStep): Step => ({
  status: step.status,
  error: step.tripwire ? undefined : step.error,
  tripwire: step.tripwire,
  startedAt: step.startedAt,
  endedAt: step.endedAt,
  output: step.output,
  input: step.payload,
  resumeData: step.resumePayload,
  suspendOutput: step.suspendOutput,
  suspendPayload: step.suspendPayload,
  foreachProgress: step.foreachProgress,
});

export const useCurrentRun = (): UseCurrentRunReturnType => {
  const context = useContext(WorkflowRunContext);
  const workflowCurrentSteps = context.result?.steps;
  const steps = useMemo(
    () => Object.fromEntries(Object.entries(workflowCurrentSteps ?? {}).map(([key, value]) => [key, toRunStep(value)])),
    [workflowCurrentSteps],
  );

  return { steps, runId: context.runId };
};
