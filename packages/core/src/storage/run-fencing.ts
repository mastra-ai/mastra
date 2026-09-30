import { ErrorCategory, ErrorDomain, MastraError } from '../error';

/**
 * The claim a durable run execution holds on its run.
 *
 * Writes that carry a fence are applied only while the fence is still the
 * run's current claim; the check and the write happen atomically in storage.
 * A write without a fence behaves exactly as before.
 */
export interface RunFence {
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
  /** Null once the owner released the run. */
  ownerId: string | null;
  leaseExpiresAt: Date | null;
  /** Whether an owner holds an unexpired lease, judged on the store's clock. */
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

export interface ReleaseRunOwnershipInput extends RunFence {
  /** Delete the record instead of clearing the owner. Use once the run is finished. */
  remove?: boolean;
}

export const RUN_FENCE_CONFLICT_ERROR_ID = 'STORAGE_RUN_FENCE_CONFLICT';
export const RUN_FENCING_NOT_SUPPORTED_ERROR_ID = 'STORAGE_RUN_FENCING_NOT_SUPPORTED';

/**
 * Thrown by storage when a fenced write's claim is no longer the run's
 * current claim. Nothing was written.
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
  current: { generation: number; ownerId: string | null } | null | undefined,
  fence: RunFence,
): boolean {
  return !!current && current.generation === fence.generation && current.ownerId === fence.ownerId;
}
