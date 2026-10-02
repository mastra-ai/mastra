import { ErrorCategory, ErrorDomain, MastraError } from '../error';

/**
 * The claim a durable run execution holds on its run.
 *
 * Writes that carry a fence are applied only while the fence is still the
 * run's current claim; the check and the write happen atomically in storage.
 * A write without a fence behaves exactly as before.
 *
 * A write made inside a durable run execution carries that execution's fence
 * without the caller passing it: adapters resolve it with
 * {@link resolveRunFence}.
 */
export interface RunFence {
  /**
   * The run whose claim the write is checked against. A nested workflow run
   * the engine stores under its own runId carries its parent run's fence.
   */
  runId: string;
  /** Monotonic claim counter for the run. Every claim increments it. */
  generation: number;
  /** Id of the execution that made the claim. */
  ownerId: string;
}

/** Current ownership of a durable run, as held by the workflows domain. */
export interface RunOwnershipRecord {
  runId: string;
  generation: number;
  /** Id of the execution that made the latest claim. Kept after release. */
  ownerId: string;
  /** Null once the owner released the run. */
  leaseExpiresAt: Date | null;
  /** Whether the owner holds an unexpired lease, judged on the store's clock. */
  live: boolean;
}

export interface ClaimRunOwnershipInput {
  runId: string;
  ownerId: string;
  /** Lease length, measured from the store's clock. */
  leaseMs: number;
  /** Take the run even if another execution holds a live lease. */
  force?: boolean;
  /**
   * Claim only if the run's generation still equals this value (0 when the
   * run has no ownership record yet). Lets racing claimers that observed the
   * same state resolve to a single winner, even when forcing.
   */
  expectedGeneration?: number;
}

export type ClaimRunOwnershipResult =
  | { acquired: true; record: RunOwnershipRecord }
  | { acquired: false; record: RunOwnershipRecord | null };

export interface RenewRunOwnershipInput extends RunFence {
  leaseMs: number;
}

export type RenewRunOwnershipResult =
  | { renewed: true; record: RunOwnershipRecord }
  | { renewed: false; record: RunOwnershipRecord | null };

export const RUN_FENCE_CONFLICT_ERROR_ID = 'STORAGE_RUN_FENCE_CONFLICT';
export const RUN_FENCING_NOT_SUPPORTED_ERROR_ID = 'STORAGE_RUN_FENCING_NOT_SUPPORTED';

/**
 * Thrown by storage when a fenced write's claim is no longer the run's
 * current claim. Nothing was written.
 *
 * Constructing it inside a durable run execution tells that execution it lost
 * the run, even when the caller of the write swallows the error.
 */
export class RunFenceConflictError extends MastraError {
  constructor(fence: RunFence, operation: string) {
    super({
      id: RUN_FENCE_CONFLICT_ERROR_ID,
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `Rejected ${operation} for run ${fence.runId}: generation ${fence.generation} held by ${fence.ownerId} is no longer the run's current claim.`,
      details: { runId: fence.runId, generation: fence.generation, ownerId: fence.ownerId, operation },
    });
    this.name = 'RunFenceConflictError';
    getRunFenceContext()?.current()?.onConflict?.(fence);
  }
}

/** Whether `error`, or anything in its cause chain, is a {@link RunFenceConflictError}. */
export function isRunFenceConflictError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 8 && current && typeof current === 'object'; depth++) {
    const { id, code } = current as { id?: unknown; code?: unknown };
    if (id === RUN_FENCE_CONFLICT_ERROR_ID || code === RUN_FENCE_CONFLICT_ERROR_ID) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export function runFencingNotSupportedError(domain: string, adapter: string): MastraError {
  return new MastraError({
    id: RUN_FENCING_NOT_SUPPORTED_ERROR_ID,
    domain: ErrorDomain.STORAGE,
    category: ErrorCategory.USER,
    text: `${adapter} does not support run fencing in the ${domain} domain. Check supportsRunFencing() before calling run ownership operations.`,
  });
}

/** Whether a stored claim matches `fence`. Adapters use this for the check half of a fenced write. */
export function matchesRunFence(
  current: { generation: number; ownerId: string } | null | undefined,
  fence: RunFence,
): boolean {
  return !!current && current.generation === fence.generation && current.ownerId === fence.ownerId;
}

/** Supplies the fence for writes made inside a durable run execution. */
export interface RunFenceScope {
  /**
   * The fence a write to `store` carries, or `undefined` when the scope does
   * not cover the write. Workflows writes pass the run they target; memory
   * writes omit it.
   */
  fenceFor(store: object, runId?: string): RunFence | undefined;
  /** Storage rejected a write carrying `fence`. */
  onConflict?(fence: RunFence): void;
  /**
   * The engine started `nestedRunId` under `parentRunId`. A scope covering
   * the parent covers the nested run too.
   */
  coverNestedRun?(parentRunId: string, nestedRunId: string): void;
}

/** The async context that carries the current {@link RunFenceScope}. */
export interface RunFenceContext {
  current(): RunFenceScope | undefined;
  run<T>(scope: RunFenceScope | undefined, fn: () => T): T;
}

// Kept on globalThis so storage adapters resolve the scope the durable runtime
// installed even when they load a different copy of core (CJS next to ESM).
const RUN_FENCE_CONTEXT = Symbol.for('mastra.storage.runFenceContext');
type RunFenceGlobal = typeof globalThis & { [RUN_FENCE_CONTEXT]?: RunFenceContext };

function getRunFenceContext(): RunFenceContext | undefined {
  return (globalThis as RunFenceGlobal)[RUN_FENCE_CONTEXT];
}

/**
 * Install the async context that carries run fence scopes, unless another copy
 * of core already installed one. Returns the installed context. The durable
 * agent runtime installs it, which keeps `node:async_hooks` out of storage.
 *
 * @internal
 */
export function setRunFenceContext(context: RunFenceContext): RunFenceContext {
  return ((globalThis as RunFenceGlobal)[RUN_FENCE_CONTEXT] ??= context);
}

/**
 * Run `fn` outside any run's fence scope. Long-lived work started from inside
 * a run that does not belong to it (workers, subscriptions, in-process pubsub
 * delivery) uses this so its writes do not carry the run's fence.
 */
export function runOutsideRunFenceScope<T>(fn: () => T): T {
  const context = getRunFenceContext();
  return context?.current() ? context.run(undefined, fn) : fn();
}

/**
 * Tell the current run fence scope that `nestedRunId` runs under
 * `parentRunId`. Engines that store a nested workflow run under its own runId
 * call this before the nested run's first write, so those writes carry the
 * parent run's fence.
 *
 * @internal
 */
export function coverNestedRun(parentRunId: string, nestedRunId: string): void {
  getRunFenceContext()?.current()?.coverNestedRun?.(parentRunId, nestedRunId);
}

/**
 * The fence a write to `store` must carry: the explicit `fence`, otherwise
 * the fence of the durable run execution the write happens in. Adapters call
 * this at the start of every fenced write, passing the domain store itself as
 * `store` and, for workflows writes, the run the write targets.
 */
export function resolveRunFence(store: object, fence: RunFence | undefined, runId?: string): RunFence | undefined {
  return fence ?? getRunFenceContext()?.current()?.fenceFor(store, runId);
}
