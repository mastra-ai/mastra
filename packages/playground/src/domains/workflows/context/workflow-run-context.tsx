import type { GetWorkflowRunByIdResponse, TimeTravelParams } from '@mastra/client-js';
import type { WorkflowRunState } from '@mastra/core/workflows';
import type { WorkflowStreamResult } from '@mastra/react';
import { createContext } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { WorkflowTriggerProps } from '../workflow/workflow-trigger';

export type WorkflowRunStreamResult = WorkflowStreamResult;

export type WorkflowRunContextType = {
  result: WorkflowRunStreamResult | null;
  setResult: Dispatch<SetStateAction<WorkflowRunStreamResult | null>>;
  payload: any;
  setPayload: Dispatch<SetStateAction<any>>;
  clearData: () => void;
  snapshot?: WorkflowRunState;
  runId?: string;
  setRunId: Dispatch<SetStateAction<string>>;
  workflowError: Error | null;
  observeWorkflowStream?: ({
    workflowId,
    runId,
    storeRunResult,
  }: {
    workflowId: string;
    runId: string;
    storeRunResult: WorkflowRunStreamResult | null;
  }) => void;
  closeStreamsAndReset: () => void;
  timeTravelWorkflowStream: (
    params: {
      workflowId: string;
      requestContext: Record<string, unknown>;
      runId?: string;
    } & Omit<TimeTravelParams, 'requestContext'>,
  ) => Promise<void>;
  runSnapshot?: WorkflowRunState | (GetWorkflowRunByIdResponse & { timestamp?: number });
  isLoadingRunExecutionResult?: boolean;
  withoutTimeTravel?: boolean;
  debugMode: boolean;
  setDebugMode: Dispatch<SetStateAction<boolean>>;
} & Omit<WorkflowTriggerProps, 'paramsRunId' | 'observeWorkflowStream'>;

export const WorkflowRunContext = createContext<WorkflowRunContextType>({} as WorkflowRunContextType);
