import type { SerializedError } from '@mastra/core/error';
import type { WorkflowLeafCandidate } from '@mastra/core/storage';
import type { ExecutionContext, StepTripwireInfo, WorkflowRunStatus } from '@mastra/core/workflows';

/**
 * Contracts between a storage v2 Inngest workflow run and the leaf function that runs its steps.
 *
 * The parent run prepares a `request` record, invokes the workflow's leaf function with only its
 * key, and adopts the candidate the leaf settled on. Payloads hold record keys, never state or
 * step results, so Inngest memoizes small receipts.
 */

/** Version of the leaf protocol. Part of the leaf function's id, so a changed protocol gets a new function. */
export const LEAF_PROTOCOL_VERSION = 1;

/** The id of a workflow's leaf function. */
export function leafFunctionId(workflowId: string): string {
  return `workflow.${workflowId}.leaf.v${LEAF_PROTOCOL_VERSION}`;
}

/** The event that names a workflow's leaf function. Leaves run through `step.invoke`, not this event. */
export function leafEventName(workflowId: string): string {
  return `workflow.${workflowId}.leaf.v${LEAF_PROTOCOL_VERSION}`;
}

/** What one leaf execution runs: stored by the parent run, keyed by the leaf run id. */
export interface LeafRequest {
  v: 1;
  workflowId: string;
  runId: string;
  resourceId?: string;
  stepId: string;
  /** The Mastra retry attempt, as `retryCount` reports it to the step. */
  attempt: number;
  /** The parent run's state version the step runs against. */
  baseSeq: number;
  executionContext: Omit<ExecutionContext, 'state'>;
  prevOutput: unknown;
  resume?: { steps: string[]; resumePayload: any; label?: string; forEachIndex?: number };
  /** The request context, without the bearer token. */
  requestContext: Record<string, any>;
  iterationCount?: number;
  perStep?: boolean;
}

/** The data of a leaf invocation. */
export interface LeafInvokeData {
  v: 1;
  workflowId: string;
  runId: string;
  leafRunId: string;
  /** Per-call actor signal; never stored. */
  actor?: unknown;
}

/** What the step's code did once. `failed` covers thrown errors, including tripwires. */
export type LeafOutcome =
  | {
      status: 'completed';
      /** The step runner's return, without its state changes, which the candidate's patch holds. */
      result: {
        output: unknown;
        suspended?: unknown;
        bailed?: unknown;
        nestedWflowStepPaused?: unknown;
        contextMutations: {
          suspendedPaths: Record<string, number[]>;
          resumeLabels: Record<string, { stepId: string; foreachIndex?: number }>;
          requestContextUpdate: Record<string, any> | null;
        };
      };
    }
  | {
      status: 'failed';
      error: SerializedError;
      endedAt: number;
      nonRetryable?: true;
      tripwire?: StepTripwireInfo;
    };

export type LeafCandidate = WorkflowLeafCandidate<LeafOutcome>;

/** What a leaf function returns: the candidate it settled on. */
export interface LeafReturn {
  v: 1;
  leafRunId: string;
  candidateId: string;
  status: LeafOutcome['status'];
}

// A Record so a status added to WorkflowRunStatus fails to compile until it is listed here.
const NOT_CANCELED: Record<Exclude<WorkflowRunStatus, 'canceled'>, true> = {
  running: true,
  success: true,
  failed: true,
  tripwire: true,
  suspended: true,
  waiting: true,
  pending: true,
  bailed: true,
  paused: true,
  skipped: true,
};

/** Every status but `canceled`: writes to a canceled run are rejected. */
export const NOT_CANCELED_STATUSES = Object.keys(NOT_CANCELED) as WorkflowRunStatus[];

/**
 * Thrown when the leaf machinery itself fails (an invoke that failed, a record that's missing), as
 * opposed to the step's code. It fails the run's Inngest function so Inngest retries it, instead
 * of becoming a failed step result.
 */
export class LeafInfrastructureError extends Error {
  readonly isLeafInfrastructureError = true;
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'LeafInfrastructureError';
  }
}

export function isLeafInfrastructureError(error: unknown): error is LeafInfrastructureError {
  return !!error && typeof error === 'object' && (error as any).isLeafInfrastructureError === true;
}

/** Points where tests inject a crash after a durable write and before Inngest records its step. */
export type LeafFaultPoint = 'candidate-staged' | 'final-written' | 'adoption-written';

let leafFaultHook: ((point: LeafFaultPoint, info: { leafRunId?: string; occurrenceKey?: string }) => void) | undefined;

/** @internal Test-only: throw from `hook` to simulate a crash at a fault point. */
export function __setLeafFaultHook(hook: typeof leafFaultHook): void {
  leafFaultHook = hook;
}

export function injectLeafFault(point: LeafFaultPoint, info: { leafRunId?: string; occurrenceKey?: string }): void {
  leafFaultHook?.(point, info);
}
