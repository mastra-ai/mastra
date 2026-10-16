import { hostname } from 'node:os';
import type { MemoryStorage, ObservationalMemoryOperationName } from '@mastra/core/storage';

/**
 * Tracks which Observational Memory operations (reflecting, observing, buffering) are running,
 * through the storage adapter's operation claims.
 *
 * OM sets a DB flag (`isReflecting`, `isBufferingObservation`, ...) while an operation runs. When it
 * finds a flag set, it asks whether any owner holds the operation; if none does, the flag is treated
 * as left behind by a dead process and cleared.
 */

export type OmOperationName = ObservationalMemoryOperationName;

/** Identifies this process as an operation owner. One per module instance, so one per process. */
export const processOperationOwner = `${hostname()}:${process.pid}:${Math.random().toString(36).slice(2, 10)}`;

const OPERATION_TTL_MS = 5 * 60_000;

/**
 * Used when the installed `@mastra/core` predates storage operation claims. Matches the core
 * default: counted, process-local, correct for a single process only.
 */
const legacyActiveOps = new Map<string, number>();

function supportsOperationClaims(storage: MemoryStorage): boolean {
  return (
    typeof storage.claimObservationalMemoryOperation === 'function' &&
    typeof storage.releaseObservationalMemoryOperation === 'function' &&
    typeof storage.getObservationalMemoryOperationOwner === 'function'
  );
}

export class OMOperationTracker {
  private readonly useStorage: boolean;

  constructor(
    private readonly storage: MemoryStorage,
    private readonly owner: string = processOperationOwner,
  ) {
    this.useStorage = supportsOperationClaims(storage);
  }

  /** Registers the claim synchronously (before the caller's next await), so the result is not awaited. */
  begin(recordId: string, operation: OmOperationName): void {
    if (!this.useStorage) {
      const key = `${recordId}:${operation}`;
      legacyActiveOps.set(key, (legacyActiveOps.get(key) ?? 0) + 1);
      return;
    }
    void this.storage
      .claimObservationalMemoryOperation({ recordId, operation, owner: this.owner, ttlMs: OPERATION_TTL_MS })
      .catch(() => {});
  }

  end(recordId: string, operation: OmOperationName): void {
    if (!this.useStorage) {
      const key = `${recordId}:${operation}`;
      const count = legacyActiveOps.get(key) ?? 0;
      if (count <= 1) legacyActiveOps.delete(key);
      else legacyActiveOps.set(key, count - 1);
      return;
    }
    void this.storage.releaseObservationalMemoryOperation({ recordId, operation, owner: this.owner }).catch(() => {});
  }

  async isActive(recordId: string, operation: OmOperationName): Promise<boolean> {
    if (!this.useStorage) return (legacyActiveOps.get(`${recordId}:${operation}`) ?? 0) > 0;
    return (await this.storage.getObservationalMemoryOperationOwner({ recordId, operation })) !== undefined;
  }
}
