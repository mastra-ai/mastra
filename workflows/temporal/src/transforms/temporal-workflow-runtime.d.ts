export interface WorkflowExecutionResult {
  status: 'success';
  input: unknown;
  result: unknown;
  state: unknown;
  steps: Record<string, unknown>;
}

export type WorkflowRuntime = ((startArgs?: {
  runId?: string;
  resourceId?: string;
  inputData?: unknown;
  initialState?: unknown;
}) => Promise<WorkflowExecutionResult>) & {
  then(stepId: string): WorkflowRuntime;
  sleep(durationOrFnId: number | string): WorkflowRuntime;
  sleepUntil(dateOrFnId: Date | number | string): WorkflowRuntime;
  parallel(stepIds: string[]): WorkflowRuntime;
  branch(pairs: [string, string][]): WorkflowRuntime;
  dowhile(stepId: string, condId: string): WorkflowRuntime;
  dountil(stepId: string, condId: string): WorkflowRuntime;
  foreach(stepId: string, opts?: { concurrency?: number }): WorkflowRuntime;
  commit(): WorkflowRuntime;
};

export class TemporalExecutionEngine {
  constructor(params?: { options?: { startToCloseTimeout?: string } });
  execute(params: {
    workflowId: string;
    runId?: string;
    resourceId?: string;
    graph: { id: string; steps: unknown[] };
    input?: unknown;
    initialState?: unknown;
  }): Promise<WorkflowExecutionResult>;
}

export function createWorkflow(workflowId: string): WorkflowRuntime;
