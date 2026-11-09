import type { ActorSignal } from '../auth/ee';
import type { StepResult } from '../workflows/types';

export type { WorkerDeps, WorkerStopOptions } from './worker';

export interface StepExecutionStrategy {
  executeStep(params: StepExecutionParams): Promise<StepResult<unknown, unknown, unknown, unknown>>;
}

/**
 * Identifies the parent workflow a nested workflow's step runs under, and that
 * workflow's own parent, up to the top-level run. A nested workflow is usually
 * reachable only from its parent's step graph, not by id, so the executing
 * process needs this chain to resolve it.
 */
export interface StepExecutionParentWorkflow {
  workflowId: string;
  runId: string;
  executionPath: number[];
  parentWorkflow?: StepExecutionParentWorkflow;
}

export interface StepExecutionParams {
  workflowId: string;
  runId: string;
  stepId: string;
  executionPath: number[];
  /** Set when the step belongs to a nested workflow. */
  parentWorkflow?: StepExecutionParentWorkflow;
  stepResults: Record<string, unknown>;
  state: Record<string, unknown>;
  requestContext: Record<string, unknown>;
  actor?: ActorSignal;
  input?: unknown;
  resumeData?: unknown;
  retryCount?: number;
  foreachIdx?: number;
  format?: 'legacy' | 'vnext';
  perStep?: boolean;
  validateInputs?: boolean;
  abortSignal?: AbortSignal;
}
