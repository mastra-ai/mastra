/**
 * Tests for `Session.extendLease(...)` and the heartbeat coordination that
 * keeps a periodic renewal from shrinking an active extension.
 *
 * The Harness runs a heartbeat at TTL/3 (min 1s) that renews each live
 * session's storage lease. A long-running tool that exceeds the default TTL
 * — or that blocks the event loop so the heartbeat misses its deadline —
 * can otherwise lose the lease to another process via takeover. `extendLease`
 * lets tools push the storage expiry forward ahead of the blocking work;
 * `_getEffectiveLeaseTtlMs` ensures the heartbeat respects the extension.
 */

import { describe, expect, it } from 'vitest';

import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';

import { setupHarness } from './__test-utils__/setup';
import { HarnessSessionLockedError, HarnessValidationError } from './errors';
import type { Session } from './session';

// ---------------------------------------------------------------------------
// Internal accessor — bypasses the public slot so tests can poke
// `_leaseExtensionDeadline`, the chain helper, and the effective-TTL
// computation directly. Mirrors the pattern in token-usage.test.ts.
// ---------------------------------------------------------------------------

interface SessionLeaseInternals {
  _leaseExtensionDeadline?: number;
  _getEffectiveLeaseTtlMs(defaultTtlMs: number): number;
  _enqueueLeaseRenewal(run: () => Promise<void>): Promise<void>;
}

function asInternals(session: Session): SessionLeaseInternals {
  return session as unknown as SessionLeaseInternals;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('Session.extendLease — argument validation', () => {
  it('rejects non-finite ttlMs', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await expect(session.extendLease({ ttlMs: Number.NaN })).rejects.toBeInstanceOf(HarnessValidationError);
    await expect(session.extendLease({ ttlMs: Number.POSITIVE_INFINITY })).rejects.toBeInstanceOf(
      HarnessValidationError,
    );
  });

  it('rejects non-positive ttlMs', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await expect(session.extendLease({ ttlMs: 0 })).rejects.toBeInstanceOf(HarnessValidationError);
    await expect(session.extendLease({ ttlMs: -10 })).rejects.toBeInstanceOf(HarnessValidationError);
  });

  it('rejects non-integer ttlMs', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await expect(session.extendLease({ ttlMs: 1.5 })).rejects.toBeInstanceOf(HarnessValidationError);
  });

  it('rejects values above the 24h safety cap', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const overCap = 25 * 60 * 60 * 1_000;
    await expect(session.extendLease({ ttlMs: overCap })).rejects.toBeInstanceOf(HarnessValidationError);
  });
});

// ---------------------------------------------------------------------------
// extendLease behavior
// ---------------------------------------------------------------------------

describe('Session.extendLease — storage + in-memory state', () => {
  it('bumps SessionRecord.leaseExpiresAt in storage', async () => {
    const { harness, storage } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const before = (await storage.loadSession({ sessionId: session.id }))!.leaseExpiresAt!;
    await session.extendLease({ ttlMs: 5 * 60_000 });
    const after = (await storage.loadSession({ sessionId: session.id }))!.leaseExpiresAt!;
    expect(after).toBeGreaterThan(before);
  });

  it('records the new deadline so the heartbeat respects it', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const internals = asInternals(session);
    await session.extendLease({ ttlMs: 5 * 60_000 });
    expect(internals._leaseExtensionDeadline).toBeTypeOf('number');
    expect(internals._leaseExtensionDeadline!).toBeGreaterThan(Date.now());
  });

  it('clamps ttlMs upward so it cannot shrink an existing lease', async () => {
    // Default harness lease TTL is 30_000ms. Passing 1_000 must clamp to
    // 30_000 — `_getEffectiveLeaseTtlMs` returns the default, not 1s.
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const internals = asInternals(session);
    await session.extendLease({ ttlMs: 1_000 });
    // After the clamp, effective TTL must be at least the default (30s).
    expect(internals._getEffectiveLeaseTtlMs(30_000)).toBeGreaterThanOrEqual(30_000);
  });

  it('a second extendLease with a shorter ttl does not shrink an active longer extension', async () => {
    // Regression: an earlier draft computed the renewal TTL from
    // max(requested, default) only, so a follow-up extendLease(shorter) call
    // could overwrite the stored leaseExpiresAt with the smaller value and
    // let another harness take over earlier than the original extension
    // promised. The clamp must also include the remaining extension window.
    const { harness, storage } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.extendLease({ ttlMs: 10 * 60_000 });
    const afterLong = (await storage.loadSession({ sessionId: session.id }))!.leaseExpiresAt!;
    await session.extendLease({ ttlMs: 60_000 });
    const afterShort = (await storage.loadSession({ sessionId: session.id }))!.leaseExpiresAt!;
    // Allow a small drift for clock movement during chained renewals.
    expect(afterShort).toBeGreaterThanOrEqual(afterLong - 2_000);
  });

  it('withExtendedLease invokes the wrapped function and returns its result', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    let extended = false;
    const result = await session.withExtendedLease(
      async () => {
        extended = true;
        return 42;
      },
      { ttlMs: 60_000 },
    );
    expect(extended).toBe(true);
    expect(result).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// Effective TTL semantics
// ---------------------------------------------------------------------------

describe('Session._getEffectiveLeaseTtlMs', () => {
  it('returns the default when no extension is active', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    expect(asInternals(session)._getEffectiveLeaseTtlMs(30_000)).toBe(30_000);
  });

  it('returns the remaining extension window when longer than default', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.extendLease({ ttlMs: 5 * 60_000 });
    // Remaining should be near 5 minutes, well above the 30s default.
    expect(asInternals(session)._getEffectiveLeaseTtlMs(30_000)).toBeGreaterThan(30_000);
  });

  it('falls back to default once the extension deadline has passed', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const internals = asInternals(session);
    // Stamp an already-expired deadline directly to avoid waiting in real time.
    internals._leaseExtensionDeadline = Date.now() - 1;
    expect(internals._getEffectiveLeaseTtlMs(30_000)).toBe(30_000);
  });

  it('treats a non-finite deadline as no extension', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const internals = asInternals(session);
    internals._leaseExtensionDeadline = Number.NaN;
    expect(internals._getEffectiveLeaseTtlMs(30_000)).toBe(30_000);
  });
});

// ---------------------------------------------------------------------------
// Heartbeat coordination — concurrent extend + renew
// ---------------------------------------------------------------------------

describe('Lease renewal — heartbeat preserves extensions', () => {
  it('a serialized heartbeat after extendLease does not shrink the lease', async () => {
    const { harness, storage } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.extendLease({ ttlMs: 5 * 60_000 });
    const extendedAt = (await storage.loadSession({ sessionId: session.id }))!.leaseExpiresAt!;
    // Simulate the harness heartbeat per-session arm.
    await asInternals(session)._enqueueLeaseRenewal(async () => {
      const effectiveTtl = asInternals(session)._getEffectiveLeaseTtlMs(30_000);
      const lease = await storage.renewSessionLease({
        harnessName: session.getRecord().harnessName,
        sessionId: session.id,
        ownerId: session.getRecord().ownerId!,
        ttlMs: effectiveTtl,
      });
      (session as unknown as { _markLeaseRenewed(ms: number): void })._markLeaseRenewed(lease.expiresAt);
    });
    const afterHeartbeat = (await storage.loadSession({ sessionId: session.id }))!.leaseExpiresAt!;
    // Allow tiny scheduling drift; the heartbeat must NOT collapse the
    // lease back to ~30s (the extendedAt - now is on the order of minutes).
    expect(afterHeartbeat).toBeGreaterThan(extendedAt - 2_000);
  });
});

// ---------------------------------------------------------------------------
// Terminal-state guard — queued renewals must not fire after close/evict/delete
// ---------------------------------------------------------------------------

describe('Lease renewal — terminal-state guard', () => {
  it('a renewal enqueued after the session is marked closed is a no-op', async () => {
    // Regression: an earlier draft allowed any pre-queued runner on
    // `_leaseRenewalChain` to call `storage.renewSessionLease` after
    // `_markClosed` ran, which could re-extend a lease for a terminalized
    // session. The guard inside `_enqueueLeaseRenewal` must short-circuit
    // when the session is no longer live/closing.
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.close();
    let renewerCalled = false;
    await asInternals(session)._enqueueLeaseRenewal(async () => {
      renewerCalled = true;
    });
    expect(renewerCalled).toBe(false);
  });

  it('a renewal enqueued after the session has been evicted is a no-op', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await harness.shutdown();
    let renewerCalled = false;
    await asInternals(session)._enqueueLeaseRenewal(async () => {
      renewerCalled = true;
    });
    expect(renewerCalled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Two-Harness takeover race
// ---------------------------------------------------------------------------

describe('Lease takeover — extended lease blocks a second Harness', () => {
  it('a second Harness cannot take over a session whose lease was extended', async () => {
    const sharedHarnessStorage = new InMemoryHarness({ db: new InMemoryDB() });
    const { harness } = setupHarness({ sessions: { storage: sharedHarnessStorage } });
    const session = await harness.session({ threadId: 't-lease', resourceId: 'u' });
    await session.extendLease({ ttlMs: 5 * 60_000 });
    // A second Harness instance with a different ownerId tries to resolve
    // the same session. The extended lease is still active, so takeover
    // must fail with HarnessSessionLockedError.
    const { harness: harness2 } = setupHarness({ sessions: { storage: sharedHarnessStorage } });
    await expect(harness2.session({ sessionId: session.id })).rejects.toBeInstanceOf(HarnessSessionLockedError);
  });
});
