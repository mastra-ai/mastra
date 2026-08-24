import { randomUUID } from 'node:crypto';

import type { ObservationBufferClaimOutcome } from '@mastra/core/storage';

import { omDebug } from './debug';

/**
 * Storage surface the lease needs. Matches the memory storage domain's
 * observation-buffer claim contract.
 */
export interface ObservationBufferLeaseStorage {
  acquireObservationBufferClaim(input: {
    id: string;
    ownerToken: string;
    leaseMs: number;
    lastBufferedAtTokens?: number;
  }): Promise<ObservationBufferClaimOutcome>;
  renewObservationBufferClaim(input: {
    id: string;
    ownerToken: string;
    leaseMs: number;
  }): Promise<ObservationBufferClaimOutcome>;
  releaseObservationBufferClaim(input: { id: string; ownerToken: string }): Promise<ObservationBufferClaimOutcome>;
}

/**
 * Internal lease policy. Two-minute lease renewed every thirty seconds: the
 * four-to-one margin tolerates ordinary scheduling delay while bounding crash
 * recovery. Test-injectable via ObservationalMemory's internal
 * `observationBufferLeasePolicy`; never public configuration.
 */
export interface ObservationBufferLeasePolicy {
  leaseMs: number;
  renewalIntervalMs: number;
}

export const DEFAULT_OBSERVATION_BUFFER_LEASE_POLICY: ObservationBufferLeasePolicy = {
  leaseMs: 120_000,
  renewalIntervalMs: 30_000,
};

/**
 * A durable, renewable ownership claim over one observation-buffer cycle.
 *
 * The storage claim is the authority for who may commit or release; this class
 * only carries the cycle's owner token, keeps the lease renewed while the
 * observer runs, and tracks confirmed loss so late completions short-circuit.
 *
 * Renewal failure policy:
 * - a backend-confirmed `lost` outcome immediately unauthorizes the cycle;
 * - an indeterminate transport failure leaves the cycle live on its existing
 *   lease and retries at the next interval;
 * - if the lease expires before a renewal succeeds, the cycle is treated as
 *   lost and its output is discarded. Release is never attempted with a
 *   possibly-still-valid token after an indeterminate failure alone.
 */
export class ObservationBufferLease {
  readonly ownerToken: string;
  readonly recordId: string;

  #storage: ObservationBufferLeaseStorage;
  #policy: ObservationBufferLeasePolicy;
  #lost = false;
  #released = false;
  #timer: ReturnType<typeof setTimeout> | undefined;
  /** Client-side estimate of the last storage-confirmed expiry. */
  #lastConfirmedExpiresAtMs: number;

  private constructor(args: {
    storage: ObservationBufferLeaseStorage;
    recordId: string;
    ownerToken: string;
    policy: ObservationBufferLeasePolicy;
  }) {
    this.#storage = args.storage;
    this.recordId = args.recordId;
    this.ownerToken = args.ownerToken;
    this.#policy = args.policy;
    this.#lastConfirmedExpiresAtMs = Date.now() + args.policy.leaseMs;
  }

  /**
   * Atomically acquire the durable claim for `recordId`. Returns the live
   * lease with renewal running, or null when another owner holds the claim.
   * Storage errors (including not-found) propagate to the caller.
   */
  static async acquire(args: {
    storage: ObservationBufferLeaseStorage;
    recordId: string;
    policy?: ObservationBufferLeasePolicy;
    lastBufferedAtTokens?: number;
  }): Promise<ObservationBufferLease | null> {
    const policy = args.policy ?? DEFAULT_OBSERVATION_BUFFER_LEASE_POLICY;
    const ownerToken = randomUUID();
    const outcome = await args.storage.acquireObservationBufferClaim({
      id: args.recordId,
      ownerToken,
      leaseMs: policy.leaseMs,
      lastBufferedAtTokens: args.lastBufferedAtTokens,
    });
    if (!outcome.ok) return null;
    const lease = new ObservationBufferLease({ storage: args.storage, recordId: args.recordId, ownerToken, policy });
    lease.#scheduleRenewal();
    return lease;
  }

  /** True once storage confirmed loss or the lease expired without renewal. */
  get lost(): boolean {
    return this.#lost;
  }

  #scheduleRenewal() {
    if (this.#lost || this.#released) return;
    this.#timer = setTimeout(() => {
      void this.#renewOnce().finally(() => this.#scheduleRenewal());
    }, this.#policy.renewalIntervalMs);
    // Renewal must never keep the process or memory.settled() alive; the
    // cycle's finally tears the loop down.
    this.#timer.unref?.();
  }

  async #renewOnce(): Promise<void> {
    if (this.#lost || this.#released) return;
    try {
      const outcome = await this.#storage.renewObservationBufferClaim({
        id: this.recordId,
        ownerToken: this.ownerToken,
        leaseMs: this.#policy.leaseMs,
      });
      if (!outcome.ok) {
        // Backend-confirmed zero-match: definitively lost.
        this.#lost = true;
        omDebug(`[OM:bufferLease] renewal lost for record ${this.recordId}; cycle is unauthorized to commit`);
        return;
      }
      this.#lastConfirmedExpiresAtMs = outcome.claim.expiresAt.getTime();
    } catch (error) {
      // Indeterminate transport failure: continue on the existing lease and
      // retry at the next interval. If the lease has expired without a
      // successful renewal, abort: the storage predicate would reject the
      // commit anyway, and a takeover may already have happened.
      if (Date.now() >= this.#lastConfirmedExpiresAtMs) {
        this.#lost = true;
        omDebug(
          `[OM:bufferLease] lease for record ${this.recordId} expired before a renewal succeeded; aborting cycle`,
        );
      } else {
        omDebug(
          `[OM:bufferLease] indeterminate renewal failure for record ${this.recordId}; continuing on existing lease: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  #stopRenewal() {
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = undefined;
    }
  }

  /**
   * Release the claim if this lease still owns it. Confirmed-lost leases never
   * attempt release (the token may belong to nothing, or worse, a race with a
   * successor); indeterminate prior failures are safe because release is
   * itself owner-conditioned in storage.
   */
  async release(): Promise<void> {
    this.#stopRenewal();
    if (this.#released) return;
    this.#released = true;
    if (this.#lost) return;
    try {
      await this.#storage.releaseObservationBufferClaim({ id: this.recordId, ownerToken: this.ownerToken });
    } catch (error) {
      omDebug(
        `[OM:bufferLease] release failed for record ${this.recordId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
