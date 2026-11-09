import type { StepResult, WorkflowRunStatus } from '../../../workflows';
import type { RunFence } from '../../run-fencing';
import type { StatePatchOp } from './state-patch';

/**
 * The kind of a leaf record:
 * - `request`: what one leaf execution runs, keyed by the leaf run id. Written by the parent run.
 * - `candidate`: one execution's staged outcome, keyed by its candidate id. Immutable once stored.
 * - `final`: the candidate a leaf run settled on, keyed by the leaf run id. The first write wins,
 *   so duplicated leaf executions agree on it.
 * - `adoption`: the receipt of the candidate a parent run adopted for one step occurrence, keyed
 *   by the occurrence key. Written by `adoptWorkflowLeaf` only.
 * @experimental
 */
export type WorkflowLeafRecordKind = 'request' | 'candidate' | 'final' | 'adoption';

/**
 * A leaf candidate: the outcome of running one step occurrence once. Engines define `outcome`.
 * @experimental
 */
export interface WorkflowLeafCandidate<TOutcome = unknown> {
  v: 1;
  candidateId: string;
  leafRunId: string;
  /** The step's state changes relative to the state it ran against. Empty when it failed. */
  statePatch: StatePatchOp[];
  outcome: TOutcome;
}

/**
 * The record a leaf run settles on: the candidate it selected.
 * @experimental
 */
export interface WorkflowLeafFinal {
  v: 1;
  leafRunId: string;
  candidateId: string;
}

/**
 * The receipt of a leaf adoption: the parent run's state as of `seq` includes the candidate's
 * state changes, and its `stepId` result (when written) is the candidate's.
 * @experimental
 */
export interface WorkflowLeafAdoptionReceipt {
  v: 1;
  occurrenceKey: string;
  candidateId: string;
  /** The parent run's `lastSeq` after the adoption. */
  seq: number;
}

/**
 * Thrown when an occurrence is already adopted with a different candidate.
 * @experimental
 */
export class LeafAdoptionConflictError extends Error {
  constructor(
    readonly occurrenceKey: string,
    readonly adoptedCandidateId: string,
    readonly candidateId: string,
  ) {
    super(
      `Leaf occurrence ${occurrenceKey} is already adopted with candidate ${adoptedCandidateId}, not ${candidateId}`,
    );
    this.name = 'LeafAdoptionConflictError';
  }
}

export function isLeafAdoptionConflictError(error: unknown): error is LeafAdoptionConflictError {
  return error instanceof Error && error.name === 'LeafAdoptionConflictError';
}

/**
 * The arguments of `adoptWorkflowLeaf`.
 * @experimental
 */
export interface AdoptWorkflowLeafArgs {
  workflowName: string;
  runId: string;
  occurrenceKey: string;
  candidateId: string;
  /** Step results to write with the adoption. */
  steps?: Record<string, StepResult<any, any, any, any>>;
  /** State changes to apply on top of the run's current state. */
  statePatch?: StatePatchOp[];
  expectedStatus?: WorkflowRunStatus | WorkflowRunStatus[];
  fence?: RunFence;
}

/**
 * The result of `adoptWorkflowLeaf`: the receipt, and whether this call wrote it.
 * @experimental
 */
export interface AdoptWorkflowLeafResult {
  receipt: WorkflowLeafAdoptionReceipt;
  adopted: boolean;
}
