import { useContext } from 'react';
import { WorkflowRunContext } from './workflow-run-context';

export type Step = {
  error?: any;
  startedAt: number;
  endedAt?: number;
  status: 'running' | 'success' | 'failed' | 'suspended' | 'waiting';
  output?: any;
  input?: any;
  resumeData?: any;
};

type UseCurrentRunReturnType = {
  steps: Record<string, Step>;
  runId?: string;
};

export const useCurrentRun = (): UseCurrentRunReturnType => {
  const context = useContext(WorkflowRunContext);

  const workflowCurrentSteps = context.result?.steps ?? {};
  const steps = Object.entries(workflowCurrentSteps).reduce((acc, [key, value]: [string, any]) => {
    return {
      ...acc,
      [key]: {
        error: 'error' in value ? value.error : undefined,
        startedAt: value.startedAt,
        endedAt: 'endedAt' in value ? value.endedAt : undefined,
        status: value.status,
        output: 'output' in value ? value.output : undefined,
        input: value.payload,
        resumeData: 'resumePayload' in value ? value.resumePayload : undefined,
      },
    };
  }, {});

  return { steps, runId: context.runId };
};
