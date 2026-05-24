/**
 * Harness v1 — session-level cancellation (PF-665 sub-slice A).
 *
 * Covers `Session.cancel(...)` and `Session.cancelQueuedItem(...)`:
 *   - durable `cancelRequest` round-trip
 *   - idempotency (first cancel wins)
 *   - `task_cancellation_requested` event + per-item
 *     `queue_item_cancelled` events
 *   - queue resolvers reject with `HarnessSessionCancelledError`
 *   - in-flight turn aborts on cancel
 *   - heartbeat short-circuit on cancelled sessions
 */

import { describe, expect, it, vi } from 'vitest';

import { Agent } from '../../agent';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { buildFakeOutput } from './__test-utils__/fake-output';

import { HarnessSessionCancelledError } from './errors';
import type { HarnessEvent } from './events';
import { Harness } from './harness';

class FakeAgent extends Agent<any, any, any> {
  chunks: any[] = [];
  fullOutput: any = {
    text: 'ok',
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    finishReason: 'stop',
    object: undefined,
    steps: [],
    warnings: [],
    providerMetadata: undefined,
    request: {},
    reasoning: [],
    reasoningText: undefined,
    toolCalls: [],
    toolResults: [],
    sources: [],
    files: [],
    response: { id: 'r', timestamp: new Date(), modelId: 'fake', messages: [], uiMessages: [] },
    totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    error: undefined,
    tripwire: undefined,
    traceId: undefined,
    spanId: undefined,
    runId: 'fake-run',
    suspendPayload: undefined,
    messages: [],
    rememberedMessages: [],
  };
  constructor(name: string) {
    super({ id: name, name, instructions: 'fake', model: 'openai/gpt-4o-mini' as any });
  }
  async stream(_messages: any, options?: any): Promise<any> {
    const out = buildFakeOutput({
      runId: options?.runId ?? this.fullOutput.runId,
      fullOutput: this.fullOutput,
      chunks: this.chunks,
    });
    this._internalRegisterStreamRun(out, (options ?? {}) as any);
    return out;
  }
  async generate(_messages: any, _options?: any): Promise<any> {
    return this.fullOutput;
  }
  async resumeStream(_resumeData: any, options?: any): Promise<any> {
    return this.stream(undefined, options);
  }
}

function makeDeferred(): {
  promise: Promise<any>;
  resolve: (v: any) => void;
  reject: (err: unknown) => void;
} {
  let resolve!: (v: any) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  // Swallow the unhandled-rejection — the test asserts via .rejects.
  promise.catch(() => {});
  return { promise, resolve, reject };
}

async function setup() {
  const agent = new FakeAgent('default');
  const storage = new InMemoryHarness({ db: new InMemoryDB() });
  const harness = new Harness({
    agents: { default: agent } as any,
    modes: [{ id: 'default', agentId: 'default' }],
    defaultModeId: 'default',
    sessions: { storage },
  });
  const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
  return { harness, session, storage };
}

describe('Session.cancel — durable session cancellation', () => {
  it('persists cancelRequest on the SessionRecord', async () => {
    const { session } = await setup();
    await session.cancel({ reason: 'user-aborted', requestedBy: 'cli' });
    const rec = session.getRecord();
    expect(rec.cancelRequest).toMatchObject({
      reason: 'user-aborted',
      requestedBy: 'cli',
    });
    expect(typeof rec.cancelRequest?.requestedAt).toBe('number');
  });

  it('emits task_cancellation_requested with the supplied reason + requestedBy', async () => {
    const { session } = await setup();
    const events: HarnessEvent[] = [];
    session.subscribe(e => events.push(e));
    await session.cancel({ reason: 'budget-exceeded', requestedBy: 'system' });
    const cancelled = events.find(e => e.type === 'task_cancellation_requested') as any;
    expect(cancelled).toMatchObject({
      reason: 'budget-exceeded',
      requestedBy: 'system',
    });
  });

  it('is idempotent — first reason wins, second call is a no-op', async () => {
    const { session } = await setup();
    const events: HarnessEvent[] = [];
    session.subscribe(e => events.push(e));
    await session.cancel({ reason: 'first' });
    await session.cancel({ reason: 'second' });
    const requested = events.filter(e => e.type === 'task_cancellation_requested') as any[];
    expect(requested).toHaveLength(1);
    expect(requested[0].reason).toBe('first');
  });

  it('cancel of an idle session resolves immediately and persists', async () => {
    const { session, storage } = await setup();
    await session.cancel({ reason: 'idle-cancel' });
    const reloaded = await storage.loadSession({
      harnessName: session.getRecord().harnessName,
      sessionId: session.id,
    });
    expect(reloaded?.cancelRequest?.reason).toBe('idle-cancel');
  });

  it('emits queue_item_cancelled per dropped queued item and rejects the queue promises', async () => {
    const { session } = await setup();
    const events: HarnessEvent[] = [];
    session.subscribe(e => events.push(e));
    // Seed pendingQueue directly so the FakeAgent's instant drain
    // doesn't race the cancel. Each item registers a resolver so
    // cancel can reject it.
    await (session as any)._flushUpdate((prev: any) => ({
      ...prev,
      pendingQueue: [
        ...(prev.pendingQueue ?? []),
        { id: 'q-1', admissionId: 'a-1', enqueuedAt: 1, content: 'first', attachments: [] },
        { id: 'q-2', admissionId: 'a-2', enqueuedAt: 2, content: 'second', attachments: [] },
      ],
    }));
    const deferred1 = makeDeferred();
    const deferred2 = makeDeferred();
    (session as any)._queueResolvers.set('q-1', deferred1);
    (session as any)._queueResolvers.set('q-2', deferred2);
    await session.cancel({ reason: 'drop-queue' });
    const cancelled = events.filter(e => e.type === 'queue_item_cancelled') as any[];
    expect(cancelled).toHaveLength(2);
    expect(cancelled.map(e => e.queuedItemId).sort()).toEqual(['q-1', 'q-2']);
    await expect(deferred1.promise).rejects.toBeInstanceOf(HarnessSessionCancelledError);
    await expect(deferred2.promise).rejects.toBeInstanceOf(HarnessSessionCancelledError);
    expect(session.getRecord().pendingQueue).toEqual([]);
  });

  it('concurrent cancels emit task_cancellation_requested exactly once', async () => {
    const { session } = await setup();
    const events: HarnessEvent[] = [];
    session.subscribe(e => events.push(e));
    // Fire two cancels with overlapping timing. The second loses the
    // CAS but should not double-emit the verdict event or double-abort.
    await Promise.all([session.cancel({ reason: 'first' }), session.cancel({ reason: 'second' })]);
    const requested = events.filter(e => e.type === 'task_cancellation_requested');
    expect(requested).toHaveLength(1);
    const winner = requested[0] as any;
    expect(winner.reason).toBe('first');
  });

  it('marks failed status on queueAdmissionReceipts for cancelled items', async () => {
    const { session } = await setup();
    await (session as any)._flushUpdate((prev: any) => ({
      ...prev,
      pendingQueue: [{ id: 'q-receipt', admissionId: 'a-receipt', enqueuedAt: 1, content: 'x', attachments: [] }],
      queueAdmissionReceipts: {
        'q-receipt': {
          admissionId: 'a-receipt',
          admissionHash: 'hash',
          queuedItemId: 'q-receipt',
          status: 'queued',
          attempts: 0,
          enqueuedAt: 1,
          updatedAt: 1,
        },
      },
    }));
    await session.cancel({ reason: 'mark-failed' });
    const receipt = (session.getRecord().queueAdmissionReceipts ?? {})['q-receipt'];
    expect(receipt?.status).toBe('failed');
    expect(receipt?.failedAt).toBeDefined();
  });

  it('does not remove the currently-running queued head', async () => {
    const { session } = await setup();
    await (session as any)._flushUpdate((prev: any) => ({
      ...prev,
      pendingQueue: [
        { id: 'q-active', admissionId: 'a-active', enqueuedAt: 1, content: 'active', attachments: [] },
        { id: 'q-pending', admissionId: 'a-pending', enqueuedAt: 2, content: 'pending', attachments: [] },
      ],
    }));
    (session as any)._currentQueuedItemId = 'q-active';
    await session.cancel({ reason: 'keep-active' });
    const queue = session.getRecord().pendingQueue ?? [];
    expect(queue.map(i => i.id)).toEqual(['q-active']);
  });

  it('aborts the in-flight turn when called', async () => {
    const { session } = await setup();
    // Stub controller to observe abort
    const controller = new AbortController();
    (session as any)._currentTurnAbortController = controller;
    let aborted = false;
    controller.signal.addEventListener('abort', () => {
      aborted = true;
    });
    await session.cancel({ reason: 'cancel-aborts' });
    expect(aborted).toBe(true);
  });
});

describe('Session.cancelQueuedItem — fine-grained queue cancel', () => {
  async function seedQueue(session: any, ids: string[]) {
    await session._flushUpdate((prev: any) => ({
      ...prev,
      pendingQueue: [
        ...(prev.pendingQueue ?? []),
        ...ids.map((id, idx) => ({ id, admissionId: `a-${id}`, enqueuedAt: 1 + idx, content: id, attachments: [] })),
      ],
    }));
  }

  it('removes only the targeted item and rejects its promise', async () => {
    const { session } = await setup();
    const events: HarnessEvent[] = [];
    session.subscribe(e => events.push(e));
    await seedQueue(session, ['q-1', 'q-2']);
    const d1 = makeDeferred();
    (session as any)._queueResolvers.set('q-1', d1);
    await session.cancelQueuedItem({ queuedItemId: 'q-1', reason: 'just-q1' });
    const cancelled = events.filter(e => e.type === 'queue_item_cancelled') as any[];
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0].queuedItemId).toBe('q-1');
    await expect(d1.promise).rejects.toBeInstanceOf(HarnessSessionCancelledError);
    // q-2 is still in the queue.
    const queue = session.getRecord().pendingQueue ?? [];
    expect(queue.some(item => item.id === 'q-2')).toBe(true);
    expect(queue.some(item => item.id === 'q-1')).toBe(false);
  });

  it('is a no-op for unknown queuedItemIds', async () => {
    const { session } = await setup();
    const events: HarnessEvent[] = [];
    session.subscribe(e => events.push(e));
    await session.cancelQueuedItem({ queuedItemId: 'does-not-exist', reason: 'ignored' });
    expect(events.filter(e => e.type === 'queue_item_cancelled')).toHaveLength(0);
  });

  it('does NOT mark the session-wide cancelRequest', async () => {
    const { session } = await setup();
    await seedQueue(session, ['q-1']);
    await session.cancelQueuedItem({ queuedItemId: 'q-1' });
    expect(session.getRecord().cancelRequest).toBeUndefined();
  });
});

describe('Session.cancel — subagent-tree propagation', () => {
  it('cascades cancel to every live subagent in the tree', async () => {
    const { harness, session } = await setup();
    // Create a child session and register it as an active subagent on
    // the parent. Use the harness session() factory so the child is
    // registered in `_liveSessions` and looks up via the new
    // `_internalGetLiveSession` shim.
    const child1 = await harness.session({ resourceId: 'u2', threadId: { fresh: true } });
    const child2 = await harness.session({ resourceId: 'u3', threadId: { fresh: true } });
    (session as any)._activeSubagents.set('tc-1', {
      subagentSessionId: child1.id,
      agentType: 'default',
      task: 't1',
      parentToolCallId: 'tc-1',
      startedAt: 1,
    });
    (session as any)._activeSubagents.set('tc-2', {
      subagentSessionId: child2.id,
      agentType: 'default',
      task: 't2',
      parentToolCallId: 'tc-2',
      startedAt: 2,
    });
    await session.cancel({ reason: 'cascade' });
    expect(child1.getRecord().cancelRequest).toBeDefined();
    expect(child2.getRecord().cancelRequest).toBeDefined();
    expect(child1.getRecord().cancelRequest?.requestedBy).toBe(session.id);
    expect(child2.getRecord().cancelRequest?.requestedBy).toBe(session.id);
  });

  it('does NOT propagate upward — cancelling a subagent leaves the parent untouched', async () => {
    const { harness, session: parent } = await setup();
    const child = await harness.session({ resourceId: 'u2', threadId: { fresh: true } });
    (parent as any)._activeSubagents.set('tc-1', {
      subagentSessionId: child.id,
      agentType: 'default',
      task: 't1',
      parentToolCallId: 'tc-1',
      startedAt: 1,
    });
    await child.cancel({ reason: 'child-only' });
    expect(child.getRecord().cancelRequest).toBeDefined();
    // Parent untouched.
    expect(parent.getRecord().cancelRequest).toBeUndefined();
  });
});

describe('Session.cancel — resume gating', () => {
  it('refuses to resume a pending interaction when cancelRequest is set', async () => {
    const { session } = await setup();
    // Manually wire a pendingResume so we can attempt to resume it.
    await (session as any)._flushUpdate((prev: any) => ({
      ...prev,
      pendingResume: {
        kind: 'tool-approval',
        runId: 'run-1',
        itemId: 'item-1',
        toolCallId: 'tc-1',
        source: 'parent',
        requestedAt: 0,
      },
    }));
    await session.cancel({ reason: 'no-resume' });
    // Now attempt to resume — should throw HarnessSessionCancelledError.
    await expect(session.respondToToolApproval({ approved: true })).rejects.toBeInstanceOf(
      HarnessSessionCancelledError,
    );
  });
});

describe('Heartbeat — cancel short-circuits lease renewal', () => {
  it('the heartbeat does not call renewSessionLease on cancelled sessions', async () => {
    const { harness, session, storage } = await setup();
    await session.cancel({ reason: 'no-renew' });
    const spy = vi.spyOn(storage, 'renewSessionLease');
    // Hit the heartbeat loop directly. Cancelled sessions must not
    // be passed to renewSessionLease.
    await (harness as any)._renewLiveSessionLeases();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
