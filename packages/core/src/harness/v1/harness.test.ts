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
import { z } from 'zod';

import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import {
  HarnessStorage,
  HarnessStorageDeleteGuardConflictError,
  HarnessStorageVersionConflictError,
} from '../../storage/domains/harness';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { InMemoryStore } from '../../storage/mock';

import { extractSignalContents, MockAgent } from './__test-utils__';
import type { HarnessSessionDeleteBlockedError } from './errors';
import {
  HarnessConfigError,
  HarnessSessionClosedError,
  HarnessSessionClosingError,
  HarnessSessionDeletedError,
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

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(res => {
    resolve = res;
  });
  return { promise, resolve };
}

async function waitFor(predicate: () => boolean, label: string, timeoutMs = 500): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error(`timed out waiting for ${label}`);
    }
    await new Promise(resolve => setImmediate(resolve));
  }
}

class AbortIgnoringMockAgent extends MockAgent {
  override async stream(messages: any, options?: any): Promise<any> {
    return super.stream(messages, { ...options, abortSignal: undefined });
  }
}

class BlockingGenerateMockAgent extends MockAgent {
  override async generate(messages: any, options?: any): Promise<any> {
    this.streamCalls.push({ type: 'generate', messages, options });
    return new Promise(() => {});
  }
}

function makeHarness(overrides?: Partial<ConstructorParameters<typeof Harness>[0]>) {
  const { sessions: overrideSessions, ...restOverrides } = overrides ?? {};
  const storage = overrideSessions?.storage ?? makeStorage();
  const compositeStorage = new InMemoryStore();
  compositeStorage.stores.harness = storage;
  const { storage: _sessionStorage, ...sessionOverrides } = overrideSessions ?? {};
  return new Harness({
    agents: { default: makeAgent() },
    storage: compositeStorage,
    modes: [{ id: 'default', agentId: 'default' }],
    defaultModeId: 'default',
    ...(Object.keys(sessionOverrides).length > 0 ? { sessions: sessionOverrides } : {}),
    ...restOverrides,
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

  it('throws HarnessConfigError for invalid close timeout', () => {
    for (const closeTimeoutMs of [0, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2_147_483_648]) {
      expect(
        () =>
          new Harness({
            agents: { default: makeAgent() },
            modes: [{ id: 'default', agentId: 'default' }],
            defaultModeId: 'default',
            sessions: { storage: makeStorage(), closeTimeoutMs },
          }),
      ).toThrow(HarnessConfigError);
    }
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

  it('uses the registered Mastra harness key as the storage namespace', async () => {
    const storage = new InMemoryStore();
    const alpha = new Harness({
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
    });
    const beta = new Harness({
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
    });
    new Mastra({
      agents: { default: makeAgent() },
      storage,
      harnesses: { alpha, beta },
    });

    const a = await alpha.session({ threadId: 'shared-thread', resourceId: 'r1' });
    const b = await beta.session({ threadId: 'shared-thread', resourceId: 'r1' });

    expect(a.id).not.toBe(b.id);
    expect(a.getRecord().harnessName).toBe('alpha');
    expect(b.getRecord().harnessName).toBe('beta');
    const harnessStore = await storage.getStore('harness');
    expect(harnessStore).toBeDefined();
    await expect(harnessStore!.loadSession({ harnessName: 'alpha', sessionId: a.id })).resolves.toMatchObject({
      harnessName: 'alpha',
    });
    await expect(harnessStore!.loadSession({ harnessName: 'beta', sessionId: b.id })).resolves.toMatchObject({
      harnessName: 'beta',
    });
  });

  it('uses the first registered key for a harness pre-bound to the same Mastra', async () => {
    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { default: makeAgent() },
      storage,
    });
    const alpha = new Harness({
      mastra,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
    });

    expect(() => alpha.__registerMastra(mastra, 'alpha')).not.toThrow();

    const session = await alpha.session({ threadId: 'shared-thread', resourceId: 'r1' });
    expect(session.getRecord().harnessName).toBe('alpha');

    const harnessStore = await storage.getStore('harness');
    expect(harnessStore).toBeDefined();
    await expect(harnessStore!.loadSession({ harnessName: 'alpha', sessionId: session.id })).resolves.toMatchObject({
      harnessName: 'alpha',
    });
    await expect(harnessStore!.loadSession({ harnessName: 'default', sessionId: session.id })).resolves.toBeNull();
  });

  it('rejects registering a pre-bound harness on a different Mastra', () => {
    const mastra = new Mastra({
      agents: { default: makeAgent() },
      storage: new InMemoryStore(),
    });
    const other = new Mastra({
      agents: { default: makeAgent() },
      storage: new InMemoryStore(),
    });
    const harness = new Harness({
      mastra,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
    });

    expect(() => harness.__registerMastra(other, 'alpha')).toThrow(HarnessConfigError);
  });

  it('rejects first non-default registration after a pre-bound harness created sessions', async () => {
    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { default: makeAgent() },
      storage,
    });
    const harness = new Harness({
      mastra,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
    });
    const session = await harness.session({ threadId: 'shared-thread', resourceId: 'r1' });
    await harness.shutdown();

    expect(() => harness.__registerMastra(mastra, 'alpha')).toThrow(HarnessConfigError);

    const harnessStore = await storage.getStore('harness');
    await expect(harnessStore!.loadSession({ harnessName: 'default', sessionId: session.id })).resolves.toMatchObject({
      harnessName: 'default',
    });
  });

  it('fails closed instead of shadowing active default sessions after restart', async () => {
    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { default: makeAgent() },
      storage,
    });
    const defaultHarness = new Harness({
      mastra,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
    });
    const defaultSession = await defaultHarness.session({ threadId: 'shared-thread', resourceId: 'r1' });
    await defaultHarness.shutdown();

    const alpha = new Harness({
      mastra,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
    });
    expect(() => alpha.__registerMastra(mastra, 'alpha')).not.toThrow();

    await expect(alpha.session({ threadId: 'shared-thread', resourceId: 'r1' })).rejects.toThrow(HarnessConfigError);

    const harnessStore = await storage.getStore('harness');
    await expect(
      harnessStore!.loadSession({ harnessName: 'default', sessionId: defaultSession.id }),
    ).resolves.toMatchObject({
      harnessName: 'default',
    });

    const alphaSession = await alpha.session({ threadId: 'alpha-thread', resourceId: 'r1' });
    expect(alphaSession.getRecord().harnessName).toBe('alpha');
  });

  it('rolls back the first registered key if Mastra binding validation fails', () => {
    const invalid = new Mastra({
      agents: { other: makeAgent() },
      storage: new InMemoryStore(),
    });
    const valid = new Mastra({
      agents: { default: makeAgent() },
      storage: new InMemoryStore(),
    });
    const harness = new Harness({
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
    });

    expect(() => harness.__registerMastra(invalid, 'bad')).toThrow(HarnessConfigError);
    expect(() => harness.__registerMastra(valid, 'alpha')).not.toThrow();
  });

  it('rejects re-registering the same Mastra under a different harness key', async () => {
    const storage = new InMemoryStore();
    const alpha = new Harness({
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
    });
    const mastra = new Mastra({
      agents: { default: makeAgent() },
      storage,
      harnesses: { alpha },
    });

    expect(() => alpha.__registerMastra(mastra, 'renamed')).toThrow(HarnessConfigError);
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

  it('persists closing markers before terminal close', async () => {
    const storage = makeStorage();
    const harness = makeHarness({ sessions: { storage, closeTimeoutMs: 250 } });
    const events: Array<{ type: string; sessionId?: string; closingAt?: number; closeDeadlineAt?: number }> = [];
    harness.subscribe(event => {
      if (event.type === 'session_closing' || event.type === 'session_closed') {
        events.push(event);
      }
    });

    const s = await harness.session({ threadId: 't1', resourceId: 'r1' });
    await s.close();

    const stored = await harness.loadSession({ sessionId: s.id, includeClosed: true });
    expect(stored?.closingAt).toBeDefined();
    expect(stored?.closeDeadlineAt).toBe((stored?.closingAt ?? 0) + 250);
    expect(stored?.closedAt).toBeDefined();

    const closing = events.find(event => event.type === 'session_closing');
    expect(closing).toMatchObject({
      type: 'session_closing',
      sessionId: s.id,
      closingAt: stored?.closingAt,
      closeDeadlineAt: stored?.closeDeadlineAt,
    });
  });

  it('rejects live work after the closing marker commits', async () => {
    const harness = makeHarness();
    const s = await harness.session({ threadId: 't1', resourceId: 'r1' });
    const rejection = new Promise<unknown>(resolve => {
      harness.subscribe(event => {
        if (event.type === 'session_closing' && event.sessionId === s.id) {
          resolve(s.setState({ closing: true }).catch(err => err));
        }
      });
    });

    await s.close();

    await expect(rejection).resolves.toBeInstanceOf(HarnessSessionClosingError);
  });

  it('lets a concurrent close terminalize before shutdown releases the lease', async () => {
    const storage = makeStorage();
    const harness = makeHarness({ sessions: { storage } });
    const s = await harness.session({ threadId: 't1', resourceId: 'r1' });
    const originalSaveSession = storage.saveSession.bind(storage);
    let releaseTerminalSave!: () => void;
    let terminalSaveStarted!: () => void;
    const terminalSaveGate = new Promise<void>(resolve => {
      releaseTerminalSave = resolve;
    });
    const terminalSaveSeen = new Promise<void>(resolve => {
      terminalSaveStarted = resolve;
    });
    storage.saveSession = (async (...args: Parameters<typeof storage.saveSession>) => {
      const [record] = args;
      if (record.id === s.id && record.closingAt !== undefined && record.closedAt !== undefined) {
        terminalSaveStarted();
        await terminalSaveGate;
      }
      return originalSaveSession(...args);
    }) as typeof storage.saveSession;

    const close = s.close();
    await terminalSaveSeen;
    const shutdown = harness.shutdown();

    releaseTerminalSave();
    await Promise.all([close, shutdown]);

    const stored = await storage.loadSession({ sessionId: s.id, harnessName: 'default' });
    expect(stored?.closedAt).toBeDefined();
  });

  it('does not start a new close after shutdown begins', async () => {
    const storage = makeStorage();
    const harness = makeHarness({ sessions: { storage } });
    const s = await harness.session({ threadId: 't1', resourceId: 'r1' });
    const originalRelease = storage.releaseSessionLease.bind(storage);
    let releaseShutdown!: () => void;
    let releaseStarted!: () => void;
    const releaseGate = new Promise<void>(resolve => {
      releaseShutdown = resolve;
    });
    const releaseSeen = new Promise<void>(resolve => {
      releaseStarted = resolve;
    });
    storage.releaseSessionLease = (async (...args: Parameters<typeof storage.releaseSessionLease>) => {
      releaseStarted();
      await releaseGate;
      return originalRelease(...args);
    }) as typeof storage.releaseSessionLease;

    const shutdown = harness.shutdown();
    await releaseSeen;
    await s.close();
    releaseShutdown();
    await shutdown;

    const stored = await storage.loadSession({ sessionId: s.id, harnessName: 'default' });
    expect(stored?.closedAt).toBeUndefined();
  });

  it('does not cascade thread delete after shutdown begins', async () => {
    const storage = makeStorage();
    const harness = makeHarness({ sessions: { storage } });
    const thread = await harness.threads.create({ resourceId: 'r1', threadId: 'delete-during-shutdown' });
    const s = await harness.session({ threadId: thread.id, resourceId: 'r1' });
    const originalRelease = storage.releaseSessionLease.bind(storage);
    let releaseShutdown!: () => void;
    let releaseStarted!: () => void;
    const releaseGate = new Promise<void>(resolve => {
      releaseShutdown = resolve;
    });
    const releaseSeen = new Promise<void>(resolve => {
      releaseStarted = resolve;
    });
    storage.releaseSessionLease = (async (...args: Parameters<typeof storage.releaseSessionLease>) => {
      releaseStarted();
      await releaseGate;
      return originalRelease(...args);
    }) as typeof storage.releaseSessionLease;

    const shutdown = harness.shutdown();
    await releaseSeen;
    await harness.threads.delete({ resourceId: 'r1', threadId: thread.id });
    releaseShutdown();
    await shutdown;

    const stored = await storage.loadSession({ sessionId: s.id, harnessName: 'default' });
    expect(stored?.closedAt).toBeUndefined();
  });

  it('does not delete thread data when shutdown starts during a delete cascade', async () => {
    const storage = makeStorage();
    const harness = makeHarness({ sessions: { storage } });
    const thread = await harness.threads.create({ resourceId: 'r1', threadId: 'delete-cascade-during-shutdown' });
    const s = await harness.session({ threadId: thread.id, resourceId: 'r1' });
    const originalSaveSession = storage.saveSession.bind(storage);
    let releaseTerminalSave!: () => void;
    let terminalSaveStarted!: () => void;
    const terminalSaveGate = new Promise<void>(resolve => {
      releaseTerminalSave = resolve;
    });
    const terminalSaveSeen = new Promise<void>(resolve => {
      terminalSaveStarted = resolve;
    });
    storage.saveSession = (async (...args: Parameters<typeof storage.saveSession>) => {
      const [record] = args;
      if (record.id === s.id && record.closingAt !== undefined && record.closedAt !== undefined) {
        terminalSaveStarted();
        await terminalSaveGate;
      }
      return originalSaveSession(...args);
    }) as typeof storage.saveSession;

    const deleting = harness.threads.delete({ resourceId: 'r1', threadId: thread.id });
    await terminalSaveSeen;
    const shutdown = harness.shutdown();
    releaseTerminalSave();
    await Promise.all([deleting, shutdown]);

    await expect(harness.threads.get({ resourceId: 'r1', threadId: thread.id })).resolves.toMatchObject({
      id: thread.id,
    });
    const stored = await storage.loadSession({ sessionId: s.id, harnessName: 'default' });
    expect(stored?.closedAt).toBeDefined();
  });

  it('does not hard-delete session rows when shutdown starts during force delete', async () => {
    const storage = makeStorage();
    const harness = makeHarness({ sessions: { storage } });
    const s = await harness.session({ threadId: 'delete-during-shutdown', resourceId: 'r1' });
    const originalSaveSession = storage.saveSession.bind(storage);
    let releaseTerminalSave!: () => void;
    let terminalSaveStarted!: () => void;
    const terminalSaveGate = new Promise<void>(resolve => {
      releaseTerminalSave = resolve;
    });
    const terminalSaveSeen = new Promise<void>(resolve => {
      terminalSaveStarted = resolve;
    });
    storage.saveSession = (async (...args: Parameters<typeof storage.saveSession>) => {
      const [record] = args;
      if (record.id === s.id && record.closingAt !== undefined && record.closedAt !== undefined) {
        terminalSaveStarted();
        await terminalSaveGate;
      }
      return originalSaveSession(...args);
    }) as typeof storage.saveSession;

    const deleting = harness.deleteSession({ sessionId: s.id, resourceId: 'r1', force: true });
    await terminalSaveSeen;
    const shutdown = harness.shutdown();
    releaseTerminalSave();
    await Promise.all([deleting, shutdown]);

    const stored = await storage.loadSession({ sessionId: s.id, harnessName: 'default' });
    expect(stored?.closedAt).toBeDefined();
  });

  it('aborts an active turn at the close deadline before terminalizing', async () => {
    const storage = makeStorage();
    const agent = new MockAgent({ id: 'default' });
    const hold = deferred();
    const abortSeen = deferred();
    agent.enqueueRun({
      holdUntil: hold.promise,
      onAbort: reason => {
        expect(reason).toBe('session_close_timeout');
        abortSeen.resolve();
      },
    });
    const harness = new Harness({
      agents: { default: agent } as any,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage, closeTimeoutMs: 1 },
    });
    const s = await harness.session({ threadId: { fresh: true }, resourceId: 'r1' });

    const message = s.message({ content: 'slow' });
    await new Promise(resolve => setImmediate(resolve));
    expect(s.isRunning()).toBe(true);

    await s.close();
    await abortSeen.promise;
    await expect(message).resolves.toMatchObject({ finishReason: 'aborted' });
    expect(s.isRunning()).toBe(false);

    const stored = await storage.loadSession({ sessionId: s.id, harnessName: 'default' });
    expect(stored?.closedAt).toBeDefined();
  });

  it('bounds close when an active turn ignores the abort signal', async () => {
    const storage = makeStorage();
    const agent = new AbortIgnoringMockAgent({ id: 'default' });
    const hold = deferred();
    agent.enqueueRun({ holdUntil: hold.promise });
    const harness = new Harness({
      agents: { default: agent } as any,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage, closeTimeoutMs: 1 },
    });
    const s = await harness.session({ threadId: { fresh: true }, resourceId: 'r1' });
    const message = s.message({ content: 'slow' });
    void message.catch(() => {});
    await new Promise(resolve => setImmediate(resolve));
    expect(s.isRunning()).toBe(true);

    await s.close();

    const stored = await storage.loadSession({ sessionId: s.id, harnessName: 'default' });
    expect(stored?.closedAt).toBeDefined();
  });

  it('drains queued work admitted before close starts', async () => {
    const storage = makeStorage();
    const agent = new MockAgent({ id: 'default' });
    const hold = deferred();
    agent.enqueueRun({ holdUntil: hold.promise, text: 'manual' });
    agent.enqueueRun({ text: 'queued-1' });
    agent.enqueueRun({ text: 'queued-2' });
    const harness = new Harness({
      agents: { default: agent } as any,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage, closeTimeoutMs: 1000 },
    });
    const s = await harness.session({ threadId: { fresh: true }, resourceId: 'r1' });

    const manual = s.message({ content: 'manual' });
    await new Promise(resolve => setImmediate(resolve));
    const q1 = s.queue({ content: 'q1' });
    const q2 = s.queue({ content: 'q2' });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(s.getQueueDepth()).toBe(2);

    const close = s.close();
    await new Promise(resolve => setImmediate(resolve));
    await expect(s.queue({ content: 'late' })).rejects.toBeInstanceOf(HarnessSessionClosingError);

    hold.resolve();
    await Promise.all([manual, q1, q2, close]);

    const stored = await storage.loadSession({ sessionId: s.id, harnessName: 'default' });
    expect(stored?.pendingQueue).toEqual([]);
    expect(stored?.closedAt).toBeDefined();
    expect(agent.streamCalls.map(call => extractSignalContents(call.messages))).toEqual(['manual', 'q1', 'q2']);
  });

  it('rejects delayed queue admission once close starts', async () => {
    const storage = makeStorage();
    const agent = new MockAgent({ id: 'default' });
    const hold = deferred();
    agent.enqueueRun({ holdUntil: hold.promise, text: 'manual' });
    const harness = new Harness({
      agents: { default: agent } as any,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage, closeTimeoutMs: 1000 },
    });
    const s = await harness.session({ threadId: { fresh: true }, resourceId: 'r1' });
    const attachment = await harness.attachments.upload({
      sessionId: s.id,
      data: Buffer.from('queued attachment'),
      filename: 'queued.txt',
      contentType: 'text/plain',
    });

    const originalGetAttachmentRecord = storage.getAttachmentRecord.bind(storage);
    let releaseLookup!: () => void;
    let lookupStarted!: () => void;
    const lookupGate = new Promise<void>(resolve => {
      releaseLookup = resolve;
    });
    const lookupSeen = new Promise<void>(resolve => {
      lookupStarted = resolve;
    });
    let lookupGated = false;
    storage.getAttachmentRecord = (async (...args: Parameters<typeof storage.getAttachmentRecord>) => {
      const [opts] = args;
      if (!lookupGated && opts.attachmentId === attachment.attachmentId) {
        lookupGated = true;
        lookupStarted();
        await lookupGate;
      }
      return originalGetAttachmentRecord(...args);
    }) as typeof storage.getAttachmentRecord;

    const manual = s.message({ content: 'manual' });
    await new Promise(resolve => setImmediate(resolve));
    const late = s.queue({ content: 'late', attachments: [attachment] });
    await lookupSeen;

    const close = s.close();
    await waitFor(() => s.getRecord().closingAt !== undefined, 'session closing marker');
    releaseLookup();

    await expect(late).rejects.toBeInstanceOf(HarnessSessionClosingError);
    hold.resolve();
    await Promise.all([manual, close]);

    const stored = await storage.loadSession({ sessionId: s.id, harnessName: 'default' });
    expect(stored?.pendingQueue).toEqual([]);
    expect(agent.streamCalls.map(call => extractSignalContents(call.messages))).toEqual(['manual']);
  });

  it('fails queued waiters instead of hanging when close drain times out', async () => {
    const storage = makeStorage();
    const agent = new AbortIgnoringMockAgent({ id: 'default' });
    const hold = deferred();
    agent.enqueueRun({ holdUntil: hold.promise, text: 'slow' });
    const harness = new Harness({
      agents: { default: agent } as any,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage, closeTimeoutMs: 20 },
    });
    const s = await harness.session({ threadId: { fresh: true }, resourceId: 'r1' });

    const queued = s.queue({ content: 'slow' });
    const queuedSecond = s.queue({ content: 'second' });
    await new Promise(resolve => setImmediate(resolve));
    const close = s.close();

    await expect(queued).rejects.toBeInstanceOf(HarnessSessionClosingError);
    await expect(queuedSecond).rejects.toBeInstanceOf(HarnessSessionClosingError);
    await close;
    hold.resolve();
    await new Promise(resolve => setImmediate(resolve));

    const stored = await storage.loadSession({ sessionId: s.id, harnessName: 'default' });
    expect(stored?.pendingQueue).toEqual([]);
    expect(stored?.closedAt).toBeDefined();
    expect(stored?.queueAdmissionReceipts?.[Object.keys(stored.queueAdmissionReceipts)[0]!]!.status).toBe('failed');
    expect(agent.streamCalls.map(call => extractSignalContents(call.messages))).toEqual(['slow']);
  });

  it('allows an admitted turn to park a question while close is draining', async () => {
    const storage = makeStorage();
    const agent = new MockAgent({ id: 'default' });
    const hold = deferred();
    agent.enqueueRun({ holdUntil: hold.promise, text: 'manual' });
    const harness = new Harness({
      agents: { default: agent } as any,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage, closeTimeoutMs: 20 },
    });
    const s = await harness.session({ threadId: { fresh: true }, resourceId: 'r1' });

    const manual = s.message({ content: 'manual' });
    await new Promise(resolve => setImmediate(resolve));
    const close = s.close();
    await waitFor(() => s.getRecord().closingAt !== undefined, 'session closing marker');

    await expect(
      (s as any)._registerQuestion({
        questionId: 'q1',
        question: 'continue?',
        runId: 'run-1',
        toolCallId: 'tool-1',
      }),
    ).resolves.toBeUndefined();
    expect(s.getRecord().pendingResume).toMatchObject({ kind: 'question', itemId: 'q1' });

    hold.resolve();
    await Promise.all([manual, close]);
    const stored = await storage.loadSession({ sessionId: s.id, harnessName: 'default' });
    expect(stored?.closedAt).toBeDefined();
  });

  it('serializes admitted writes before close and rejects late child creation', async () => {
    const storage = makeStorage();
    const harness = makeHarness({ sessions: { storage } });
    const s = await harness.session({ threadId: 't1', resourceId: 'r1' });
    const originalSaveSession = storage.saveSession.bind(storage);
    let releaseAdmittedSave!: () => void;
    let admittedSaveStarted!: () => void;
    const admittedSaveGate = new Promise<void>(resolve => {
      releaseAdmittedSave = resolve;
    });
    const admittedSaveSeen = new Promise<void>(resolve => {
      admittedSaveStarted = resolve;
    });
    let admittedSaveGated = false;
    storage.saveSession = (async (...args: Parameters<typeof storage.saveSession>) => {
      const [record] = args;
      const state = record.state as { admitted?: unknown } | undefined;
      if (!admittedSaveGated && record.id === s.id && state?.admitted === true && record.closingAt === undefined) {
        admittedSaveGated = true;
        admittedSaveStarted();
        await admittedSaveGate;
      }
      return originalSaveSession(...args);
    }) as typeof storage.saveSession;

    const admitted = s.setState({ admitted: true });
    await admittedSaveSeen;
    const closing = s.close();
    const closingAgain = s.close();

    await expect(
      harness.session({
        resourceId: 'r1',
        threadId: { fresh: true },
        parentSessionId: s.id,
      }),
    ).rejects.toBeInstanceOf(HarnessSessionClosingError);

    releaseAdmittedSave();
    await admitted;
    await Promise.all([closing, closingAgain]);

    const stored = await harness.loadSession({ sessionId: s.id, includeClosed: true });
    expect(stored?.state).toMatchObject({ admitted: true });
    expect(stored?.closingAt).toBeDefined();
    expect(stored?.closedAt).toBeDefined();
  });

  it('terminalizes descendant sessions before the close target', async () => {
    const storage = makeStorage();
    const harness = makeHarness({ sessions: { storage } });
    const closedSessionIds: string[] = [];
    harness.subscribe(event => {
      if (event.type === 'session_closed') closedSessionIds.push(event.sessionId!);
    });

    const parent = await harness.session({ threadId: 't1', resourceId: 'r1' });
    const child = await harness.session({
      threadId: { fresh: true },
      resourceId: 'r1',
      parentSessionId: parent.id,
    });
    const grandchild = await harness.session({
      threadId: { fresh: true },
      resourceId: 'r1',
      parentSessionId: child.id,
    });

    await parent.close();

    expect(closedSessionIds).toEqual([grandchild.id, child.id, parent.id]);
  });

  it('repairs a stored closing marker without resetting the deadline', async () => {
    const storage = makeStorage();
    const harness = makeHarness({ sessions: { storage, closeTimeoutMs: 250 } });
    const s = await harness.session({ threadId: 't1', resourceId: 'r1' });
    const record = s.getRecord();
    await storage.saveSession(
      {
        ...record,
        closingAt: 1234,
        closeDeadlineAt: 5678,
        lastActivityAt: 1234,
      },
      { harnessName: record.harnessName, ownerId: harness.ownerId, ifVersion: record.version },
    );
    await harness.shutdown();

    const harness2 = makeHarness({ sessions: { storage, closeTimeoutMs: 999 } });
    await expect(harness2.session({ sessionId: s.id })).rejects.toBeInstanceOf(HarnessSessionClosingError);
    await harness2.closeSession({ sessionId: s.id });

    const stored = await harness2.loadSession({ sessionId: s.id, includeClosed: true });
    expect(stored?.closingAt).toBe(1234);
    expect(stored?.closeDeadlineAt).toBe(5678);
    expect(stored?.closedAt).toBeDefined();
  });

  it('drains a stored pending queue before closeSession terminalizes a non-live session', async () => {
    const storage = makeStorage();
    const harness = makeHarness({ sessions: { storage, closeTimeoutMs: 1000 } });
    const s = await harness.session({ threadId: 't1', resourceId: 'r1' });
    const record = s.getRecord();

    await harness.shutdown();
    const now = Date.now();
    const queuedItemId = 'stored-close-queue';
    await storage.saveSession(
      {
        ...record,
        pendingQueue: [
          {
            id: queuedItemId,
            admissionId: 'stored-close-admission',
            admissionHash: 'stored-close-hash',
            enqueuedAt: now,
            content: 'stored queued',
            attachments: [],
          },
        ],
        queueAdmissionReceipts: {
          [queuedItemId]: {
            admissionId: 'stored-close-admission',
            admissionHash: 'stored-close-hash',
            queuedItemId,
            status: 'queued',
            attempts: 0,
            enqueuedAt: now,
            updatedAt: now,
          },
        },
        lastActivityAt: now,
      },
      { harnessName: record.harnessName, ownerId: harness.ownerId, ifVersion: record.version },
    );

    const replayAgent = new MockAgent({ id: 'default' });
    replayAgent.enqueueRun({ text: 'stored queued result' });
    const harness2 = new Harness({
      agents: { default: replayAgent } as any,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage, closeTimeoutMs: 1000 },
    });
    await harness2.closeSession({ sessionId: s.id });

    const stored = await harness2.loadSession({ sessionId: s.id, includeClosed: true });
    expect(stored?.pendingQueue).toEqual([]);
    expect(stored?.closedAt).toBeDefined();
    expect(replayAgent.streamCalls.map(call => extractSignalContents(call.messages))).toEqual(['stored queued']);
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
  it('throws when no agents/storage/mastra are supplied and a session is requested', async () => {
    // Three-shape constructor: passing nothing keeps the harness deferred-bound,
    // expecting a parent Mastra to call __registerMastra. If neither happens,
    // session() must surface the misconfiguration with a clear error.
    const harness = new Harness({
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
    });
    await expect(harness.session({ threadId: 't1', resourceId: 'r1' })).rejects.toThrow(HarnessConfigError);
  });

  it('defaults to InMemoryStore when agents are supplied without storage', async () => {
    // Standalone construction with agents-only must still work end-to-end —
    // both the harness storage domain and the memory storage domain (used by
    // thread CRUD) are provided by the default InMemoryStore.
    const harness = new Harness({
      agents: { default: makeAgent() },
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
    });
    const session = await harness.session({ threadId: 't1', resourceId: 'r1' });
    expect(session.id).toMatch(/^sess-/);
  });
});

describe('Harness v1 — deterministic-id branch (§5.3)', () => {
  it('mints a record using the caller-supplied sessionId when none exists', async () => {
    const harness = makeHarness();
    const s = await harness.session({ threadId: 't1', resourceId: 'r1', sessionId: 'sess-explicit-1' });
    expect(s.id).toBe('sess-explicit-1');
    expect(s.threadId).toBe('t1');
  });

  it('returns the existing record when sessionId matches the live instance', async () => {
    const harness = makeHarness();
    const a = await harness.session({ threadId: 't1', resourceId: 'r1', sessionId: 'sess-explicit-2' });
    const b = await harness.session({ threadId: 't1', resourceId: 'r1', sessionId: 'sess-explicit-2' });
    expect(b).toBe(a);
  });

  it('returns the active record when caller-supplied sessionId disagrees with the active one', async () => {
    const harness = makeHarness();
    const first = await harness.session({ threadId: 't1', resourceId: 'r1' });
    const second = await harness.session({ threadId: 't1', resourceId: 'r1', sessionId: 'sess-different' });
    expect(second.id).toBe(first.id);
    expect(second.threadId).toBe('t1');
  });

  it('returns an existing active child when the parent closes after thread lookup misses', async () => {
    const storage = makeStorage();
    const harness = makeHarness({ sessions: { storage } });
    const parent = await harness.session({ threadId: 'parent-thread', resourceId: 'r1', sessionId: 'parent' });
    const now = Date.now();
    await storage.createOrLoadActiveSession(
      {
        ...parent.getRecord(),
        id: 'existing-child',
        threadId: 'child-thread',
        parentSessionId: parent.id,
        origin: 'subagent-tool',
        subagentDepth: 1,
        createdAt: now,
        lastActivityAt: now,
        version: 0,
        ownerId: harness.ownerId,
        leaseExpiresAt: now + 30_000,
      },
      { initialLease: { ownerId: harness.ownerId, ttlMs: 30_000 } },
    );

    const originalLoadSessionByThread = storage.loadSessionByThread.bind(storage);
    let forcedThreadMiss = false;
    storage.loadSessionByThread = (async (...args: Parameters<typeof storage.loadSessionByThread>) => {
      const [opts] = args;
      if (opts.threadId === 'child-thread' && opts.resourceId === 'r1' && !forcedThreadMiss) {
        forcedThreadMiss = true;
        return null;
      }
      return originalLoadSessionByThread(...args);
    }) as typeof storage.loadSessionByThread;

    const originalSaveSession = storage.saveSession.bind(storage);
    let releaseClosingMarker!: () => void;
    let closingMarkerStarted!: () => void;
    const closingMarkerGate = new Promise<void>(resolve => {
      releaseClosingMarker = resolve;
    });
    const closingMarkerSeen = new Promise<void>(resolve => {
      closingMarkerStarted = resolve;
    });
    storage.saveSession = (async (...args: Parameters<typeof storage.saveSession>) => {
      const [record] = args;
      if (record.id === parent.id && record.closingAt !== undefined && record.closedAt === undefined) {
        closingMarkerStarted();
        await closingMarkerGate;
      }
      return originalSaveSession(...args);
    }) as typeof storage.saveSession;

    const closing = parent.close();
    await closingMarkerSeen;

    const child = await harness.session({
      threadId: 'child-thread',
      resourceId: 'r1',
      parentSessionId: parent.id,
      sessionId: 'retry-child',
      origin: 'subagent-tool',
    });

    expect(child.id).toBe('existing-child');
    expect(forcedThreadMiss).toBe(true);
    await expect(storage.loadSession({ sessionId: 'retry-child', harnessName: 'default' })).resolves.toBeNull();
    releaseClosingMarker();
    await closing;
  });
});

describe('Harness v1 — deep cascade', () => {
  it('cascades close through a parent → child → grandchild chain', async () => {
    const storage = makeStorage();
    const harness = makeHarness({ sessions: { storage } });

    const parent = await harness.session({ threadId: 't1', resourceId: 'r1' });
    const child = await harness.session({
      threadId: { fresh: true },
      resourceId: 'r1',
      parentSessionId: parent.id,
    });
    const grandchild = await harness.session({
      threadId: { fresh: true },
      resourceId: 'r1',
      parentSessionId: child.id,
    });

    await parent.close();

    const storedChild = await harness.loadSession({ sessionId: child.id, includeClosed: true });
    const storedGrand = await harness.loadSession({ sessionId: grandchild.id, includeClosed: true });
    expect(storedChild?.closedAt).toBeDefined();
    expect(storedGrand?.closedAt).toBeDefined();
    expect(harness._internalLiveSessionCount()).toBe(0);
  });
});

describe('Harness v1 — delete lifecycle', () => {
  it('blocks non-force delete while the target subtree is still active', async () => {
    const storage = makeStorage();
    const harness = makeHarness({ sessions: { storage } });
    const parent = await harness.session({ threadId: 'parent-thread', resourceId: 'r1' });
    const child = await harness.session({
      threadId: { fresh: true },
      resourceId: 'r1',
      parentSessionId: parent.id,
    });

    await expect(harness.deleteSession({ sessionId: parent.id, resourceId: 'r1' })).rejects.toMatchObject({
      name: 'HarnessSessionDeleteBlockedError',
      sessionId: parent.id,
      blockers: expect.arrayContaining([`${parent.id}:not_closed`, `${child.id}:not_closed`]),
    } satisfies Partial<HarnessSessionDeleteBlockedError>);
    await expect(storage.loadSession({ sessionId: parent.id, harnessName: 'default' })).resolves.not.toBeNull();
    await expect(storage.loadSession({ sessionId: child.id, harnessName: 'default' })).resolves.not.toBeNull();
  });

  it('blocks non-force delete for completed queue receipts until post-run finalization is marked', async () => {
    const storage = makeStorage();
    const harness = makeHarness({ sessions: { storage } });
    const session = await harness.session({ threadId: { fresh: true }, resourceId: 'r1' });
    await session.close();
    const stored = (await storage.loadSession({ sessionId: session.id, harnessName: 'default' }))!;
    const now = Date.now();

    await storage.saveSession(
      {
        ...stored,
        queueAdmissionReceipts: {
          queued: {
            admissionId: 'admission-1',
            admissionHash: 'hash-1',
            queuedItemId: 'queued',
            status: 'completed',
            result: { text: 'done' },
            attempts: 1,
            enqueuedAt: now,
            completedAt: now,
            updatedAt: now,
          },
        },
      },
      { harnessName: 'default', ownerId: stored.ownerId ?? 'h', ifVersion: stored.version },
    );

    await expect(harness.deleteSession({ sessionId: session.id, resourceId: 'r1' })).rejects.toMatchObject({
      blockers: expect.arrayContaining([`${session.id}:queue_receipt:queued`]),
    } satisfies Partial<HarnessSessionDeleteBlockedError>);
  });

  it('non-force deletes an already closed subtree and owned attachments bottom-up', async () => {
    const storage = makeStorage();
    const harness = makeHarness({ sessions: { storage } });
    const parent = await harness.session({ threadId: 'parent-thread', resourceId: 'r1' });
    const child = await harness.session({
      threadId: { fresh: true },
      resourceId: 'r1',
      parentSessionId: parent.id,
    });
    const attachment = await harness.attachments.upload({
      sessionId: child.id,
      resourceId: 'r1',
      data: Buffer.from('delete me'),
      filename: 'delete.txt',
      contentType: 'text/plain',
    });

    await parent.close();
    await harness.deleteSession({ sessionId: parent.id, resourceId: 'r1' });

    await expect(storage.loadSession({ sessionId: parent.id, harnessName: 'default' })).resolves.toBeNull();
    await expect(storage.loadSession({ sessionId: child.id, harnessName: 'default' })).resolves.toBeNull();
    await expect(
      storage.getAttachmentRecord({
        harnessName: 'default',
        sessionId: child.id,
        attachmentId: attachment.attachmentId,
      }),
    ).resolves.toBeNull();
  });

  it('does not hard-delete when storage observes a stale closed-tree version', async () => {
    const storage = makeStorage();
    const harness = makeHarness({ sessions: { storage } });
    const parent = await harness.session({ threadId: 'parent-thread', resourceId: 'r1' });
    const child = await harness.session({
      threadId: { fresh: true },
      resourceId: 'r1',
      parentSessionId: parent.id,
    });
    await parent.close();
    const originalDeleteSessions = storage.deleteSessions.bind(storage);
    let mutated = false;
    storage.deleteSessions = (async (...args: Parameters<typeof storage.deleteSessions>) => {
      if (!mutated) {
        mutated = true;
        const current = await storage.loadSession({ harnessName: 'default', sessionId: parent.id });
        if (!current) throw new Error('expected session before guarded delete');
        await storage.saveSession(
          {
            ...current,
            state: { raced: true },
          },
          { harnessName: 'default', ownerId: current.ownerId ?? 'racer', ifVersion: current.version },
        );
      }
      return originalDeleteSessions(...args);
    }) as typeof storage.deleteSessions;

    await expect(harness.deleteSession({ sessionId: parent.id, resourceId: 'r1' })).rejects.toBeInstanceOf(
      HarnessStorageVersionConflictError,
    );
    await expect(storage.loadSession({ sessionId: parent.id, harnessName: 'default' })).resolves.toMatchObject({
      id: parent.id,
      state: { raced: true },
    });
    await expect(storage.loadSession({ sessionId: child.id, harnessName: 'default' })).resolves.toMatchObject({
      id: child.id,
    });
  });

  it('keeps legacy deleteSession fallback behavior for adapters without batch delete override', async () => {
    class LegacyDeleteSessionStorage extends InMemoryHarness {
      override get supportsAtomicDeleteSessions(): boolean {
        return false;
      }

      override async deleteSession(opts: Parameters<InMemoryHarness['deleteSession']>[0]): Promise<void> {
        await InMemoryHarness.prototype.deleteSessions.call(this, { sessions: [opts] });
      }

      override async deleteSessions(opts: Parameters<HarnessStorage['deleteSessions']>[0]): Promise<void> {
        await HarnessStorage.prototype.deleteSessions.call(this, opts);
      }
    }
    const storage = new LegacyDeleteSessionStorage({ db: new InMemoryDB() });
    const harness = makeHarness({ sessions: { storage } });
    const parent = await harness.session({ threadId: 'parent-thread', resourceId: 'r1' });
    const child = await harness.session({
      threadId: { fresh: true },
      resourceId: 'r1',
      parentSessionId: parent.id,
    });

    await parent.close();
    await expect(
      storage.deleteSessions({
        sessions: [
          { sessionId: parent.id, requireClosed: true },
          { sessionId: child.id, requireClosed: true },
        ],
      }),
    ).rejects.toThrow('HarnessStorage.deleteSessions must be overridden');
    await harness.deleteSession({ sessionId: parent.id, resourceId: 'r1' });

    await expect(storage.loadSession({ sessionId: child.id, harnessName: 'default' })).resolves.toBeNull();
    await expect(storage.loadSession({ sessionId: parent.id, harnessName: 'default' })).resolves.toBeNull();
  });

  it('reconciles live sessions after a custom batch delete partially fails', async () => {
    class PartiallyFailingBatchStorage extends InMemoryHarness {
      override async deleteSessions(opts: Parameters<InMemoryHarness['deleteSessions']>[0]): Promise<void> {
        await InMemoryHarness.prototype.deleteSessions.call(this, { sessions: [opts.sessions[0]!] });
        throw new HarnessStorageDeleteGuardConflictError(opts.sessions[1]!.sessionId, 'ifVersion', 1, 2);
      }
    }
    const storage = new PartiallyFailingBatchStorage({ db: new InMemoryDB() });
    const harness = makeHarness({ sessions: { storage } });
    const parent = await harness.session({ threadId: 'parent-thread', resourceId: 'r1' });
    const child = await harness.session({
      threadId: { fresh: true },
      resourceId: 'r1',
      parentSessionId: parent.id,
    });

    await expect(harness.deleteSession({ sessionId: parent.id, resourceId: 'r1', force: true })).rejects.toBeInstanceOf(
      HarnessStorageDeleteGuardConflictError,
    );

    await expect(storage.loadSession({ sessionId: child.id, harnessName: 'default' })).resolves.toBeNull();
    await expect(storage.loadSession({ sessionId: parent.id, harnessName: 'default' })).resolves.toMatchObject({
      id: parent.id,
    });
    await expect(child.setState({ afterPartialDelete: true })).rejects.toBeInstanceOf(HarnessSessionDeletedError);
  });

  it('preserves the original batch delete error when reconciliation reads fail', async () => {
    const deleteError = new HarnessStorageDeleteGuardConflictError('parent', 'ifVersion', 1, 2);
    class ReconciliationReadFailingStorage extends InMemoryHarness {
      private failLoads = false;

      override async deleteSessions(opts: Parameters<InMemoryHarness['deleteSessions']>[0]): Promise<void> {
        await InMemoryHarness.prototype.deleteSessions.call(this, { sessions: [opts.sessions[0]!] });
        this.failLoads = true;
        throw deleteError;
      }

      override async loadSession(opts: Parameters<InMemoryHarness['loadSession']>[0]) {
        if (this.failLoads) throw new Error('load failed during reconciliation');
        return InMemoryHarness.prototype.loadSession.call(this, opts);
      }
    }
    const storage = new ReconciliationReadFailingStorage({ db: new InMemoryDB() });
    const harness = makeHarness({ sessions: { storage } });
    const parent = await harness.session({ threadId: 'parent-thread', resourceId: 'r1' });
    await harness.session({
      threadId: { fresh: true },
      resourceId: 'r1',
      parentSessionId: parent.id,
    });

    await expect(harness.deleteSession({ sessionId: parent.id, resourceId: 'r1', force: true })).rejects.toBe(
      deleteError,
    );
  });

  it('force deletes an active subtree after terminalizing it through close', async () => {
    const storage = makeStorage();
    const harness = makeHarness({ sessions: { storage } });
    const parent = await harness.session({ threadId: 'parent-thread', resourceId: 'r1' });
    const child = await harness.session({
      threadId: { fresh: true },
      resourceId: 'r1',
      parentSessionId: parent.id,
    });

    await harness.deleteSession({ sessionId: parent.id, resourceId: 'r1', force: true });

    await expect(storage.loadSession({ sessionId: parent.id, harnessName: 'default' })).resolves.toBeNull();
    await expect(storage.loadSession({ sessionId: child.id, harnessName: 'default' })).resolves.toBeNull();
    await expect(parent.setState({ afterDelete: true })).rejects.toBeInstanceOf(HarnessSessionDeletedError);
    expect(harness._internalLiveSessionCount()).toBe(0);
  });

  it('aborts an active turn when hard-delete marks a live session deleted', async () => {
    class GatedEvidenceStorage extends InMemoryHarness {
      gatedSignalId?: string;
      private gated = false;
      private releasedDuringDeleteCleanup = false;
      private release!: () => void;
      private start!: () => void;
      private finish!: () => void;
      readonly started = new Promise<void>(resolve => {
        this.start = resolve;
      });
      readonly finished = new Promise<void>(resolve => {
        this.finish = resolve;
      });
      private readonly gate = new Promise<void>(resolve => {
        this.release = resolve;
      });

      override async writeMessageResultEvidence(
        record: Parameters<InMemoryHarness['writeMessageResultEvidence']>[0],
      ): Promise<{ created: boolean }> {
        if (!this.gated && record.status === 'pending') {
          this.gated = true;
          this.gatedSignalId = record.signalId;
          this.start();
          await this.gate;
        }
        try {
          return await super.writeMessageResultEvidence(record);
        } finally {
          if (record.signalId === this.gatedSignalId) this.finish();
        }
      }

      override async deleteOperationAdmissionTombstonesForSession(
        opts: Parameters<InMemoryHarness['deleteOperationAdmissionTombstonesForSession']>[0],
      ): Promise<void> {
        await super.deleteOperationAdmissionTombstonesForSession(opts);
        if (!this.releasedDuringDeleteCleanup && this.gatedSignalId !== undefined) {
          this.releasedDuringDeleteCleanup = true;
          this.release();
          await this.finished;
        }
      }
    }
    const storage = new GatedEvidenceStorage({ db: new InMemoryDB() });
    const agent = new MockAgent({ id: 'default' });
    const hold = deferred();
    agent.enqueueRun({
      holdUntil: hold.promise,
    });
    const harness = new Harness({
      agents: { default: agent } as any,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage },
    });
    const session = await harness.session({ threadId: { fresh: true }, resourceId: 'r1' });
    const message = session.message({ content: 'slow', admissionId: 'delete-active-turn' });
    const messageSettled = message.then(
      value => ({ ok: true as const, value }),
      err => ({ ok: false as const, err }),
    );
    await waitFor(() => session.isRunning(), 'active turn start');
    await storage.started;
    const idleSettled = session.waitForIdle().then(
      () => ({ ok: true as const }),
      err => ({ ok: false as const, err }),
    );

    const stored = (await storage.loadSession({ sessionId: session.id, harnessName: 'default' }))!;
    // Simulate an out-of-band close marker so this live instance reaches hard-delete while still running.
    await storage.saveSession(
      {
        ...stored,
        closedAt: Date.now(),
      },
      { harnessName: 'default', ownerId: harness.ownerId, ifVersion: stored.version },
    );

    await harness.deleteSession({ sessionId: session.id, resourceId: 'r1' });

    expect(session.isRunning()).toBe(false);
    await expect(idleSettled).resolves.toMatchObject({ ok: false, err: expect.any(HarnessSessionDeletedError) });
    await expect(messageSettled).resolves.toMatchObject({ ok: false, err: expect.any(HarnessSessionDeletedError) });
    await storage.finished;
    await expect(storage.loadSession({ sessionId: session.id, harnessName: 'default' })).resolves.toBeNull();
    await expect(
      storage.loadMessageResultEvidence({
        sessionId: session.id,
        resourceId: session.resourceId,
        threadId: session.threadId,
        signalId: storage.gatedSignalId!,
      }),
    ).resolves.toBeNull();
    await expect(session.setState({ afterDelete: true })).rejects.toBeInstanceOf(HarnessSessionDeletedError);
  });

  it('rejects an active structured sync turn when hard-delete marks a live session deleted', async () => {
    const storage = makeStorage();
    const agent = new BlockingGenerateMockAgent({ id: 'default' });
    const harness = new Harness({
      agents: { default: agent } as any,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage },
    });
    const session = await harness.session({ threadId: { fresh: true }, resourceId: 'r1' });
    const messageRejected = expect(
      session.message({ content: 'slow', output: z.object({ ok: z.boolean() }), sync: true }),
    ).rejects.toBeInstanceOf(HarnessSessionDeletedError);
    await waitFor(() => session.isRunning(), 'structured turn start');
    const idleRejected = expect(session.waitForIdle()).rejects.toBeInstanceOf(HarnessSessionDeletedError);

    const stored = (await storage.loadSession({ sessionId: session.id, harnessName: 'default' }))!;
    await storage.saveSession(
      {
        ...stored,
        closedAt: Date.now(),
      },
      { harnessName: 'default', ownerId: harness.ownerId, ifVersion: stored.version },
    );

    await harness.deleteSession({ sessionId: session.id, resourceId: 'r1' });

    expect(session.isRunning()).toBe(false);
    await messageRejected;
    await idleRejected;
  });

  it('aborts an active streamed turn when hard-delete marks a live session deleted', async () => {
    const storage = makeStorage();
    const writeMessageResultEvidence = storage.writeMessageResultEvidence.bind(storage);
    let signalId: string | undefined;
    storage.writeMessageResultEvidence = async record => {
      if (record.admissionId === 'delete-active-stream') {
        signalId = record.signalId;
      }
      return writeMessageResultEvidence(record);
    };
    const agent = new MockAgent({ id: 'default' });
    const hold = deferred();
    agent.enqueueRun({ holdUntil: hold.promise, text: 'streamed after delete' });
    const harness = new Harness({
      agents: { default: agent } as any,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage },
    });
    const session = await harness.session({ threadId: { fresh: true }, resourceId: 'r1' });

    await session.message({ content: 'slow', admissionId: 'delete-active-stream', stream: true });
    await waitFor(() => session.isRunning() && signalId !== undefined, 'stream turn start');
    const idleSettled = session.waitForIdle().then(
      () => ({ ok: true as const }),
      err => ({ ok: false as const, err }),
    );

    const stored = (await storage.loadSession({ sessionId: session.id, harnessName: 'default' }))!;
    await storage.saveSession(
      {
        ...stored,
        closedAt: Date.now(),
      },
      { harnessName: 'default', ownerId: harness.ownerId, ifVersion: stored.version },
    );

    await harness.deleteSession({ sessionId: session.id, resourceId: 'r1' });

    expect(session.isRunning()).toBe(false);
    await expect(idleSettled).resolves.toMatchObject({ ok: false, err: expect.any(HarnessSessionDeletedError) });
    await expect(
      storage.loadMessageResultEvidence({
        sessionId: session.id,
        resourceId: session.resourceId,
        threadId: session.threadId,
        signalId: signalId!,
      }),
    ).resolves.toBeNull();
    hold.resolve();
    await new Promise(resolve => setImmediate(resolve));
  });

  it('scopes late deleted-session evidence cleanup to the deleted turn identity', async () => {
    const storage = makeStorage();
    const harness = makeHarness({ sessions: { storage } });
    const oldSession = await harness.session({ threadId: 'old-thread', resourceId: 'r1', sessionId: 'sess-reused' });
    const now = Date.now();
    await storage.writeMessageResultEvidence({
      harnessName: 'default',
      sessionId: oldSession.id,
      resourceId: oldSession.resourceId,
      threadId: oldSession.threadId,
      signalId: 'old-signal',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
    await storage.writeMessageResultEvidence({
      harnessName: 'default',
      sessionId: oldSession.id,
      resourceId: oldSession.resourceId,
      threadId: oldSession.threadId,
      signalId: 'same-thread-new-signal',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
    await storage.writeMessageResultEvidence({
      harnessName: 'default',
      sessionId: oldSession.id,
      resourceId: oldSession.resourceId,
      threadId: 'new-thread',
      signalId: 'new-signal',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });

    (oldSession as any)._markDeleted();
    await (oldSession as any)._cleanupOperationEvidenceIfDeleted({ signalId: 'old-signal' });

    await expect(
      storage.loadMessageResultEvidence({
        harnessName: 'default',
        sessionId: oldSession.id,
        resourceId: oldSession.resourceId,
        threadId: oldSession.threadId,
        signalId: 'old-signal',
      }),
    ).resolves.toBeNull();
    await expect(
      storage.loadMessageResultEvidence({
        harnessName: 'default',
        sessionId: oldSession.id,
        resourceId: oldSession.resourceId,
        threadId: oldSession.threadId,
        signalId: 'same-thread-new-signal',
      }),
    ).resolves.toMatchObject({ status: 'pending' });
    await expect(
      storage.loadMessageResultEvidence({
        harnessName: 'default',
        sessionId: oldSession.id,
        resourceId: oldSession.resourceId,
        threadId: 'new-thread',
        signalId: 'new-signal',
      }),
    ).resolves.toMatchObject({ status: 'pending' });
  });

  it('marks live descendants created during force-delete discovery as deleted', async () => {
    const storage = makeStorage();
    const harness = makeHarness({ sessions: { storage } });
    const parent = await harness.session({ threadId: 'parent-thread', resourceId: 'r1' });
    const originalListSessions = storage.listSessions.bind(storage);
    let child: Awaited<ReturnType<typeof harness.session>> | undefined;
    let injected = false;
    storage.listSessions = (async (...args: Parameters<typeof storage.listSessions>) => {
      const [opts] = args;
      const result = await originalListSessions(...args);
      if (!injected && opts.parentSessionId === parent.id && opts.includeClosed === true) {
        injected = true;
        child = await harness.session({
          threadId: { fresh: true },
          resourceId: 'r1',
          parentSessionId: parent.id,
        });
      }
      return result;
    }) as typeof storage.listSessions;

    await harness.deleteSession({ sessionId: parent.id, resourceId: 'r1', force: true });

    expect(child).toBeDefined();
    await expect(storage.loadSession({ sessionId: child!.id, harnessName: 'default' })).resolves.toBeNull();
    await expect(child!.setState({ afterDelete: true })).rejects.toBeInstanceOf(HarnessSessionDeletedError);
    expect(harness._internalLiveSessionCount()).toBe(0);
  });

  it('does not flush a queued turn after force delete removes the row', async () => {
    const storage = makeStorage();
    const agent = new AbortIgnoringMockAgent({ id: 'default' });
    const hold = deferred();
    agent.enqueueRun({ holdUntil: hold.promise, text: 'queued after delete' });
    const harness = new Harness({
      agents: { default: agent } as any,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage, closeTimeoutMs: 1 },
    });
    const session = await harness.session({ threadId: { fresh: true }, resourceId: 'r1' });
    const queued = session.queue({ content: 'queued' });
    void queued.catch(() => {});
    await waitFor(() => agent.streamCalls.length === 1, 'queued run start');

    await harness.deleteSession({ sessionId: session.id, resourceId: 'r1', force: true });
    expect(session.isRunning()).toBe(false);
    await expect(storage.loadSession({ sessionId: session.id, harnessName: 'default' })).resolves.toBeNull();

    hold.resolve();
    await expect(queued).rejects.toBeInstanceOf(HarnessSessionClosingError);
    await new Promise(resolve => setImmediate(resolve));
  });

  it('rejects an active queued turn when hard-delete marks the live session deleted', async () => {
    const storage = makeStorage();
    const agent = new AbortIgnoringMockAgent({ id: 'default' });
    const hold = deferred();
    agent.enqueueRun({ holdUntil: hold.promise, text: 'queued after delete' });
    const harness = new Harness({
      agents: { default: agent } as any,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage },
    });
    const session = await harness.session({ threadId: { fresh: true }, resourceId: 'r1' });
    const queued = session.queue({ content: 'queued' });
    const queuedSettled = queued.then(
      value => ({ ok: true as const, value }),
      err => ({ ok: false as const, err }),
    );
    await waitFor(() => agent.streamCalls.length === 1 && session.isRunning(), 'queued run start');
    const idleSettled = session.waitForIdle().then(
      () => ({ ok: true as const }),
      err => ({ ok: false as const, err }),
    );

    (session as any)._markDeleted();
    expect(session.isRunning()).toBe(false);

    hold.resolve();
    await expect(queuedSettled).resolves.toMatchObject({ ok: false, err: expect.any(HarnessSessionDeletedError) });
    await expect(idleSettled).resolves.toMatchObject({ ok: false, err: expect.any(HarnessSessionDeletedError) });
    await new Promise(resolve => setImmediate(resolve));
  });

  it('does not leak existence across resources during delete', async () => {
    const storage = makeStorage();
    const harness = makeHarness({ sessions: { storage } });
    const session = await harness.session({ threadId: 't1', resourceId: 'r1' });

    await expect(
      harness.deleteSession({ sessionId: session.id, resourceId: 'r2', force: true }),
    ).rejects.toBeInstanceOf(HarnessSessionNotFoundError);
    await expect(storage.loadSession({ sessionId: session.id, harnessName: 'default' })).resolves.not.toBeNull();
  });

  it('rechecks resource scope before committing a force delete', async () => {
    const storage = makeStorage();
    const harness = makeHarness({ sessions: { storage } });
    const session = await harness.session({ threadId: 't1', resourceId: 'r1' });
    const originalLoadSession = storage.loadSession.bind(storage);
    let loads = 0;
    storage.loadSession = (async (...args: Parameters<typeof storage.loadSession>) => {
      const record = await originalLoadSession(...args);
      if (args[0].sessionId === session.id) {
        loads += 1;
        if (loads === 2 && record) {
          return { ...record, resourceId: 'r2' };
        }
      }
      return record;
    }) as typeof storage.loadSession;

    await expect(
      harness.deleteSession({ sessionId: session.id, resourceId: 'r1', force: true }),
    ).rejects.toBeInstanceOf(HarnessSessionNotFoundError);
    const stored = await originalLoadSession({ sessionId: session.id, harnessName: 'default' });
    expect(stored).not.toBeNull();
    expect(stored?.closedAt).toBeUndefined();
  });
});

describe('Harness v1 — crash recovery (lease TTL)', () => {
  it('lets a fresh harness take over once the prior owner lease has expired', async () => {
    // Build storage with a db handle we can poke directly to age out the lease.
    const db = new InMemoryDB();
    const storage = new InMemoryHarness({ db });

    const a = makeHarness({ sessions: { storage } });
    const session = await a.session({ threadId: 't1', resourceId: 'r1' });
    const id = session.id;

    // Simulate process crash: lease still held, no graceful shutdown. Force
    // expiry by rewriting the lease window into the past directly in the
    // backing db (saveSession preserves lease metadata so we cannot do this
    // through the public storage API).
    const stored = db.harnessSessions.get(`default\u0000${id}`);
    if (!stored) throw new Error('precondition: session must exist after crash');
    db.harnessSessions.set(`default\u0000${id}`, { ...stored, leaseExpiresAt: Date.now() - 60_000 });

    const b = makeHarness({ sessions: { storage } });
    const taken = await b.session({ sessionId: id });
    expect(taken.id).toBe(id);
    expect(taken._internalOwnerId).toBe(b.ownerId);
  });
});

describe('Harness v1 — concurrent resolver race', () => {
  // In-flight dedup of parallel session() calls for the same thread is not
  // yet implemented — the current resolver lets both calls race to
  // _createFresh. Track the desired behavior here so it surfaces when the
  // dedup map lands.
  it.todo('serialises two parallel session() calls for the same thread to a single record');

  it('serialises lease acquisition per session — distinct sessions resolve in parallel', async () => {
    // A single harness owns its leases; parallel resolves for *different*
    // threads must not block each other behind a shared mutex. This catches
    // accidental global locking around _initSession.
    const harness = makeHarness();
    const [a, b, c] = await Promise.all([
      harness.session({ threadId: 't1', resourceId: 'r1' }),
      harness.session({ threadId: 't2', resourceId: 'r1' }),
      harness.session({ threadId: 't3', resourceId: 'r1' }),
    ]);
    expect(new Set([a.id, b.id, c.id]).size).toBe(3);
  });

  it('rejects a deterministic-id collision between two harnesses with HarnessSessionLockedError', async () => {
    // Two harnesses race to insert the same caller-supplied sessionId. The
    // loser's saveSession() sees a version mismatch and translates it into
    // HarnessSessionLockedError — the resolver does not silently downgrade
    // to "load the existing record" because that would steal the lease.
    const storage = makeStorage();
    const a = makeHarness({ sessions: { storage } });
    const b = makeHarness({ sessions: { storage } });

    await a.session({ threadId: 't1', resourceId: 'r1', sessionId: 'sess-shared' });
    await expect(b.session({ threadId: 't1', resourceId: 'r1', sessionId: 'sess-shared' })).rejects.toThrow(
      HarnessSessionLockedError,
    );
  });

  it('exposes holder + expiry fields on HarnessSessionLockedError', async () => {
    // Holders need to know who owns the lease and when it expires so they
    // can decide whether to wait, retry, or steal. Assert the error carries
    // the contract we promise in §4.5.
    const storage = makeStorage();
    const a = makeHarness({ sessions: { storage } });
    const b = makeHarness({ sessions: { storage } });

    const owner = await a.session({ threadId: 't1', resourceId: 'r1' });

    let captured: HarnessSessionLockedError | undefined;
    try {
      await b.session({ sessionId: owner.id });
    } catch (err) {
      captured = err as HarnessSessionLockedError;
    }
    expect(captured).toBeInstanceOf(HarnessSessionLockedError);
    expect(captured!.sessionId).toBe(owner.id);
    expect(captured!.currentOwnerId).toBe(a.ownerId);
    expect(typeof captured!.expiresAt).toBe('number');
    expect(captured!.expiresAt).toBeGreaterThan(Date.now());
  });
});

describe('Session — identity + lifecycle', () => {
  it('exposes id, threadId, resourceId, createdAt as readonly identity', async () => {
    const harness = makeHarness();
    const s = await harness.session({ threadId: 't1', resourceId: 'r1' });
    expect(typeof s.id).toBe('string');
    expect(s.threadId).toBe('t1');
    expect(s.resourceId).toBe('r1');
    expect(typeof s.createdAt).toBe('number');
    expect(s.parentSessionId).toBeUndefined();
  });

  it('records parentSessionId when spawned as a child', async () => {
    const harness = makeHarness();
    const parent = await harness.session({ threadId: 't1', resourceId: 'r1' });
    const child = await harness.session({
      threadId: { fresh: true },
      resourceId: 'r1',
      parentSessionId: parent.id,
    });
    expect(child.parentSessionId).toBe(parent.id);
  });

  it('flips lifecycleState from "live" to "closed" on close()', async () => {
    const harness = makeHarness();
    const s = await harness.session({ threadId: 't1', resourceId: 'r1' });
    expect(s.lifecycleState).toBe('live');
    expect(s.isClosed).toBe(false);
    await s.close();
    expect(s.lifecycleState).toBe('closed');
    expect(s.isClosed).toBe(true);
  });

  it('getRecord() returns a snapshot reflecting the persisted record', async () => {
    const harness = makeHarness();
    const s = await harness.session({ threadId: 't1', resourceId: 'r1' });
    const rec = s.getRecord();
    expect(rec.id).toBe(s.id);
    expect(rec.threadId).toBe('t1');
    expect(rec.resourceId).toBe('r1');
    expect(rec.closedAt).toBeUndefined();
  });
});
