import type { GetWorkflowResponse } from '@mastra/client-js';
import type { WorkflowRunState, WorkflowStreamResult } from '@mastra/core/workflows';
import { createContext } from 'react';

export interface WorkflowRunContextType {
  workflow?: GetWorkflowResponse;
  result?: WorkflowStreamResult<any, any, any, any> | null;
  payload?: unknown;
  snapshot?: WorkflowRunState;
  runSnapshot?: WorkflowRunState;
  runId?: string;
  waitingStepKey?: string;
}

export const WorkflowRunContext = createContext<WorkflowRunContextType>({});
