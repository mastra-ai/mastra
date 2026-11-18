import type { ActivityOptions } from '@temporalio/workflow';

export type WorkflowRuntimeOptions = {
  startToCloseTimeout?: string;
  retry?: ActivityOptions['retry'];
};

export type StepExecutionResult = {
  status: 'success';
  payload: unknown;
  output: unknown;
  startedAt: number;
  endedAt: number;
  suspendPayload?: unknown;
  resumeData?: unknown;
};

export interface WorkflowExecutionResult {
  status: 'success' | 'running' | 'suspended';
  input: unknown;
  result?: unknown;
  state: unknown;
  steps: Record<string, StepExecutionResult | unknown>;
  suspended?: string[][];
  suspendPayload?: Record<string, unknown>;
}

/** The first detail of a failed step's ApplicationFailure, set by MastraPlugin's Activities. */
export interface StepFailureDetails {
  /** The step's error as serialized by Mastra, with its own fields. */
  error: { name?: string; message: string } & Record<string, unknown>;
  tripwire?: { reason: string; retry?: boolean; metadata?: Record<string, unknown>; processorId?: string };
}

export type StepFailureResult = StepFailureDetails & {
  status: 'failed';
  payload: unknown;
  startedAt: number;
  endedAt: number;
};

/** The first detail of the ApplicationFailure a failed run ends with. */
export interface WorkflowFailureDetails extends StepFailureDetails {
  /** Records of the steps that ran, the failed ones included. */
  steps: Record<string, StepExecutionResult | StepFailureResult | unknown>;
}

export type StepEntry = {
  type: 'step';
  step: { id: string };
};

export type ChildWorkflowEntry = {
  type: 'childWorkflow';
  workflowType: string;
};

export type ParallelEntry = StepEntry | ChildWorkflowEntry;

export type WorkflowRuntime = ((startArgs?: {
  runId?: string;
  resourceId?: string;
  requestContext?: unknown;
  validateInputs?: boolean;
  inputData?: unknown;
  initialState?: unknown;
}) => Promise<WorkflowExecutionResult>) & {
  then(stepId: string): WorkflowRuntime;
  thenWorkflow(workflowType: string, id: string): WorkflowRuntime;
  map(mappingId: string, options?: unknown): WorkflowRuntime;
  sleep(durationOrFnId: number | string): WorkflowRuntime;
  sleepUntil(dateOrFnId: Date | number | string): WorkflowRuntime;
  parallel(entries: ParallelEntry[]): WorkflowRuntime;
  branch(pairs: [string, string][]): WorkflowRuntime;
  dowhile(stepId: string, condId: string): WorkflowRuntime;
  dountil(stepId: string, condId: string): WorkflowRuntime;
  foreach(
    stepId: string,
    opts?: { concurrency?: number | ((ctx: { inputData: unknown; getInitData: () => unknown }) => number) },
  ): WorkflowRuntime;
  commit(): WorkflowRuntime;
};

export class TemporalExecutionEngine {
  constructor(params?: { options?: WorkflowRuntimeOptions });
  execute(params: {
    workflowId: string;
    runId?: string;
    resourceId?: string;
    requestContext?: unknown;
    validateInputs?: boolean;
    graph: { id: string; steps: unknown[] };
    input?: unknown;
    initialState?: unknown;
  }): Promise<WorkflowExecutionResult>;
}

export function createWorkflow(workflowId: string, options?: WorkflowRuntimeOptions): WorkflowRuntime;
