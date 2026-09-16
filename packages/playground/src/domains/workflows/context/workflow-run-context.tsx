import type { GetWorkflowRunByIdResponse, StreamVNextChunkType, TimeTravelParams } from '@mastra/client-js';
import type {
  StepTripwireInfo,
  WorkflowRunState,
  WorkflowState,
  WorkflowStateSingleStepResult,
} from '@mastra/core/workflows';
import type { WorkflowStreamResult } from '@mastra/react';
import { createContext } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { WorkflowTriggerProps } from '../workflow/workflow-trigger';

type StepProgress = Extract<StreamVNextChunkType, { type: 'workflow-step-progress' }>['payload'];

type WorkflowRunStreamStep = Omit<WorkflowStateSingleStepResult, 'error'> & {
  error?: WorkflowStateSingleStepResult['error'] | Error;
  tripwire?: StepTripwireInfo;
  foreachProgress?: Pick<
    StepProgress,
    'completedCount' | 'totalCount' | 'currentIndex' | 'iterationStatus' | 'iterationOutput'
  >;
};

export type WorkflowRunStreamResult = {
  status: WorkflowState['status'];
  input: WorkflowStreamResult['input'];
  steps: Record<string, WorkflowRunStreamStep>;
  result?: Extract<WorkflowStreamResult, { status: 'success' }>['result'];
  error?: WorkflowState['error'] | Error;
  state?: Extract<WorkflowStreamResult, { status: 'success' }>['state'];
  stepExecutionPath?: WorkflowState['stepExecutionPath'];
  resumeLabels?: WorkflowState['resumeLabels'];
  tripwire?: StepTripwireInfo;
  suspended?: string[][];
  suspendPayload?: Extract<WorkflowStreamResult, { status: 'suspended' }>['suspendPayload'];
};

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
