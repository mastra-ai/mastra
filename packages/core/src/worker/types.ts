import type { StepResult } from '../workflows/types';

export type { WorkerDeps } from './worker';

export interface StepExecutionStrategy {
  executeStep(params: StepExecutionParams): Promise<StepResult<unknown, unknown, unknown, unknown>>;
}

export interface StepExecutionParams {
  workflowId: string;
  runId: string;
  stepId: string;
  executionPath: number[];
  stepResults: Record<string, unknown>;
  state: Record<string, unknown>;
  requestContext: Record<string, unknown>;
  input?: unknown;
  resumeData?: unknown;
  retryCount?: number;
  foreachIdx?: number;
  format?: 'legacy' | 'vnext';
  perStep?: boolean;
  validateInputs?: boolean;
  abortSignal?: AbortSignal;
}
