/**
 * Lease renewal and extension coverage for Harness v1 sessions.
 *
 * The Harness owns a periodic heartbeat for normal live sessions. `extendLease`
 * is the explicit tool/runtime escape hatch for work that may exceed the
 * default lease TTL or block the event loop long enough to miss a heartbeat.
 */

import { describe, expect, it, vi } from 'vitest';

import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';

import { setupHarness } from './__test-utils__/setup';
import { HarnessSessionClosedError, HarnessSessionLockedError, HarnessValidationError } from './errors';
import type { Session } from './session';

interface SessionLeaseInternals {
  _leaseExtensionDeadline?: number;
  _beginClosing(): void;
  _getEffectiveLeaseTtlMs(defaultTtlMs: number): number;
  _enqueueLeaseRenewal(run: () => Promise<void>): Promise<void>;
}

function asInternals(session: Session): SessionLeaseInternals {
  return session as unknown as SessionLeaseInternals;
}

describe('Session.extendLease', () => {
  it('rejects invalid ttl values', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    await expect(session.extendLease({ ttlMs: Number.NaN })).rejects.toBeInstanceOf(HarnessValidationError);
    await expect(session.extendLease({ ttlMs: Number.POSITIVE_INFINITY })).rejects.toBeInstanceOf(
      HarnessValidationError,
    );
    await expect(session.extendLease({ ttlMs: 0 })).rejects.toBeInstanceOf(HarnessValidationError);
    await expect(session.extendLease({ ttlMs: -10 })).rejects.toBeInstanceOf(HarnessValidationError);
    await expect(session.extendLease({ ttlMs: 1.5 })).rejects.toBeInstanceOf(HarnessValidationError);
    await expect(session.extendLease({ ttlMs: 25 * 60 * 60 * 1_000 })).rejects.toBeInstanceOf(HarnessValidationError);
  });

  it('renews storage and records a deadline that heartbeat renewal respects', async () => {
    const { harness, storage } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    const before = (await storage.loadSession({ sessionId: session.id }))!.leaseExpiresAt!;
    await session.extendLease({ ttlMs: 5 * 60_000 });
    const afterExtend = (await storage.loadSession({ sessionId: session.id }))!.leaseExpiresAt!;

    expect(afterExtend).toBeGreaterThan(before);
    expect(asInternals(session)._leaseExtensionDeadline).toBe(afterExtend);
    expect(asInternals(session)._getEffectiveLeaseTtlMs(30_000)).toBeGreaterThan(30_000);
  });

  it('does not shrink an active longer extension with a shorter follow-up', async () => {
    const { harness, storage } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    await session.extendLease({ ttlMs: 10 * 60_000 });
    const afterLong = (await storage.loadSession({ sessionId: session.id }))!.leaseExpiresAt!;
    await session.extendLease({ ttlMs: 60_000 });
    const afterShort = (await storage.loadSession({ sessionId: session.id }))!.leaseExpiresAt!;

    expect(afterShort).toBeGreaterThanOrEqual(afterLong - 2_000);
  });

  it('withExtendedLease invokes the wrapped function and returns its result', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    await expect(session.withExtendedLease(async () => 42, { ttlMs: 60_000 })).resolves.toBe(42);
  });

  it('throws if an explicit extension is queued after close', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    await session.close();

    await expect(session.extendLease({ ttlMs: 60_000 })).rejects.toBeInstanceOf(HarnessSessionClosedError);
  });

  it('allows explicit extension while a closing session drains admitted work', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    asInternals(session)._beginClosing();

    await expect(session.extendLease({ ttlMs: 60_000 })).resolves.toBeUndefined();
  });

  it('evicts the local session if explicit extension observes lease loss', async () => {
    const { harness, storage } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await storage.releaseSessionLease({ sessionId: session.id, harnessName: 'default', ownerId: harness.ownerId });
    await storage.acquireSessionLease({
      sessionId: session.id,
      harnessName: 'default',
      ownerId: 'other-process',
      ttlMs: 30_000,
    });
    const events: string[] = [];
    const unsubscribe = session.subscribe(event => events.push(event.type));

    await expect(session.extendLease({ ttlMs: 60_000 })).rejects.toBeInstanceOf(HarnessSessionLockedError);

    unsubscribe();
    expect(events).toContain('session_evicted');
    expect(harness._internalLiveSessionCount()).toBe(0);
    expect(session.lifecycleState).toBe('evicted');
  });

  it('blocks stale writes after the local lease has expired', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(2_000_000);
    try {
      const { harness } = setupHarness();
      const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
      vi.setSystemTime(2_031_000);

      await expect(session.setState({ stale: true })).rejects.toBeInstanceOf(HarnessSessionLockedError);
      expect(session.lifecycleState).toBe('evicted');
      expect(harness._internalLiveSessionCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Lease heartbeat coordination', () => {
  it('renews live session leases before the TTL expires and stops after shutdown', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    try {
      const { harness, storage } = setupHarness();
      const renew = vi.spyOn(storage, 'renewSessionLease');
      const session = await harness.session({ threadId: 't1', resourceId: 'r1' });

      await vi.advanceTimersByTimeAsync(10_000);

      expect(renew).toHaveBeenCalledWith({
        harnessName: 'default',
        sessionId: session.id,
        ownerId: harness.ownerId,
        ttlMs: 30_000,
      });
      expect(session.getRecord().leaseExpiresAt).toBe(1_040_000);

      const renewCount = renew.mock.calls.length;
      await harness.shutdown();
      await vi.advanceTimersByTimeAsync(30_000);
      expect(renew).toHaveBeenCalledTimes(renewCount);
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses the extended TTL when the heartbeat renews during an active extension', async () => {
    const { harness, storage } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.extendLease({ ttlMs: 5 * 60_000 });
    const extendedAt = (await storage.loadSession({ sessionId: session.id }))!.leaseExpiresAt!;

    await asInternals(session)._enqueueLeaseRenewal(async () => {
      const effectiveTtl = asInternals(session)._getEffectiveLeaseTtlMs(30_000);
      const lease = await storage.renewSessionLease({
        harnessName: session.getRecord().harnessName,
        sessionId: session.id,
        ownerId: session.getRecord().ownerId!,
        ttlMs: effectiveTtl,
      });
      session._markLeaseRenewed(lease.expiresAt);
    });

    const afterHeartbeat = (await storage.loadSession({ sessionId: session.id }))!.leaseExpiresAt!;
    expect(afterHeartbeat).toBeGreaterThanOrEqual(extendedAt - 2_000);
  });

  it('keeps cancelled live sessions renewed until they close', async () => {
    const { harness, session, storage } = await (async () => {
      const setup = setupHarness();
      const session = await setup.harness.session({ resourceId: 'u', threadId: { fresh: true } });
      return { ...setup, session };
    })();
    await session.cancel({ reason: 'no-renew' });
    const renew = vi.spyOn(storage, 'renewSessionLease');

    await (harness as unknown as { _renewLiveSessionLeases(): Promise<void> })._renewLiveSessionLeases();

    expect(renew).toHaveBeenCalledWith({
      harnessName: 'default',
      sessionId: session.id,
      ownerId: harness.ownerId,
      ttlMs: 30_000,
    });
  });

  it('restarts the heartbeat when shutdown fails and restores live sessions', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(3_000_000);
    try {
      const { harness, storage } = setupHarness();
      const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
      const append = vi.spyOn(storage, 'appendSessionEvent').mockRejectedValueOnce(new Error('append failed'));

      await expect(harness.shutdown()).rejects.toMatchObject({
        name: 'HarnessStorageError',
        cause: expect.objectContaining({ message: 'append failed' }),
      });
      append.mockRestore();
      expect(session.lifecycleState).toBe('live');

      const renew = vi.spyOn(storage, 'renewSessionLease');
      await vi.advanceTimersByTimeAsync(10_000);

      expect(renew).toHaveBeenCalledWith({
        harnessName: 'default',
        sessionId: session.id,
        ownerId: harness.ownerId,
        ttlMs: 30_000,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('evicts a live session fail-closed when renewal observes lease loss', async () => {
    const { harness, session, storage } = await (async () => {
      const setup = setupHarness();
      const session = await setup.harness.session({ resourceId: 'u', threadId: { fresh: true } });
      return { ...setup, session };
    })();
    const stored = (await storage.loadSession({ sessionId: session.id, harnessName: 'default' }))!;
    await storage.releaseSessionLease({ sessionId: session.id, harnessName: 'default', ownerId: harness.ownerId });
    await storage.acquireSessionLease({
      sessionId: session.id,
      harnessName: 'default',
      ownerId: 'other-process',
      ttlMs: 30_000,
    });
    const events: string[] = [];
    const unsubscribe = session.subscribe(event => events.push(event.type));

    await (harness as unknown as { _renewLiveSessionLeases(): Promise<void> })._renewLiveSessionLeases();

    unsubscribe();
    expect(events).toContain('session_evicted');
    expect(harness._internalLiveSessionCount()).toBe(0);
    expect(session.lifecycleState).toBe('evicted');
    await expect(storage.loadSession({ sessionId: stored.id, harnessName: 'default' })).resolves.toMatchObject({
      ownerId: 'other-process',
    });
  });
});

describe('Lease takeover contention', () => {
  it('blocks a second Harness while an extended lease is active', async () => {
    const sharedStorage = new InMemoryHarness({ db: new InMemoryDB() });
    const { harness } = setupHarness({ sessions: { storage: sharedStorage } });
    const session = await harness.session({ threadId: 't-lease', resourceId: 'u' });

    await session.extendLease({ ttlMs: 5 * 60_000 });

    const { harness: otherHarness } = setupHarness({ sessions: { storage: sharedStorage } });
    await expect(otherHarness.session({ sessionId: session.id })).rejects.toBeInstanceOf(HarnessSessionLockedError);
  });

  it('lets a fresh Harness take over once the prior owner lease has expired', async () => {
    const db = new InMemoryDB();
    const storage = new InMemoryHarness({ db });
    const { harness } = setupHarness({ sessions: { storage } });
    const session = await harness.session({ threadId: 't-expired', resourceId: 'u' });
    const stored = db.harnessSessions.get(`default\u0000${session.id}`);
    if (!stored) throw new Error('expected stored session');
    db.harnessSessions.set(`default\u0000${session.id}`, { ...stored, leaseExpiresAt: Date.now() - 60_000 });

    const { harness: otherHarness } = setupHarness({ sessions: { storage } });
    const taken = await otherHarness.session({ sessionId: session.id });

    expect(taken.id).toBe(session.id);
    expect(taken._internalOwnerId).toBe(otherHarness.ownerId);
  });
});
