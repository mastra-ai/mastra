import type { GetWorkflowResponse, GetWorkflowRunByIdResponse } from '@mastra/client-js';
import { stringify } from 'superjson';
import { twoStepWorkflow } from './workflow-debug-step-controls';
import { suspendedRunState } from './workflow-run-states';

export const inspectionWorkflow: GetWorkflowResponse = {
  ...twoStepWorkflow,
  allSteps: {
    ...twoStepWorkflow.allSteps,
    transform: {
      ...twoStepWorkflow.allSteps.transform,
      resumeSchema: stringify({ type: 'object', properties: { note: { type: 'string' } }, required: ['note'] }),
    },
  },
};

export function suspendedRunWithOutput(output: unknown): GetWorkflowRunByIdResponse {
  return {
    ...suspendedRunState,
    steps: {
      ...suspendedRunState.steps,
      extract: { ...suspendedRunState.steps.extract, output },
    },
  };
}
