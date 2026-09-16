import type {
  GetWorkflowResponse,
  GetWorkflowRunByIdResponse,
  StreamVNextChunkType,
  TimeTravelParams,
} from '@mastra/client-js';
import type {
  StepTripwireInfo,
  WorkflowRunState,
  WorkflowState,
  WorkflowStateSingleStepResult,
} from '@mastra/core/workflows';
import type { WorkflowStreamResult } from '@mastra/react';
import { createContext } from 'react';
import type { Dispatch, SetStateAction } from 'react';

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

export type StreamWorkflowRunParams = {
  workflowId: string;
  runId: string;
  inputData: Record<string, unknown>;
  initialState?: Record<string, unknown>;
  requestContext: Record<string, unknown>;
  perStep?: boolean;
};

export type ResumeWorkflowRunParams = {
  workflowId: string;
  runId: string;
  step: string | string[];
  resumeData: Record<string, unknown>;
  requestContext: Record<string, unknown>;
  perStep?: boolean;
};

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
  workflowId: string;
  workflow?: GetWorkflowResponse;
  workflowError: Error | null;
  isLoading?: boolean;
  runId: string;
  setRunId: (runId: string) => void;
  result: WorkflowRunStreamResult | null;
  setResult: (result: WorkflowRunStreamResult | null) => void;
  streamResult: WorkflowRunStreamResult | null;
  payload: any;
  setPayload: (payload: unknown) => void;
  clearData: () => void;
  snapshot?: WorkflowRunState;
  runSnapshot?: WorkflowRunSnapshot;
  isLoadingRunExecutionResult?: boolean;
  isStreamingWorkflow: boolean;
  isCancellingWorkflowRun: boolean;
  createWorkflowRun: (params: { workflowId: string; prevRunId?: string }) => Promise<{ runId: string }>;
  streamWorkflow: (params: StreamWorkflowRunParams) => Promise<void>;
  resumeWorkflow: (params: ResumeWorkflowRunParams) => Promise<void>;
  observeWorkflowStream: (params: ObserveWorkflowRunParams) => void;
  timeTravelWorkflowStream: (params: TimeTravelWorkflowRunParams) => Promise<void>;
  cancelWorkflowRun: (params: { workflowId: string; runId: string }) => Promise<{ message: string }>;
  closeStreamsAndReset: () => void;
  withoutTimeTravel?: boolean;
  debugMode: boolean;
  setDebugMode: Dispatch<SetStateAction<boolean>>;
};

export const WorkflowRunContext = createContext<WorkflowRunContextType>({} as WorkflowRunContextType);
