/**
 * Harness v1 — discrete Session accessors (§4.2).
 *
 * This ports the fork coverage for the status/readback surface that can land
 * before the full message and queue drain runtime: busy/running state,
 * queue-depth reads, token-usage copy semantics, and wait-for-idle boundaries.
 */
import { describe, expect, it } from 'vitest';

import { Agent } from '../../agent';
import type { SessionRecord } from '../../storage/domains/harness';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { Harness } from './harness';

function makeAgent(name = 'default') {
  return new Agent({
    id: name,
    name,
    instructions: 'test',
    model: 'openai/gpt-4o-mini' as any,
  });
}

function setupHarness() {
  const storage = new InMemoryHarness({ db: new InMemoryDB() });
  const harness = new Harness({
    agents: { default: makeAgent() },
    modes: [{ id: 'default', agentId: 'default' }],
    defaultModeId: 'default',
    sessions: { storage },
  });
  return { harness, storage };
}

function queueRecord(session: { getRecord(): Readonly<SessionRecord> }, id = 'queued-1') {
  (session.getRecord() as SessionRecord).pendingQueue = [
    {
      id,
      enqueuedAt: Date.now(),
      content: 'queued',
      attachments: [],
      source: 'user',
    },
  ];
}

describe('Session discrete accessors', () => {
  it('reports idle/running/queue state for a fresh session', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'r1', threadId: { fresh: true } });

    expect(session.isRunning()).toBe(false);
    expect(session.isBusy()).toBe(false);
    expect(session.getQueueDepth()).toBe(0);
    expect(session.getCurrentRunId()).toBeNull();
    expect(session.getCurrentTraceId()).toBeNull();
    await expect(session.waitForIdle()).resolves.toBeUndefined();
  });

  it('exposes the session creation timestamp from the record', async () => {
    const { harness } = setupHarness();
    const before = Date.now();
    const session = await harness.session({ resourceId: 'r1', threadId: { fresh: true } });
    const after = Date.now();

    expect(session.createdAt).toBeGreaterThanOrEqual(before);
    expect(session.createdAt).toBeLessThanOrEqual(after);
  });

  it('reflects pendingQueue in getQueueDepth and isBusy', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'r1', threadId: { fresh: true } });

    queueRecord(session);

    expect(session.getQueueDepth()).toBe(1);
    expect(session.isRunning()).toBe(false);
    expect(session.isBusy()).toBe(true);
  });

  it('getTokenUsage returns a fresh copy of the persisted aggregate', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'r1', threadId: { fresh: true } });
    (session.getRecord() as SessionRecord).tokenUsage = {
      promptTokens: 3,
      completionTokens: 5,
      totalTokens: 8,
    };

    const snapshot = session.getTokenUsage();
    snapshot.promptTokens = 999;

    expect(session.getTokenUsage()).toEqual({ promptTokens: 3, completionTokens: 5, totalTokens: 8 });
  });

  it('waitForIdle resolves after pending queue state clears and a flush observes idleness', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'r1', threadId: { fresh: true } });
    queueRecord(session);

    const idle = session.waitForIdle();
    let resolved = false;
    void idle.then(() => {
      resolved = true;
    });

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(resolved).toBe(false);

    (session.getRecord() as SessionRecord).pendingQueue = [];
    await session.setState({ touched: true });
    await idle;
    expect(session.isBusy()).toBe(false);
  });

  it('waitForIdle rejects when timeoutMs elapses', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'r1', threadId: { fresh: true } });
    queueRecord(session);

    await expect(session.waitForIdle({ timeoutMs: 20 })).rejects.toMatchObject({
      name: 'HarnessValidationError',
    });
  });

  it('waitForIdle rejects when the session closes while waiting', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'r1', threadId: { fresh: true } });
    queueRecord(session);

    const idle = session.waitForIdle();
    const rejection = expect(idle).rejects.toMatchObject({ name: 'HarnessSessionClosedError' });
    await session.close();

    await rejection;
  });
});
