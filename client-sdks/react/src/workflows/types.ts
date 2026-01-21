import type { TimeTravelParams } from '@mastra/client-js';
import type { TracingOptions } from '@mastra/core/observability';
import type { WorkflowStreamResult as CoreWorkflowStreamResult } from '@mastra/core/workflows';
import type { MutationState } from '../lib/use-mutation';

/**
 * Workflow stream result type alias.
 */
export type WorkflowStreamResult = CoreWorkflowStreamResult<any, any, any, any>;

/**
 * Parameters for the useStreamWorkflow hook.
 */
export interface UseStreamWorkflowParams {
  /** Whether to enable debug mode for per-step execution */
  debugMode: boolean;
  /** Optional tracing options for observability */
  tracingOptions?: TracingOptions;
  /** Optional error handler callback */
  onError?: (error: Error, defaultMessage: string) => void;
}

/**
 * Parameters for streaming a workflow.
 */
export interface StreamWorkflowParams {
  /** The ID of the workflow */
  workflowId: string;
  /** The ID of the run */
  runId: string;
  /** Input data for the workflow */
  inputData: Record<string, unknown>;
  /** Optional initial state */
  initialState?: Record<string, unknown>;
  /** Request context to pass to the workflow */
  requestContext: Record<string, unknown>;
  /** Optional flag to enable per-step execution */
  perStep?: boolean;
}

/**
 * Parameters for observing a workflow stream.
 */
export interface ObserveWorkflowStreamParams {
  /** The ID of the workflow */
  workflowId: string;
  /** The ID of the run */
  runId: string;
  /** Optional stored run result to resume from */
  storeRunResult: WorkflowStreamResult | null;
}

/**
 * Parameters for resuming a workflow stream.
 */
export interface ResumeWorkflowStreamParams {
  /** The ID of the workflow */
  workflowId: string;
  /** The ID of the run */
  runId: string;
  /** The step or steps to resume */
  step: string | string[];
  /** Data to resume with */
  resumeData: Record<string, unknown>;
  /** Request context to pass to the workflow */
  requestContext: Record<string, unknown>;
  /** Optional flag to enable per-step execution */
  perStep?: boolean;
}

/**
 * Parameters for time-traveling a workflow stream.
 */
export interface TimeTravelWorkflowStreamParams extends Omit<TimeTravelParams, 'requestContext'> {
  /** The ID of the workflow */
  workflowId: string;
  /** Request context to pass to the workflow */
  requestContext: Record<string, unknown>;
  /** Optional run ID */
  runId?: string;
  /** Optional flag to enable per-step execution */
  perStep?: boolean;
}

/**
 * Parameters for creating a workflow run.
 */
export interface CreateWorkflowRunParams {
  /** The ID of the workflow to create a run for */
  workflowId: string;
  /** Optional previous run ID to continue from */
  prevRunId?: string;
}

/**
 * Result of creating a workflow run.
 */
export interface CreateWorkflowRunResult {
  /** The ID of the newly created run */
  runId: string;
}

/**
 * Parameters for starting a workflow run.
 */
export interface StartWorkflowRunParams {
  /** The ID of the workflow */
  workflowId: string;
  /** The ID of the run to start */
  runId: string;
  /** Input data for the workflow */
  input: Record<string, unknown>;
  /** Optional request context to pass to the workflow */
  requestContext?: Record<string, unknown>;
}

/**
 * Parameters for canceling a workflow run.
 */
export interface CancelWorkflowRunParams {
  /** The ID of the workflow */
  workflowId: string;
  /** The ID of the run to cancel */
  runId: string;
}

/**
 * Result of canceling a workflow run.
 */
export interface CancelWorkflowRunResult {
  /** Confirmation message */
  message: string;
}
