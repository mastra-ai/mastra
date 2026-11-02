import type { ActivityOptions } from '@temporalio/workflow';

export type WorkflowRuntimeOptions = {
  startToCloseTimeout?: string;
  retry?: ActivityOptions['retry'];
  /** The workflow's `options.validateInputs`, read at build time. */
  validateInputs?: boolean;
};

export interface WorkflowExecutionResult {
  status: 'success';
  input: unknown;
  result: unknown;
  state: unknown;
  steps: Record<string, unknown>;
  /** Present when the run started with `recordStepMeta` on a Worker that records it. */
  stepMeta?: Record<string, { startedAt: number; endedAt: number }>;
}

/** The first detail of a failed step's ApplicationFailure, set by MastraPlugin's Activities. */
export interface StepFailureDetails {
  /** The step's error as serialized by Mastra, with its own fields. */
  error: { name?: string; message: string } & Record<string, unknown>;
  tripwire?: { reason: string; retry?: boolean; metadata?: Record<string, unknown>; processorId?: string };
}

/** The first detail of the ApplicationFailure a failed run ends with. */
export interface WorkflowFailureDetails extends StepFailureDetails {
  /** Outputs of the steps that finished, as in a successful result. */
  steps: Record<string, unknown>;
  stepMeta?: WorkflowExecutionResult['stepMeta'];
  /** Times are present when the run records `stepMeta`. */
  failedSteps: Record<string, StepFailureDetails & { startedAt?: number; endedAt?: number }>;
}

export type StepEntry = {
  type: 'step';
  step: { id: string };
};

export type ChildWorkflowEntry = {
  type: 'childWorkflow';
  workflowType: string;
  /** The child's Mastra workflow id, its key in `steps`. Parallel output is keyed by `workflowType`. */
  id: string;
};

export type ParallelEntry = StepEntry | ChildWorkflowEntry;

export type WorkflowRuntime = ((startArgs?: {
  runId?: string;
  resourceId?: string;
  inputData?: unknown;
  initialState?: unknown;
  recordStepMeta?: boolean;
  validateInputs?: boolean;
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
    validateInputs?: boolean;
    graph: { id: string; steps: unknown[] };
    input?: unknown;
    initialState?: unknown;
    recordStepMeta?: boolean;
  }): Promise<WorkflowExecutionResult>;
}

export function createWorkflow(workflowId: string, options?: WorkflowRuntimeOptions): WorkflowRuntime;
