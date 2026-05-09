/**
 * Harness v1 — Session class direct tests.
 *
 * Covers the bits of the Session surface that don't need the full Harness
 * round-trip — identity getters, lifecycle state transitions driven by the
 * harness's internal hooks (`_markClosed` / `_markEvicted`), and read-only
 * accessors. End-to-end lifecycle (cascade, lease release, storage flush) is
 * already covered by harness.test.ts; here we focus on the Session's own
 * invariants in isolation.
 */

import { describe, expect, it } from 'vitest';

import { Agent } from '../../agent';
import type { SessionRecord } from '../../storage/domains/harness';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';

import { Harness } from './harness';
import { Session } from './session';

function makeAgent(name = 'test-agent') {
  return new Agent({
    id: name,
    name,
    instructions: 'test',
    model: 'openai/gpt-4o-mini' as any,
  });
}

function makeHarness() {
  return new Harness({
    agents: { default: makeAgent() },
    modes: [{ id: 'default', agentId: 'default' }],
    defaultModeId: 'default',
    sessions: { storage: new InMemoryHarness({ db: new InMemoryDB() }) },
  });
}

function makeRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  const now = Date.now();
  return {
    id: 'sess-direct',
    resourceId: 'r1',
    threadId: 't1',
    origin: 'top-level',
    ownsThread: false,
    modeId: 'default',
    modelId: '',
    subagentModelOverrides: {},
    permissionRules: { categories: {}, tools: {} },
    sessionGrants: { categories: [], tools: [] },
    tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    pendingQueue: [],
    state: undefined,
    createdAt: now,
    lastActivityAt: now,
    version: 1,
    ownerId: 'owner-x',
    leaseExpiresAt: now + 30_000,
    ...overrides,
  };
}

function makeStandaloneSession(overrides?: Partial<SessionRecord>) {
  // The Session is normally constructed by the Harness. For direct tests we
  // satisfy the SessionInternals contract with a real Harness + storage so
  // any accidental call to `harness._closeSession` doesn't blow up.
  const harness = makeHarness();
  const storage = new InMemoryHarness({ db: new InMemoryDB() });
  const record = makeRecord(overrides);
  const session = new Session({
    harness,
    storage,
    ownerId: 'owner-x',
    record,
    leaseExpiresAt: record.leaseExpiresAt!,
  });
  return { session, record, harness, storage };
}

describe('Session — identity getters', () => {
  it('freezes id / resourceId / threadId / createdAt at construction', () => {
    const { session, record } = makeStandaloneSession({
      id: 'sess-frozen',
      resourceId: 'r-frozen',
      threadId: 't-frozen',
      createdAt: 12345,
    });
    expect(session.id).toBe('sess-frozen');
    expect(session.resourceId).toBe('r-frozen');
    expect(session.threadId).toBe('t-frozen');
    expect(session.createdAt).toBe(12345);
    expect(session.parentSessionId).toBeUndefined();
    // The identity getters do not change even if the underlying record
    // mutates after the fact — they're snapshotted at construction.
    record.threadId = 't-mutated';
    expect(session.threadId).toBe('t-frozen');
  });

  it('exposes parentSessionId when present on the record', () => {
    const { session } = makeStandaloneSession({ parentSessionId: 'sess-parent' });
    expect(session.parentSessionId).toBe('sess-parent');
  });

  it('lastActivityAt tracks the current record value', () => {
    const { session } = makeStandaloneSession({ lastActivityAt: 1000 });
    expect(session.lastActivityAt).toBe(1000);

    // _markClosed swaps the record reference — lastActivityAt should reflect
    // the new record, not the original snapshot.
    session._markClosed(makeRecord({ lastActivityAt: 2000, closedAt: 2000 }));
    expect(session.lastActivityAt).toBe(2000);
  });
});

describe('Session — lifecycleState transitions', () => {
  it('starts in "live"', () => {
    const { session } = makeStandaloneSession();
    expect(session.lifecycleState).toBe('live');
    expect(session.isClosed).toBe(false);
  });

  it('_markClosed transitions to "closed" and isClosed flips', () => {
    const { session } = makeStandaloneSession();
    session._markClosed(makeRecord({ closedAt: Date.now() }));
    expect(session.lifecycleState).toBe('closed');
    expect(session.isClosed).toBe(true);
  });

  it('_markEvicted transitions to "evicted" — record stays active, isClosed stays false', () => {
    const { session } = makeStandaloneSession();
    session._markEvicted(makeRecord({ closedAt: undefined }));
    expect(session.lifecycleState).toBe('evicted');
    expect(session.isClosed).toBe(false);
  });

  it('_markClosed is idempotent — second call leaves state in "closed"', () => {
    const { session } = makeStandaloneSession();
    session._markClosed(makeRecord({ closedAt: 1000 }));
    session._markClosed(makeRecord({ closedAt: 2000, lastActivityAt: 2000 }));
    expect(session.lifecycleState).toBe('closed');
    // Even idempotent re-marks pick up the latest record snapshot.
    expect(session.lastActivityAt).toBe(2000);
  });

  it('close() returns immediately when already closed (no harness call needed)', async () => {
    const { session } = makeStandaloneSession();
    session._markClosed(makeRecord({ closedAt: Date.now() }));
    // The session has no live storage row, so if close() tried to call the
    // harness it would throw on the cascade. The fast-path skips that.
    await expect(session.close()).resolves.toBeUndefined();
  });
});

describe('Session — getRecord snapshot', () => {
  it('returns the current record reference', () => {
    const { session, record } = makeStandaloneSession();
    expect(session.getRecord()).toBe(record);
  });

  it('reflects the new record after _markClosed', () => {
    const { session } = makeStandaloneSession({ version: 1 });
    const updated = makeRecord({ version: 2, closedAt: 9999 });
    session._markClosed(updated);
    expect(session.getRecord()).toBe(updated);
    expect(session.getRecord().version).toBe(2);
    expect(session.getRecord().closedAt).toBe(9999);
  });

  it('reflects the new record after _markEvicted', () => {
    const { session } = makeStandaloneSession({ version: 1 });
    const updated = makeRecord({ version: 2 });
    session._markEvicted(updated);
    expect(session.getRecord()).toBe(updated);
    expect(session.getRecord().version).toBe(2);
  });
});

describe('Session — internal accessors', () => {
  it('_internalOwnerId returns the constructor-supplied ownerId', () => {
    const { session } = makeStandaloneSession();
    expect(session._internalOwnerId).toBe('owner-x');
  });

  it('_internalRecordVersion tracks the underlying record', () => {
    const { session } = makeStandaloneSession({ version: 1 });
    expect(session._internalRecordVersion).toBe(1);
    session._markClosed(makeRecord({ version: 2, closedAt: Date.now() }));
    expect(session._internalRecordVersion).toBe(2);
  });

  it('_internalStorage returns the constructor-supplied storage handle', () => {
    const { session, storage } = makeStandaloneSession();
    expect(session._internalStorage).toBe(storage);
  });
});

describe('Session — surface area (M1)', () => {
  // The §4.2 surface is mostly unimplemented in M1. We only ship identity +
  // lifecycle on the Session class; pin that here so a future commit that
  // adds one of the stubs has to update both the class and this assertion
  // deliberately.
  it('exposes only identity / lifecycle / record getters and the close hook', () => {
    const { session } = makeStandaloneSession();
    const proto = Object.getOwnPropertyNames(Session.prototype).filter(n => n !== 'constructor');
    // Sorted for stability across edits.
    expect([...proto].sort()).toEqual(
      [
        'close',
        'message',
        'getCurrentMode',
        'getCurrentModel',
        'setMode',
        'setModel',
        'getDisplayState',
        '_assertLive',
        '_buildToolsets',
        '_flushUpdate',
        '_markClosed',
        '_markEvicted',
        // Getters land in the prototype as own names too.
        'lastActivityAt',
        'lifecycleState',
        'isClosed',
        'getRecord',
        '_internalOwnerId',
        '_internalRecordVersion',
        '_internalStorage',
      ].sort(),
    );
    // Sanity check on instance-side identity readonly fields.
    expect(typeof session.id).toBe('string');
    expect(typeof session.threadId).toBe('string');
  });
});
