import type { OnIterationCompleteHandler } from '../agent/agent.types';
import type { CreatedAgentSignal } from '../agent/signals';
import type { IMastraLogger } from '../logger';
import type { Mastra } from '../mastra';
import type { LoopOptions } from './types';

/**
 * Engine-agnostic between-iterations loop state.
 *
 * The durable loop has always materialized this state: it flows through its
 * dowhile as serialized workflow input/output (`baseIterationStateSchema`,
 * which must stay assignable to this shape — checked at compile time where
 * the durable loop declares its state type). The main loop keeps the same
 * shape as a single in-memory object owned by its continuation predicate;
 * nothing about the main loop gets serialized. Sharing the shape is what
 * lets continuation logic converge across engines (PHASE3 Step 3) instead
 * of operating on scattered closure variables.
 *
 * Flags are optional because each engine materializes only what it maintains
 * today; fields note which engine currently writes them.
 */
export interface LoopIterationState<TStep = unknown> {
  /** Steps accumulated across iterations, passed to `stopWhen` (both engines). */
  accumulatedSteps: TStep[];
  /**
   * Two-phase feedback stop: `onIterationComplete` returned
   * `{ continue: false, feedback }`, so one more LLM turn runs with the
   * feedback and the loop stops on the next predicate evaluation (both
   * engines).
   */
  pendingFeedbackStop?: boolean;
  /**
   * A delegation hook called `ctx.bail()` — stop after this iteration.
   * Durable state today; the main loop tracks this via RunScope until the
   * continuation core hoists (PHASE3 Step 3).
   */
  delegationBailed?: boolean;
  /** A background task dispatched this iteration is still pending (durable). */
  backgroundTaskPending?: boolean;
  /**
   * This run is a resume (e.g. after tool approval) and its first loop-back
   * must seal the already-flushed assistant message and rotate to a fresh
   * response message (issue #19445). Main maintains this today; declared on
   * the contract so the pending durable port (ledger L10) has its slot.
   */
  resumeContinuationPending?: boolean;
}

/**
 * Main-loop materialization of {@link LoopIterationState}: held in memory by
 * the continuation predicate, never serialized. Adds bookkeeping only the
 * main loop needs.
 */
export interface MainLoopIterationState<TStep> extends LoopIterationState<TStep> {
  pendingFeedbackStop: boolean;
  resumeContinuationPending: boolean;
  /**
   * Response-content length after the previous iteration; the predicate
   * slices from here to isolate the content this iteration added. (The
   * durable loop instead materializes a per-iteration `lastStepResult`.)
   */
  previousContentLength: number;
}

/**
 * The resolved, live (non-serializable) view of a run that loop predicates
 * and step bodies operate through.
 *
 * Each engine resolves it its own way — the main loop from per-run builder
 * params + RunScope, the durable loop from serialized iteration state + the
 * in-process run registry — but consumers are engine-blind. Values resolved
 * here must never be written onto {@link LoopIterationState}: they are live
 * handles (closures, signals, transports) that must not cross a wire.
 *
 * The surface grows as steps hoist onto the shared builder (PHASE3 Steps
 * 3–5); only fields with live consumers are declared.
 */
export interface LoopRuntime {
  runId: string;
  agentId: string;
  agentName?: string;
  threadId?: string;
  resourceId?: string;
  /** Per-run iteration cap (durable resolves run options ?? builder default). */
  maxSteps?: number;
  mastra?: Mastra;
  logger?: IMastraLogger;
  /**
   * Durable resolves the run registry's abort signal; unset on the main loop
   * (abort is handled upstream of its predicate).
   */
  abortSignal?: AbortSignal;
  stopWhen?: LoopOptions['stopWhen'];
  onIterationComplete?: OnIterationCompleteHandler;
  /**
   * Drain signals queued for this run. Normalized across engines (ledger
   * L13): `runId` is pre-bound by the resolving engine and the underlying
   * runtime defaults `scope` to `'pending'`.
   */
  drainPendingSignals?: (scope?: 'pending' | 'pre-run') => CreatedAgentSignal[];
}
