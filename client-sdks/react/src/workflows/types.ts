import type { MutationState } from '../lib/use-mutation';

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
