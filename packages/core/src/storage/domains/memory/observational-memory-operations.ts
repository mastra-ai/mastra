/**
 * Claims on running Observational Memory operations.
 *
 * OM sets a record flag (`isReflecting`, `isBufferingObservation`, ...) while an operation runs. When it
 * finds a flag set, it asks storage who owns the operation; with no owner, the flag is treated as left
 * behind by a dead process and cleared. Claims use the same vocabulary as `LeaseProvider`: an owner id,
 * a TTL, renew, and release.
 */

export type ObservationalMemoryOperationName =
  | 'reflecting'
  | 'observing'
  | 'bufferingObservation'
  | 'bufferingReflection';

export interface ObservationalMemoryOperationRef {
  recordId: string;
  operation: ObservationalMemoryOperationName;
}

export interface ObservationalMemoryOperationClaimInput extends ObservationalMemoryOperationRef {
  owner: string;
  ttlMs: number;
}

export interface ObservationalMemoryOperationClaimResult {
  claimed: boolean;
  /** The current owner when the claim was refused. */
  owner?: string;
}

/**
 * Process-local claims, the default for every storage adapter.
 *
 * Only sees claims made in this process, so it is correct for a single process only. Claims are
 * counted per owner: one owner may hold several (chained `buffer()` calls each claim before awaiting
 * their predecessor). TTLs are ignored, since a live process knows its own operations are running.
 *
 * Every method mutates synchronously, so a caller that does not await still has its claim registered
 * before its next `await`. OM relies on this.
 */
export class InProcessObservationalMemoryOperations {
  private readonly claims = new Map<string, { owner: string; count: number }>();

  private key({ recordId, operation }: ObservationalMemoryOperationRef): string {
    return `${recordId}:${operation}`;
  }

  claim(input: ObservationalMemoryOperationClaimInput): ObservationalMemoryOperationClaimResult {
    const key = this.key(input);
    const current = this.claims.get(key);
    if (current && current.owner !== input.owner) return { claimed: false, owner: current.owner };
    this.claims.set(key, { owner: input.owner, count: (current?.count ?? 0) + 1 });
    return { claimed: true };
  }

  renew(input: ObservationalMemoryOperationClaimInput): boolean {
    return this.claims.get(this.key(input))?.owner === input.owner;
  }

  release(input: ObservationalMemoryOperationRef & { owner: string }): void {
    const key = this.key(input);
    const current = this.claims.get(key);
    if (!current || current.owner !== input.owner) return;
    if (current.count <= 1) this.claims.delete(key);
    else current.count--;
  }

  getOwner(ref: ObservationalMemoryOperationRef): string | undefined {
    return this.claims.get(this.key(ref))?.owner;
  }
}

/** Shared by every storage adapter instance in the process, matching OM's previous module-level registry. */
export const inProcessObservationalMemoryOperations = new InProcessObservationalMemoryOperations();
