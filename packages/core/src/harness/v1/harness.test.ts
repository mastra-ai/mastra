/**
 * Harness v1 — resolver + lifecycle tests.
 *
 * Covers the M1 slice: `new Harness(config)`, `harness.session(...)` for
 * every §5.3 branch, lease acquisition, close, list, shutdown.
 *
 * Storage is the real `InMemoryHarness` adapter — not a mock — so the lease
 * + CAS contract is exercised end-to-end. Agents are minimal stubs because
 * the resolver/lifecycle paths don't dispatch model calls.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { Agent } from '../../agent';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';

import {
  HarnessConfigError,
  HarnessSessionClosedError,
  HarnessSessionLockedError,
  HarnessSessionNotFoundError,
} from './errors';
import { Harness } from './harness';

function makeAgent(name = 'test-agent') {
  return new Agent({
    id: name,
    name,
    instructions: 'test',
    model: 'openai/gpt-4o-mini' as any,
  });
}

function makeStorage() {
  const db = new InMemoryDB();
  const storage = new InMemoryHarness({ db });
  return storage;
}

function makeHarness(overrides?: Partial<ConstructorParameters<typeof Harness>[0]>) {
  const storage = overrides?.sessions?.storage ?? makeStorage();
  return new Harness({
    agents: { default: makeAgent() },
    modes: [{ id: 'default', agentId: 'default' }],
    defaultModeId: 'default',
    sessions: { storage },
    ...overrides,
  });
}

describe('Harness v1 — construction', () => {
  it('accepts a valid config', () => {
    expect(() => makeHarness()).not.toThrow();
  });

  it('throws HarnessConfigError for unknown agentId on a mode', () => {
    expect(
      () =>
        new Harness({
          agents: { default: makeAgent() },
          modes: [{ id: 'default', agentId: 'missing' }],
          defaultModeId: 'default',
          sessions: { storage: makeStorage() },
        }),
    ).toThrow(HarnessConfigError);
  });

  it('throws HarnessConfigError for duplicate mode ids', () => {
    expect(
      () =>
        new Harness({
          agents: { default: makeAgent() },
          modes: [
            { id: 'default', agentId: 'default' },
            { id: 'default', agentId: 'default' },
          ],
          defaultModeId: 'default',
          sessions: { storage: makeStorage() },
        }),
    ).toThrow(HarnessConfigError);
  });

  it('throws HarnessConfigError when defaultModeId references an unknown mode', () => {
    expect(
      () =>
        new Harness({
          agents: { default: makeAgent() },
          modes: [{ id: 'default', agentId: 'default' }],
          defaultModeId: 'missing',
          sessions: { storage: makeStorage() },
        }),
    ).toThrow(HarnessConfigError);
  });

  it('throws HarnessConfigError when modes is non-empty but defaultModeId is omitted', () => {
    expect(
      () =>
        new Harness({
          agents: { default: makeAgent() },
          modes: [{ id: 'default', agentId: 'default' }],
          sessions: { storage: makeStorage() },
        }),
    ).toThrow(HarnessConfigError);
  });

  it('throws HarnessConfigError when transitionsTo references an unknown mode', () => {
    expect(
      () =>
        new Harness({
          agents: { default: makeAgent() },
          modes: [{ id: 'default', agentId: 'default', transitionsTo: 'nope' }],
          defaultModeId: 'default',
          sessions: { storage: makeStorage() },
        }),
    ).toThrow(HarnessConfigError);
  });

  it('throws HarnessConfigError when a mode declares both tools and additionalTools', () => {
    expect(
      () =>
        new Harness({
          agents: { default: makeAgent() },
          modes: [{ id: 'default', agentId: 'default', tools: {}, additionalTools: {} }],
          defaultModeId: 'default',
          sessions: { storage: makeStorage() },
        }),
    ).toThrow(HarnessConfigError);
  });

  it('mints a unique ownerId per Harness instance', () => {
    const a = makeHarness();
    const b = makeHarness();
    expect(a.ownerId).not.toBe(b.ownerId);
    expect(a.ownerId).toMatch(/^harness-/);
  });
});

describe('Harness v1 — session(...) by thread', () => {
  let storage: InMemoryHarness;
  let harness: Harness;

  beforeEach(() => {
    storage = makeStorage();
    harness = makeHarness({ sessions: { storage } });
  });

  it('creates a fresh record when no session exists for the thread', async () => {
    const session = await harness.session({ threadId: 't1', resourceId: 'r1' });
    expect(session.threadId).toBe('t1');
    expect(session.resourceId).toBe('r1');
    expect(session.id).toMatch(/^sess-/);
    expect(session.lifecycleState).toBe('live');
  });

  it('returns the same live instance on a repeat lookup', async () => {
    const a = await harness.session({ threadId: 't1', resourceId: 'r1' });
    const b = await harness.session({ threadId: 't1', resourceId: 'r1' });
    expect(b).toBe(a);
  });

  it('hydrates from storage when the session is no longer live', async () => {
    const original = await harness.session({ threadId: 't1', resourceId: 'r1' });
    const id = original.id;

    // Simulate a process restart by spinning up a new Harness against the
    // same storage. The old harness still holds the lease, so we shutdown
    // first to release it.
    await harness.shutdown();
    const harness2 = makeHarness({ sessions: { storage } });

    const rehydrated = await harness2.session({ threadId: 't1', resourceId: 'r1' });
    expect(rehydrated.id).toBe(id);
    expect(rehydrated).not.toBe(original);
  });

  it('forces a brand-new thread when threadId is { fresh: true }', async () => {
    const a = await harness.session({ threadId: { fresh: true }, resourceId: 'r1' });
    const b = await harness.session({ threadId: { fresh: true }, resourceId: 'r1' });
    expect(a.threadId).not.toBe(b.threadId);
    expect(a.id).not.toBe(b.id);
  });

  it('marks ownsThread=true when minting a fresh thread', async () => {
    const session = await harness.session({ threadId: { fresh: true }, resourceId: 'r1' });
    expect(session.getRecord().ownsThread).toBe(true);
  });

  it('marks ownsThread=false when binding to a caller-supplied thread', async () => {
    const session = await harness.session({ threadId: 't1', resourceId: 'r1' });
    expect(session.getRecord().ownsThread).toBe(false);
  });

  it('treats a foreign-resource thread as not-existing (creates fresh under caller resource)', async () => {
    await harness.session({ threadId: 't1', resourceId: 'r1' });
    const stranger = await harness.session({ threadId: 't1', resourceId: 'r2' });
    expect(stranger.resourceId).toBe('r2');
  });

  it('creates a fresh record after the previous session on that thread is closed', async () => {
    const first = await harness.session({ threadId: 't1', resourceId: 'r1' });
    await first.close();

    const second = await harness.session({ threadId: 't1', resourceId: 'r1' });
    expect(second.id).not.toBe(first.id);
    expect(second.threadId).toBe('t1');
  });
});

describe('Harness v1 — session(...) by sessionId', () => {
  let storage: InMemoryHarness;
  let harness: Harness;

  beforeEach(() => {
    storage = makeStorage();
    harness = makeHarness({ sessions: { storage } });
  });

  it('returns the live instance', async () => {
    const created = await harness.session({ threadId: 't1', resourceId: 'r1' });
    const fetched = await harness.session({ sessionId: created.id });
    expect(fetched).toBe(created);
  });

  it('throws HarnessSessionNotFoundError for an unknown sessionId', async () => {
    await expect(harness.session({ sessionId: 'nope' })).rejects.toThrow(HarnessSessionNotFoundError);
  });

  it('throws HarnessSessionClosedError after the session is closed', async () => {
    const created = await harness.session({ threadId: 't1', resourceId: 'r1' });
    await created.close();
    await expect(harness.session({ sessionId: created.id })).rejects.toThrow(HarnessSessionClosedError);
  });

  it('does not leak existence across resources (foreign resourceId surfaces as not-found)', async () => {
    const created = await harness.session({ threadId: 't1', resourceId: 'r1' });
    await expect(harness.session({ sessionId: created.id, resourceId: 'r2' })).rejects.toThrow(
      HarnessSessionNotFoundError,
    );
  });

  it('returns the live instance when resourceId matches', async () => {
    const created = await harness.session({ threadId: 't1', resourceId: 'r1' });
    const fetched = await harness.session({ sessionId: created.id, resourceId: 'r1' });
    expect(fetched).toBe(created);
  });
});

describe('Harness v1 — session(...) by resource', () => {
  it('creates fresh thread + session when nothing active exists', async () => {
    const harness = makeHarness();
    const session = await harness.session({ resourceId: 'r1' });
    expect(session.resourceId).toBe('r1');
    expect(session.threadId).toMatch(/^thread-/);
  });

  it('returns one of the live sessions for the resource', async () => {
    const harness = makeHarness();
    const first = await harness.session({ threadId: 't1', resourceId: 'r1' });
    const second = await harness.session({ threadId: 't2', resourceId: 'r1' });

    const found = await harness.session({ resourceId: 'r1' });
    expect([first.id, second.id]).toContain(found.id);
  });

  it('skips closed sessions when searching for the most-recent active', async () => {
    const harness = makeHarness();
    const first = await harness.session({ threadId: 't1', resourceId: 'r1' });
    await first.close();

    const found = await harness.session({ resourceId: 'r1' });
    expect(found.id).not.toBe(first.id);
  });
});

describe('Harness v1 — lifecycle', () => {
  it('drops sessions from the live map on close', async () => {
    const harness = makeHarness();
    const s = await harness.session({ threadId: 't1', resourceId: 'r1' });
    expect(harness._internalLiveSessionCount()).toBe(1);
    await s.close();
    expect(harness._internalLiveSessionCount()).toBe(0);
    expect(s.isClosed).toBe(true);
  });

  it('close is idempotent', async () => {
    const harness = makeHarness();
    const s = await harness.session({ threadId: 't1', resourceId: 'r1' });
    await s.close();
    await expect(s.close()).resolves.toBeUndefined();
  });

  it('closeSession by id without holding a live instance still cascades', async () => {
    const storage = makeStorage();
    const harness = makeHarness({ sessions: { storage } });
    const s = await harness.session({ threadId: 't1', resourceId: 'r1' });
    const id = s.id;

    // Drop instance from live map without closing — simulates restart
    await harness.shutdown();

    const harness2 = makeHarness({ sessions: { storage } });
    await harness2.closeSession({ sessionId: id });

    const stored = await harness2.loadSession({ sessionId: id, includeClosed: true });
    expect(stored?.closedAt).toBeDefined();
  });

  it('cascades close to direct child sessions', async () => {
    const storage = makeStorage();
    const harness = makeHarness({ sessions: { storage } });

    const parent = await harness.session({ threadId: 't1', resourceId: 'r1' });
    const child = await harness.session({
      threadId: { fresh: true },
      resourceId: 'r1',
      parentSessionId: parent.id,
    });

    await parent.close();

    expect(child.isClosed || harness._internalLiveSessionCount() === 0).toBe(true);

    const stored = await harness.loadSession({ sessionId: child.id, includeClosed: true });
    expect(stored?.closedAt).toBeDefined();
  });

  it('listSessions hides closed records by default and surfaces them with includeClosed', async () => {
    const harness = makeHarness();
    const s1 = await harness.session({ threadId: 't1', resourceId: 'r1' });
    const s2 = await harness.session({ threadId: 't2', resourceId: 'r1' });
    await s1.close();

    const active = await harness.listSessions({ resourceId: 'r1' });
    expect(active.map(r => r.id)).toEqual([s2.id]);

    const all = await harness.listSessions({ resourceId: 'r1', includeClosed: true });
    expect(all.map(r => r.id).sort()).toEqual([s1.id, s2.id].sort());
  });
});

describe('Harness v1 — lease + write concurrency', () => {
  it('rejects a second harness trying to acquire a session held by the first', async () => {
    const storage = makeStorage();
    const a = makeHarness({ sessions: { storage } });
    const b = makeHarness({ sessions: { storage } });

    const session = await a.session({ threadId: 't1', resourceId: 'r1' });

    await expect(b.session({ sessionId: session.id })).rejects.toThrow(HarnessSessionLockedError);
  });

  it('lets a second harness take over after the first releases via shutdown', async () => {
    const storage = makeStorage();
    const a = makeHarness({ sessions: { storage } });
    const b = makeHarness({ sessions: { storage } });

    const session = await a.session({ threadId: 't1', resourceId: 'r1' });
    const id = session.id;
    await a.shutdown();

    const taken = await b.session({ sessionId: id });
    expect(taken.id).toBe(id);
  });

  it('shutdown is idempotent', async () => {
    const harness = makeHarness();
    await harness.session({ threadId: 't1', resourceId: 'r1' });
    await harness.shutdown();
    await expect(harness.shutdown()).resolves.toBeUndefined();
  });

  it('rejects new session() calls after shutdown', async () => {
    const harness = makeHarness();
    await harness.shutdown();
    await expect(harness.session({ threadId: 't1', resourceId: 'r1' })).rejects.toThrow();
  });
});

describe('Harness v1 — config validation surfaces in resolver', () => {
  it('throws when storage is missing and a session is requested', async () => {
    const harness = new Harness({
      agents: { default: makeAgent() },
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
    });
    await expect(harness.session({ threadId: 't1', resourceId: 'r1' })).rejects.toThrow(HarnessConfigError);
  });
});
