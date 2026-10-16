import { randomUUID } from 'node:crypto';
import type { ObservationalMemoryOperationName } from '@mastra/core/storage';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ObservationalMemoryConcurrencyStores } from './observational-memory-concurrency';

export interface ObservationalMemoryOperationClaimTestOptions {
  label: string;
  /** Two store instances on the same database, standing in for two processes. */
  createStores: () => Promise<ObservationalMemoryConcurrencyStores>;
  timeout?: number;
}

/**
 * Cross-process semantics for adapters that set `supportsDistributedObservationalMemoryOperations`:
 * a claim made through one store is visible to, and exclusive against, the other.
 */
export function createObservationalMemoryOperationClaimTests({
  label,
  createStores,
  timeout = 60_000,
}: ObservationalMemoryOperationClaimTestOptions) {
  describe(`${label} observational memory operation claims`, () => {
    let stores: ObservationalMemoryConcurrencyStores;

    beforeAll(async () => {
      stores = await createStores();
    }, timeout);

    afterAll(async () => {
      await stores?.cleanup?.();
    }, timeout);

    const ref = (operation: ObservationalMemoryOperationName = 'bufferingObservation') => ({
      recordId: `om-claim-${randomUUID()}`,
      operation,
    });
    const TTL = 60_000;

    it('declares distributed claims', () => {
      expect(stores.a.supportsDistributedObservationalMemoryOperations).toBe(true);
      expect(stores.b.supportsDistributedObservationalMemoryOperations).toBe(true);
    });

    it('shows a claim made through one store to the other', async () => {
      const op = ref();
      expect(await stores.a.claimObservationalMemoryOperation({ ...op, owner: 'A', ttlMs: TTL })).toEqual({
        claimed: true,
      });
      expect(await stores.b.getObservationalMemoryOperationOwner(op)).toBe('A');
    });

    it('refuses a second owner while the claim is held, and grants it after release', async () => {
      const op = ref();
      await stores.a.claimObservationalMemoryOperation({ ...op, owner: 'A', ttlMs: TTL });
      expect(await stores.b.claimObservationalMemoryOperation({ ...op, owner: 'B', ttlMs: TTL })).toEqual({
        claimed: false,
        owner: 'A',
      });

      await stores.a.releaseObservationalMemoryOperation({ ...op, owner: 'A' });
      expect(await stores.b.getObservationalMemoryOperationOwner(op)).toBeUndefined();
      expect(await stores.b.claimObservationalMemoryOperation({ ...op, owner: 'B', ttlMs: TTL })).toEqual({
        claimed: true,
      });
      expect(await stores.a.getObservationalMemoryOperationOwner(op)).toBe('B');
    });

    it('grants exactly one of two racing owners', async () => {
      for (let i = 0; i < 10; i++) {
        const op = ref();
        const results = await Promise.all([
          stores.a.claimObservationalMemoryOperation({ ...op, owner: 'A', ttlMs: TTL }),
          stores.b.claimObservationalMemoryOperation({ ...op, owner: 'B', ttlMs: TTL }),
        ]);
        expect(results.filter(r => r.claimed)).toHaveLength(1);
      }
    });

    it('keeps the claim until the owner releases every counted claim', async () => {
      const op = ref();
      await stores.a.claimObservationalMemoryOperation({ ...op, owner: 'A', ttlMs: TTL });
      await stores.a.claimObservationalMemoryOperation({ ...op, owner: 'A', ttlMs: TTL });

      await stores.a.releaseObservationalMemoryOperation({ ...op, owner: 'A' });
      expect(await stores.b.getObservationalMemoryOperationOwner(op)).toBe('A');

      await stores.a.releaseObservationalMemoryOperation({ ...op, owner: 'A' });
      expect(await stores.b.getObservationalMemoryOperationOwner(op)).toBeUndefined();
    });

    it('ignores release and renew from an owner that does not hold the claim', async () => {
      const op = ref();
      await stores.a.claimObservationalMemoryOperation({ ...op, owner: 'A', ttlMs: TTL });
      await stores.b.releaseObservationalMemoryOperation({ ...op, owner: 'B' });
      expect(await stores.b.renewObservationalMemoryOperation({ ...op, owner: 'B', ttlMs: TTL })).toBe(false);
      expect(await stores.b.getObservationalMemoryOperationOwner(op)).toBe('A');
      expect(await stores.a.renewObservationalMemoryOperation({ ...op, owner: 'A', ttlMs: TTL })).toBe(true);
    });

    it('expires a claim whose owner stops renewing, so another process can take over', async () => {
      const op = ref();
      await stores.a.claimObservationalMemoryOperation({ ...op, owner: 'A', ttlMs: 200 });
      await new Promise(resolve => setTimeout(resolve, 400));

      expect(await stores.b.getObservationalMemoryOperationOwner(op)).toBeUndefined();
      expect(await stores.b.claimObservationalMemoryOperation({ ...op, owner: 'B', ttlMs: TTL })).toEqual({
        claimed: true,
      });
      expect(await stores.a.renewObservationalMemoryOperation({ ...op, owner: 'A', ttlMs: TTL })).toBe(false);
    });

    it('keys claims by record and operation', async () => {
      const op = ref('reflecting');
      await stores.a.claimObservationalMemoryOperation({ ...op, owner: 'A', ttlMs: TTL });
      expect(
        await stores.b.getObservationalMemoryOperationOwner({ recordId: op.recordId, operation: 'observing' }),
      ).toBeUndefined();
      expect(
        await stores.b.claimObservationalMemoryOperation({
          recordId: op.recordId,
          operation: 'observing',
          owner: 'B',
          ttlMs: TTL,
        }),
      ).toEqual({ claimed: true });
    });
  });
}
