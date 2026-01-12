import type { StreamVNextChunkType, TimeTravelParams } from '@mastra/client-js';
import type { TracingOptions } from '@mastra/core/observability';
import type { WorkflowStreamResult as CoreWorkflowStreamResult } from '@mastra/core/workflows';

/**
 * Workflow stream result with generic type parameters set to any for flexibility.
 */
export type WorkflowStreamResult = CoreWorkflowStreamResult<any, any, any, any>;

/**
 * Stream operation types.
 */
export type StreamOperation = 'stream' | 'observe' | 'resume' | 'timeTravel';

/**
 * Stream reader type alias for workflow streams.
 * Uses a generic interface to handle both browser and Node.js ReadableStream types.
 */
export interface WorkflowStreamReader {
  read(): Promise<{ done: boolean; value?: StreamVNextChunkType }>;
  releaseLock(): void;
}

/**
 * Parameters for streaming a workflow execution.
 */
export interface StreamParams {
  runId: string;
  inputData: Record<string, unknown>;
  initialState?: Record<string, unknown>;
  requestContext?: Record<string, unknown>;
  tracingOptions?: TracingOptions;
  perStep?: boolean;
  closeOnSuspend?: boolean;
}

/**
 * Parameters for observing an existing workflow run.
 */
export interface ObserveParams {
  runId: string;
  storeRunResult?: WorkflowStreamResult | null;
}

/**
 * Parameters for resuming a suspended workflow.
 */
export interface ResumeParams {
  runId: string;
  step: string | string[];
  resumeData: Record<string, unknown>;
  requestContext?: Record<string, unknown>;
  tracingOptions?: TracingOptions;
  perStep?: boolean;
}

/**
 * Parameters for time-traveling through workflow execution.
 */
export interface TimeTravelStreamParams extends Omit<TimeTravelParams, 'requestContext'> {
  runId?: string;
  requestContext?: Record<string, unknown>;
}

/**
 * Parameters for creating a new workflow run.
 */
export interface CreateRunParams {
  prevRunId?: string;
}

/**
 * Parameters for starting a workflow run.
 */
export interface StartRunParams {
  runId: string;
  input: Record<string, unknown>;
  requestContext?: Record<string, unknown>;
}

/**
 * Parameters for starting an async workflow run.
 */
export interface StartAsyncRunParams {
  runId?: string;
  input: Record<string, unknown>;
  requestContext?: Record<string, unknown>;
}

/**
 * Parameters for canceling a workflow run.
 */
export interface CancelRunParams {
  runId: string;
}
