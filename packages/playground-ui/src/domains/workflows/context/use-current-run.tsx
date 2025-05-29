import { useContext } from 'react';
import { WorkflowRunContext } from './workflow-run-context';

export type Step = {
  error?: any;
  startedAt: number;
  endedAt?: number;
  status: 'running' | 'success' | 'failed' | 'suspended';
  output?: any;
  input?: any;
};

type UseCurrentRunReturnType = {
  steps: Record<string, Step>;
  isRunning: boolean;
  runId?: string;
};

export const useCurrentRun = (): UseCurrentRunReturnType => {
  const context = useContext(WorkflowRunContext);

  const workflowCurrentSteps = context.result?.payload?.workflowState?.steps ?? {};
  const steps = Object.entries(workflowCurrentSteps).reduce((acc, [key, value]) => {
    return {
      ...acc,
      [key]: {
        error: value.error,
        startedAt: value.startedAt,
        endedAt: value.endedAt,
        status: value.status,
        output: value.output,
        input: value.payload,
      },
    };
  }, {});

  return { steps, isRunning: Boolean(context.payload), runId: context.result?.runId };
};
