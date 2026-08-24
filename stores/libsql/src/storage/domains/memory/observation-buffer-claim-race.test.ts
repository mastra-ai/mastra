import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LibSQLStore } from '../../..';

/**
 * Two independent LibSQLStore instances (separate clients, separate in-process
 * write locks) open the same database file and race claim acquisition. The
 * process-local write lock cannot serialize them, so exclusivity must come
 * from the conditional UPDATE itself. Exactly one winner per round; the loser
 * gets `{ ok: false, reason: 'lost' }`, never an SQLITE_BUSY crash (the store
 * applies its busy_timeout pragma to local files).
 */
describe('LibSQL observation buffer claim cross-instance race', () => {
  let tmpDir: string;
  let storeA: LibSQLStore;
  let storeB: LibSQLStore;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'libsql-om-claim-race-'));
  });

  afterEach(async () => {
    await storeA?.close?.();
    await storeB?.close?.();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('exactly one of two store instances wins claim acquisition per round', async () => {
    const url = `file:${path.join(tmpDir, 'claim-race.db')}`;
    storeA = new LibSQLStore({ id: 'om-claim-race-a', url });
    storeB = new LibSQLStore({ id: 'om-claim-race-b', url });
    const memA = storeA.stores.memory!;
    const memB = storeB.stores.memory!;
    await memA.init();

    const resourceId = `resource-${randomUUID()}`;
    const record = await memA.initializeObservationalMemory({
      threadId: null,
      resourceId,
      scope: 'resource',
      config: { observationThreshold: 5000, reflectionThreshold: 40000 },
    });

    const ROUNDS = 20;
    for (let round = 0; round < ROUNDS; round++) {
      const tokenA = `a-${round}-${randomUUID()}`;
      const tokenB = `b-${round}-${randomUUID()}`;

      const [resA, resB] = await Promise.all([
        memA.acquireObservationBufferClaim({ id: record.id, ownerToken: tokenA, leaseMs: 30_000 }),
        memB.acquireObservationBufferClaim({ id: record.id, ownerToken: tokenB, leaseMs: 30_000 }),
      ]);

      const winners = [resA, resB].filter(r => r.ok);
      expect(winners).toHaveLength(1);

      // The loser's stale release must not clear the winner's claim.
      const winnerToken = resA.ok ? tokenA : tokenB;
      const loserStore = resA.ok ? memB : memA;
      const loserToken = resA.ok ? tokenB : tokenA;
      const staleRelease = await loserStore.releaseObservationBufferClaim({ id: record.id, ownerToken: loserToken });
      expect(staleRelease).toEqual({ ok: false, reason: 'lost' });

      const stored = await memA.getObservationalMemory(null, resourceId);
      expect(stored?.observationBufferClaimToken).toBe(winnerToken);

      // Clean release by the winner so the next round starts unclaimed.
      const winnerStore = resA.ok ? memA : memB;
      const released = await winnerStore.releaseObservationBufferClaim({ id: record.id, ownerToken: winnerToken });
      expect(released.ok).toBe(true);
    }
  });
});
