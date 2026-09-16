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

export type WorkflowRunSnapshot = WorkflowRunState | (GetWorkflowRunByIdResponse & { timestamp?: number });

export type ObserveWorkflowRunParams = {
  workflowId: string;
  runId: string;
  storedStatus?: WorkflowRunStreamResult['status'];
};

export type TimeTravelWorkflowRunParams = {
  workflowId: string;
  runId: string;
  requestContext: Record<string, unknown>;
} & Omit<TimeTravelParams, 'requestContext'>;

export type WorkflowRunContextType = {
  result: WorkflowRunStreamResult | null;
  setResult: (result: WorkflowRunStreamResult | null) => void;
  streamResult: WorkflowRunStreamResult | null;
  payload: any;
  setPayload: Dispatch<SetStateAction<any>>;
  clearData: () => void;
  snapshot?: WorkflowRunState;
  runId: string;
  setRunId: (runId: string) => void;
  workflowError: Error | null;
  observeWorkflowStream: (params: ObserveWorkflowRunParams) => void;
  closeStreamsAndReset: () => void;
  timeTravelWorkflowStream: (params: TimeTravelWorkflowRunParams) => Promise<void>;
  runSnapshot?: WorkflowRunSnapshot;
  isLoadingRunExecutionResult?: boolean;
  withoutTimeTravel?: boolean;
  debugMode: boolean;
  setDebugMode: Dispatch<SetStateAction<boolean>>;
} & Omit<WorkflowTriggerProps, 'paramsRunId' | 'setRunId' | 'observeWorkflowStream'>;

export const WorkflowRunContext = createContext<WorkflowRunContextType>({} as WorkflowRunContextType);
