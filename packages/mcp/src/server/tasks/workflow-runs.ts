import type { StepWithComponent, Workflow, WorkflowRunStatus } from '@mastra/core/workflows';

/**
 * What a workflow task records at creation, as `MCPTaskCreateParams.context`. The task follows the
 * run `runId`, which the server started exactly once when it created the task; nothing here can
 * start it again. A custom `tasks.store` that cancels or expires a task cancels its run with
 * `mastra.getWorkflow(workflowKey).createRun({ runId })` then `run.cancel()`.
 *
 * @experimental SEP-2663 extension; API may change.
 */
export interface WorkflowTaskContext extends Record<string, unknown> {
  toolName: string;
  kind: 'workflow';
  workflowKey: string;
  runId: string;
  /** The caller's request context, minus the bearer token. */
  requestContext: Record<string, unknown>;
}

/**
 * Whether a task's context is a workflow task's.
 *
 * @experimental SEP-2663 extension; API may change.
 */
export function isWorkflowTaskContext(context: Record<string, unknown> | undefined): context is WorkflowTaskContext {
  return context?.kind === 'workflow' && typeof context.runId === 'string' && typeof context.workflowKey === 'string';
}

/**
 * A run as both `run.start()`/`run.resume()` (a `WorkflowResult`) and `getWorkflowRunById` (a
 * `WorkflowState`) describe it, so a live run and a re-attached one answer the same.
 */
export interface WorkflowRunView {
  status: WorkflowRunStatus;
  input?: unknown;
  steps?: Record<string, unknown>;
  result?: unknown;
  error?: unknown;
}

/** Statuses a run never leaves. */
const FINAL_STATUSES: ReadonlySet<WorkflowRunStatus> = new Set(['success', 'failed', 'tripwire', 'canceled', 'bailed']);

export function isFinalRunStatus(status: WorkflowRunStatus): boolean {
  return FINAL_STATUSES.has(status);
}

/** The text a finished run answers with: the same fields the synchronous `run_` tool returns. */
export function runSummary(view: WorkflowRunView): Record<string, unknown> {
  return { status: view.status, input: view.input, steps: view.steps, result: view.result };
}

export function runErrorMessage(view: WorkflowRunView): string {
  const error = view.error as { message?: unknown } | string | undefined;
  if (typeof error === 'string') return error;
  if (error && typeof error.message === 'string') return error.message;
  return 'unknown error';
}

export interface SuspendedStep {
  /** The path `run.resume({ step })` takes: the step id, then nested steps inside nested workflows. */
  path: string[];
  step?: StepWithComponent;
  /** The payload the step suspended with, without the engine's bookkeeping. */
  payload: unknown;
  /** When the step suspended; tells this suspension from a later one of the same step. */
  suspendedAt?: number;
}

/**
 * The first step the run is suspended on. A run with several (parallel branches) is resumed one at
 * a time: after each resume it suspends again on the next.
 */
export function firstSuspendedStep(workflow: Workflow, view: WorkflowRunView): SuspendedStep | undefined {
  for (const [stepId, raw] of Object.entries(view.steps ?? {})) {
    const result = raw as
      | { status?: unknown; suspendPayload?: Record<string, unknown>; suspendedAt?: number }
      | undefined;
    if (result?.status !== 'suspended') continue;
    const { __workflow_meta: meta, ...payload } = result.suspendPayload ?? {};
    const nested = (meta as { path?: unknown } | undefined)?.path;
    // A nested workflow's suspension is reported on its parent step, with the path inside it.
    const path = [stepId, ...(Array.isArray(nested) ? nested.filter(part => typeof part === 'string') : [])];
    return { path, step: stepAt(workflow, path), payload, suspendedAt: result.suspendedAt };
  }
  return undefined;
}

/**
 * Whether `answered` (recorded when the task asked) is still the run's current suspension. Another
 * resume, from Studio or the API, moves the run on; a step that suspends again gets a new `suspendedAt`.
 */
export function isStillSuspended(view: WorkflowRunView, answered: AnsweredSuspension): boolean {
  const result = view.steps?.[answered.step[0]!] as { status?: unknown; suspendedAt?: number } | undefined;
  if (view.status !== 'suspended' || result?.status !== 'suspended') return false;
  return answered.suspendedAt === undefined || result.suspendedAt === answered.suspendedAt;
}

/** What a workflow task keeps of the suspension it asked about, to resume exactly that one. */
export interface AnsweredSuspension {
  step: string[];
  suspendedAt?: number;
}

/** Walks the workflow's step definitions along `path`, descending into nested workflows. */
function stepAt(workflow: Workflow, path: string[]): StepWithComponent | undefined {
  let steps: Record<string, StepWithComponent> | undefined = workflow.steps;
  let step: StepWithComponent | undefined;
  for (const id of path) {
    step = steps?.[id];
    if (!step) return undefined;
    steps = step.steps;
  }
  return step;
}
