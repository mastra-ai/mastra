import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach } from 'vitest';

import { InMemoryDB } from '../inmemory-db';
import { InMemoryMemory } from './inmemory';

const LEASE_MS = 10_000;

function makeChunk() {
  return {
    cycleId: `cycle-${randomUUID()}`,
    observations: '* observed something',
    tokenCount: 10,
    messageIds: [`msg-${randomUUID()}`],
    messageTokens: 20,
    lastObservedAt: new Date(),
  };
}

describe('Observation Buffer Claim (in-memory reference adapter)', () => {
  let storage: InMemoryMemory;
  let recordId: string;
  let now: Date;

  const clock = () => now;

  async function init(overrides: { isBufferingObservation?: boolean } = {}) {
    const record = await storage.initializeObservationalMemory({
      threadId: null,
      resourceId: `resource-${randomUUID()}`,
      scope: 'resource',
      config: { observationThreshold: 5000, reflectionThreshold: 40000 },
    });
    recordId = record.id;
    if (overrides.isBufferingObservation) {
      await storage.setBufferingObservationFlag(recordId, true, 1234);
    }
    return record;
  }

  async function getRecord() {
    // The in-memory store returns live references, which is fine for assertions.
    return (storage as any).findObservationalMemoryRecordById(recordId);
  }

  beforeEach(async () => {
    now = new Date('2026-08-24T00:00:00.000Z');
    storage = new InMemoryMemory({ db: new InMemoryDB() });
    storage.observationBufferClaimClock = clock;
  });

  describe('acquire', () => {
    it('first claim succeeds and persists owner, expiry, boolean, and token boundary', async () => {
      await init();
      const res = await storage.acquireObservationBufferClaim({
        id: recordId,
        ownerToken: 'owner-a',
        leaseMs: LEASE_MS,
        lastBufferedAtTokens: 5000,
      });
      expect(res).toEqual({
        ok: true,
        claim: {
          ownerToken: 'owner-a',
          acquiredAt: now,
          renewedAt: now,
          expiresAt: new Date(now.getTime() + LEASE_MS),
        },
      });
      const record = await getRecord();
      expect(record.observationBufferClaimToken).toBe('owner-a');
      expect(record.observationBufferClaimExpiresAt).toEqual(new Date(now.getTime() + LEASE_MS));
      expect(record.isBufferingObservation).toBe(true);
      expect(record.lastBufferedAtTokens).toBe(5000);
    });

    it('second claimant loses while the first claim is live', async () => {
      await init();
      await storage.acquireObservationBufferClaim({ id: recordId, ownerToken: 'owner-a', leaseMs: LEASE_MS });
      now = new Date(now.getTime() + LEASE_MS - 1); // still live
      const res = await storage.acquireObservationBufferClaim({
        id: recordId,
        ownerToken: 'owner-b',
        leaseMs: LEASE_MS,
      });
      expect(res).toEqual({ ok: false, reason: 'lost' });
      const record = await getRecord();
      expect(record.observationBufferClaimToken).toBe('owner-a');
    });

    it('expired claim can be atomically replaced, exactly at the boundary (expiresAt == now)', async () => {
      await init();
      await storage.acquireObservationBufferClaim({ id: recordId, ownerToken: 'owner-a', leaseMs: LEASE_MS });
      now = new Date(now.getTime() + LEASE_MS); // expiresAt == now → expired
      const res = await storage.acquireObservationBufferClaim({
        id: recordId,
        ownerToken: 'owner-b',
        leaseMs: LEASE_MS,
      });
      expect(res.ok).toBe(true);
      const record = await getRecord();
      expect(record.observationBufferClaimToken).toBe('owner-b');
    });

    it('throws the established not-found error for a missing record', async () => {
      await expect(
        storage.acquireObservationBufferClaim({ id: 'nope', ownerToken: 'x', leaseMs: LEASE_MS }),
      ).rejects.toThrow(/not found/);
    });
  });

  describe('legacy marker compatibility', () => {
    it('legacy true/null-owner rows are respected during the bounded grace window', async () => {
      await init({ isBufferingObservation: true });
      const record = await getRecord();
      now = new Date(record.updatedAt.getTime() + LEASE_MS - 1); // inside grace
      const res = await storage.acquireObservationBufferClaim({
        id: recordId,
        ownerToken: 'owner-b',
        leaseMs: LEASE_MS,
      });
      expect(res).toEqual({ ok: false, reason: 'lost' });
      expect((await getRecord()).isBufferingObservation).toBe(true);
    });

    it('legacy true rows become atomically claimable at the exact grace boundary', async () => {
      await init({ isBufferingObservation: true });
      const record = await getRecord();
      now = new Date(record.updatedAt.getTime() + LEASE_MS); // boundary → claimable
      const res = await storage.acquireObservationBufferClaim({
        id: recordId,
        ownerToken: 'owner-b',
        leaseMs: LEASE_MS,
      });
      expect(res.ok).toBe(true);
      expect((await getRecord()).observationBufferClaimToken).toBe('owner-b');
    });

    it('legacy false rows are immediately unclaimed', async () => {
      await init();
      const res = await storage.acquireObservationBufferClaim({
        id: recordId,
        ownerToken: 'owner-b',
        leaseMs: LEASE_MS,
      });
      expect(res.ok).toBe(true);
    });
  });

  describe('renew', () => {
    it('matching unexpired owner renews with a strictly advancing expiry', async () => {
      await init();
      await storage.acquireObservationBufferClaim({ id: recordId, ownerToken: 'owner-a', leaseMs: LEASE_MS });
      const firstExpiry = (await getRecord()).observationBufferClaimExpiresAt.getTime();
      now = new Date(now.getTime() + 3000);
      const res = await storage.renewObservationBufferClaim({ id: recordId, ownerToken: 'owner-a', leaseMs: LEASE_MS });
      expect(res.ok).toBe(true);
      const newExpiry = (await getRecord()).observationBufferClaimExpiresAt.getTime();
      expect(newExpiry).toBeGreaterThan(firstExpiry);
    });

    it('foreign owner cannot renew', async () => {
      await init();
      await storage.acquireObservationBufferClaim({ id: recordId, ownerToken: 'owner-a', leaseMs: LEASE_MS });
      const res = await storage.renewObservationBufferClaim({ id: recordId, ownerToken: 'owner-b', leaseMs: LEASE_MS });
      expect(res).toEqual({ ok: false, reason: 'lost' });
    });

    it('an expired owner cannot renew, even before takeover', async () => {
      await init();
      await storage.acquireObservationBufferClaim({ id: recordId, ownerToken: 'owner-a', leaseMs: LEASE_MS });
      now = new Date(now.getTime() + LEASE_MS); // boundary is expired
      const res = await storage.renewObservationBufferClaim({ id: recordId, ownerToken: 'owner-a', leaseMs: LEASE_MS });
      expect(res).toEqual({ ok: false, reason: 'lost' });
      // The persisted token is still owner-a: expiry alone does not clear state.
      expect((await getRecord()).observationBufferClaimToken).toBe('owner-a');
    });
  });

  describe('release', () => {
    it('matching owner releases; claim fields and legacy boolean are cleared', async () => {
      await init();
      await storage.acquireObservationBufferClaim({ id: recordId, ownerToken: 'owner-a', leaseMs: LEASE_MS });
      const res = await storage.releaseObservationBufferClaim({ id: recordId, ownerToken: 'owner-a' });
      expect(res.ok).toBe(true);
      const record = await getRecord();
      expect(record.observationBufferClaimToken).toBeNull();
      expect(record.observationBufferClaimExpiresAt).toBeNull();
      expect(record.isBufferingObservation).toBe(false);
    });

    it('foreign owner cannot release', async () => {
      await init();
      await storage.acquireObservationBufferClaim({ id: recordId, ownerToken: 'owner-a', leaseMs: LEASE_MS });
      const res = await storage.releaseObservationBufferClaim({ id: recordId, ownerToken: 'owner-b' });
      expect(res).toEqual({ ok: false, reason: 'lost' });
      expect((await getRecord()).observationBufferClaimToken).toBe('owner-a');
    });

    it('release after expiry returns lost and mutates nothing', async () => {
      await init();
      await storage.acquireObservationBufferClaim({ id: recordId, ownerToken: 'owner-a', leaseMs: LEASE_MS });
      now = new Date(now.getTime() + LEASE_MS);
      const res = await storage.releaseObservationBufferClaim({ id: recordId, ownerToken: 'owner-a' });
      expect(res).toEqual({ ok: false, reason: 'lost' });
      expect((await getRecord()).observationBufferClaimToken).toBe('owner-a');
    });
  });

  describe('owner-conditioned commit', () => {
    it('live owner commits chunk append and boundary update', async () => {
      await init();
      await storage.acquireObservationBufferClaim({ id: recordId, ownerToken: 'owner-a', leaseMs: LEASE_MS });
      const lastBufferedAtTime = new Date(now.getTime() + 1);
      const res = await storage.commitBufferedObservations({
        id: recordId,
        ownerToken: 'owner-a',
        chunk: makeChunk(),
        lastBufferedAtTime,
      });
      expect(res).toEqual({ committed: true });
      const record = await getRecord();
      expect(record.bufferedObservationChunks).toHaveLength(1);
      expect(record.lastBufferedAtTime).toEqual(lastBufferedAtTime);
    });

    it('an expired owner cannot commit, even before takeover', async () => {
      await init();
      await storage.acquireObservationBufferClaim({ id: recordId, ownerToken: 'owner-a', leaseMs: LEASE_MS });
      now = new Date(now.getTime() + LEASE_MS);
      const res = await storage.commitBufferedObservations({
        id: recordId,
        ownerToken: 'owner-a',
        chunk: makeChunk(),
      });
      expect(res).toEqual({ committed: false, reason: 'lost' });
      expect((await getRecord()).bufferedObservationChunks ?? []).toHaveLength(0);
    });

    it('stale owner cannot persist buffered output after takeover; successor state is intact', async () => {
      await init();
      await storage.acquireObservationBufferClaim({ id: recordId, ownerToken: 'owner-a', leaseMs: LEASE_MS });
      now = new Date(now.getTime() + LEASE_MS + 1);
      await storage.acquireObservationBufferClaim({ id: recordId, ownerToken: 'owner-b', leaseMs: LEASE_MS });
      const successorCommit = await storage.commitBufferedObservations({
        id: recordId,
        ownerToken: 'owner-b',
        chunk: makeChunk(),
      });
      expect(successorCommit).toEqual({ committed: true });

      const lateCommit = await storage.commitBufferedObservations({
        id: recordId,
        ownerToken: 'owner-a',
        chunk: makeChunk(),
      });
      expect(lateCommit).toEqual({ committed: false, reason: 'lost' });

      const lateRelease = await storage.releaseObservationBufferClaim({ id: recordId, ownerToken: 'owner-a' });
      expect(lateRelease).toEqual({ ok: false, reason: 'lost' });

      const record = await getRecord();
      expect(record.observationBufferClaimToken).toBe('owner-b');
      expect(record.bufferedObservationChunks).toHaveLength(1);
      expect(record.isBufferingObservation).toBe(true);
    });
  });

  describe('status liveness', () => {
    it('reports live only for an unexpired owned claim, using the same backend clock', async () => {
      await init();
      expect(await storage.getObservationBufferClaimStatus(recordId)).toEqual({ live: false });

      await storage.acquireObservationBufferClaim({ id: recordId, ownerToken: 'owner-a', leaseMs: LEASE_MS });
      expect(await storage.getObservationBufferClaimStatus(recordId)).toEqual({ live: true });

      now = new Date(now.getTime() + LEASE_MS); // exact boundary is expired
      expect(await storage.getObservationBufferClaimStatus(recordId)).toEqual({ live: false });
    });

    it('a legacy boolean without an owner token is not live', async () => {
      await init({ isBufferingObservation: true });
      expect(await storage.getObservationBufferClaimStatus(recordId)).toEqual({ live: false });
    });
  });
});
