/**
 * Harness v1 — durable cancellation.
 *
 * Covers the focused PF-747 slice from upstream #16912: session cancellation,
 * queued-item cancellation, resolver failure, child propagation, and pending
 * resume gating.
 */

import { describe, expect, it, vi } from 'vitest';

import type { QueueAdmissionReceipt } from '../../storage/domains/harness';

import { MockAgent, setupHarness } from './__test-utils__';
import { HarnessSessionCancelledError, HarnessValidationError } from './errors';
import type { HarnessEvent } from './events';

function deferred<T = unknown>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (err: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  void promise.catch(() => undefined);
  return { promise, resolve, reject };
}

describe('Session.cancel()', () => {
  it('persists the durable cancelRequest and emits one audit event', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const events: HarnessEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    await session.cancel({ reason: 'budget-exceeded', requestedBy: 'route:harness.cancel' });
    await session.cancel({ reason: 'second-call' });

    expect(session.getRecord().cancelRequest).toMatchObject({
      reason: 'budget-exceeded',
      requestedBy: 'route:harness.cancel',
    });
    expect(typeof session.getRecord().cancelRequest?.requestedAt).toBe('number');
    expect(events.filter(event => event.type === 'task_cancellation_requested')).toHaveLength(1);
    expect(events.find(event => event.type === 'task_cancellation_requested')).toMatchObject({
      reason: 'budget-exceeded',
      requestedBy: 'route:harness.cancel',
    });
  });

  it('drops queued items, fails receipts, emits per-item events, and rejects live resolvers', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const events: HarnessEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });
    const now = Date.now();
    const receipt = {
      admissionId: 'admission-1',
      admissionHash: 'hash-1',
      queuedItemId: 'queued-1',
      status: 'queued',
      attempts: 0,
      enqueuedAt: now,
      updatedAt: now,
    } satisfies QueueAdmissionReceipt;
    await (session as any)._flushUpdate((prev: any) => ({
      ...prev,
      pendingQueue: [
        { id: 'queued-1', admissionId: 'admission-1', enqueuedAt: now, content: 'first', attachments: [] },
        { id: 'queued-2', admissionId: 'admission-2', enqueuedAt: now + 1, content: 'second', attachments: [] },
      ],
      queueAdmissionReceipts: { 'queued-1': receipt },
    }));
    const first = deferred();
    const second = deferred();
    (session as any)._queueResolvers.set('queued-1', first);
    (session as any)._queueResolvers.set('queued-2', second);

    await session.cancel({ reason: 'stop-all' });

    expect(session.getRecord().pendingQueue).toEqual([]);
    expect(session.getRecord().queueAdmissionReceipts?.['queued-1']).toMatchObject({
      status: 'failed',
      error: { code: 'harness.session_cancelled' },
    });
    expect(events.filter(event => event.type === 'queue_item_cancelled').map(event => event.queuedItemId)).toEqual([
      'queued-1',
      'queued-2',
    ]);
    await expect(first.promise).rejects.toBeInstanceOf(HarnessSessionCancelledError);
    await expect(second.promise).rejects.toBeInstanceOf(HarnessSessionCancelledError);
  });

  it('clears delayed queue wake timers when cancellation drops queued items', async () => {
    vi.useFakeTimers();
    try {
      const { harness } = setupHarness();
      const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
      const now = Date.now();
      const queued = deferred();
      await (session as any)._flushUpdate((prev: any) => ({
        ...prev,
        pendingQueue: [
          {
            id: 'delayed',
            admissionId: 'admission-delayed',
            enqueuedAt: now,
            content: 'later',
            attachments: [],
            notBefore: now + 60_000,
          },
        ],
      }));
      (session as any)._queueResolvers.set('delayed', queued);
      (session as any)._scheduleQueueWakeupForPendingQueue();
      expect((session as any)._queueWakeTimer).toBeDefined();

      await session.cancel({ reason: 'stop-delayed' });

      expect((session as any)._queueWakeTimer).toBeUndefined();
      expect((session as any)._queueWakeAt).toBeUndefined();
      await expect(queued.promise).rejects.toBeInstanceOf(HarnessSessionCancelledError);
    } finally {
      vi.useRealTimers();
    }
  });

  it('durably fails an active queued head and aborts the running turn', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const now = Date.now();
    await (session as any)._flushUpdate((prev: any) => ({
      ...prev,
      pendingQueue: [
        { id: 'active', admissionId: 'admission-active', enqueuedAt: now, content: 'active', attachments: [] },
        { id: 'waiting', admissionId: 'admission-waiting', enqueuedAt: now + 1, content: 'waiting', attachments: [] },
      ],
    }));
    const controller = new AbortController();
    (session as any)._currentQueuedItemId = 'active';
    (session as any)._currentTurnAbortController = controller;
    const active = deferred();
    (session as any)._queueResolvers.set('active', active);

    await session.cancel({ reason: 'stop-session' });

    expect(session.getRecord().pendingQueue).toEqual([]);
    expect(controller.signal.aborted).toBe(true);
    await expect(active.promise).rejects.toBeInstanceOf(HarnessSessionCancelledError);
  });

  it('drops a queued head that has not started a turn yet', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const now = Date.now();
    await (session as any)._flushUpdate((prev: any) => ({
      ...prev,
      pendingQueue: [
        { id: 'preflight', admissionId: 'admission-preflight', enqueuedAt: now, content: 'active', attachments: [] },
      ],
    }));
    (session as any)._currentQueuedItemId = 'preflight';
    const queued = deferred();
    (session as any)._queueResolvers.set('preflight', queued);

    await session.cancel({ reason: 'cancel-before-dispatch' });

    expect(session.getRecord().pendingQueue).toEqual([]);
    expect((session as any)._currentQueuedItemId).toBeUndefined();
    await expect(queued.promise).rejects.toBeInstanceOf(HarnessSessionCancelledError);
  });

  it('resolves completed queued heads instead of converting them to cancellation', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const now = Date.now();
    const result = { text: 'done', finishReason: 'stop' };
    await (session as any)._flushUpdate((prev: any) => ({
      ...prev,
      pendingQueue: [
        { id: 'completed', admissionId: 'admission-completed', enqueuedAt: now, content: 'done', attachments: [] },
      ],
      queueAdmissionReceipts: {
        completed: {
          admissionId: 'admission-completed',
          admissionHash: 'hash-completed',
          queuedItemId: 'completed',
          status: 'completed',
          attempts: 1,
          enqueuedAt: now,
          updatedAt: now,
          postRunFinalizedAt: now,
          result,
        },
      },
    }));
    const queued = deferred();
    (session as any)._queueResolvers.set('completed', queued);

    await session.cancel({ reason: 'cancel-after-complete' });

    expect(session.getRecord().pendingQueue).toEqual([]);
    await expect(queued.promise).resolves.toBe(result);
  });

  it('finalizes completed queued heads before cancellation removes them', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const now = Date.now();
    const result = {
      text: 'done',
      finishReason: 'stop',
      runId: 'run-completed-unfinalized',
      steps: [],
    };
    await (session as any)._flushUpdate((prev: any) => ({
      ...prev,
      pendingQueue: [
        {
          id: 'completed-unfinalized',
          admissionId: 'admission-completed-unfinalized',
          enqueuedAt: now,
          content: 'done',
          attachments: [],
        },
      ],
      queueAdmissionReceipts: {
        'completed-unfinalized': {
          admissionId: 'admission-completed-unfinalized',
          admissionHash: 'hash-completed-unfinalized',
          queuedItemId: 'completed-unfinalized',
          status: 'completed',
          attempts: 1,
          enqueuedAt: now,
          updatedAt: now,
          result,
        },
      },
    }));
    const queued = deferred();
    (session as any)._queueResolvers.set('completed-unfinalized', queued);

    await session.cancel({ reason: 'cancel-after-complete-before-finalize' });

    expect(session.getRecord().pendingQueue).toEqual([]);
    expect(
      session.getRecord().queueAdmissionReceipts?.['completed-unfinalized']?.postRunFinalizedAt,
    ).toEqual(expect.any(Number));
    await expect(queued.promise).resolves.toBe(result);
  });

  it('drains restored completed queued heads after cancellation', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const now = Date.now();
    const result = {
      text: 'done',
      finishReason: 'stop',
      runId: 'run-completed-after-cancel',
      steps: [],
    };
    await (session as any)._flushUpdate((prev: any) => ({
      ...prev,
      cancelRequest: {
        requestedAt: now,
        reason: 'cancel-before-restore',
      },
      pendingQueue: [
        {
          id: 'completed-after-cancel',
          admissionId: 'admission-completed-after-cancel',
          enqueuedAt: now,
          content: 'done',
          attachments: [],
        },
      ],
      queueAdmissionReceipts: {
        'completed-after-cancel': {
          admissionId: 'admission-completed-after-cancel',
          admissionHash: 'hash-completed-after-cancel',
          queuedItemId: 'completed-after-cancel',
          status: 'completed',
          attempts: 1,
          enqueuedAt: now,
          updatedAt: now,
          result,
        },
      },
    }));
    const queued = deferred();
    (session as any)._queueResolvers.set('completed-after-cancel', queued);

    await (session as any)._kickQueueDrain();

    expect(session.getRecord().pendingQueue).toEqual([]);
    expect(session.getRecord().queueAdmissionReceipts?.['completed-after-cancel']?.postRunFinalizedAt).toEqual(
      expect.any(Number),
    );
    await expect(queued.promise).resolves.toBe(result);
  });

  it('retries completed queued head finalization after cancellation', async () => {
    vi.useFakeTimers();
    try {
      const { harness } = setupHarness();
      const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
      const now = Date.now();
      const result = {
        text: 'done',
        finishReason: 'stop',
        runId: 'run-completed-retry',
        steps: [],
      };
      await (session as any)._flushUpdate((prev: any) => ({
        ...prev,
        pendingQueue: [
          {
            id: 'completed-retry',
            admissionId: 'admission-completed-retry',
            enqueuedAt: now,
            content: 'done',
            attachments: [],
          },
        ],
        queueAdmissionReceipts: {
          'completed-retry': {
            admissionId: 'admission-completed-retry',
            admissionHash: 'hash-completed-retry',
            queuedItemId: 'completed-retry',
            status: 'completed',
            attempts: 1,
            enqueuedAt: now,
            updatedAt: now,
            result,
          },
        },
      }));
      const originalMarkPostRunFinalized = (session as any)._markQueuedPostRunFinalized.bind(session);
      let attempts = 0;
      (session as any)._markQueuedPostRunFinalized = async (...args: unknown[]) => {
        attempts += 1;
        if (attempts <= 2) throw new Error('transient finalization write failure');
        return originalMarkPostRunFinalized(...args);
      };
      const queued = deferred();
      (session as any)._queueResolvers.set('completed-retry', queued);

      await session.cancel({ reason: 'cancel-after-complete-before-finalize' });

      expect(session.getRecord().pendingQueue.map(item => item.id)).toEqual(['completed-retry']);
      await vi.advanceTimersByTimeAsync(1_000);
      expect(session.getRecord().pendingQueue.map(item => item.id)).toEqual(['completed-retry']);
      await vi.advanceTimersByTimeAsync(1_000);

      expect(session.getRecord().pendingQueue).toEqual([]);
      expect(session.getRecord().queueAdmissionReceipts?.['completed-retry']?.postRunFinalizedAt).toEqual(
        expect.any(Number),
      );
      await expect(queued.promise).resolves.toBe(result);
    } finally {
      vi.useRealTimers();
    }
  });

  it('continues settling completed queued heads after one finalization failure', async () => {
    vi.useFakeTimers();
    try {
      const { harness } = setupHarness();
      const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
      const now = Date.now();
      const firstResult = {
        text: 'first done',
        finishReason: 'stop',
        runId: 'run-completed-first',
        steps: [],
      };
      const secondResult = {
        text: 'second done',
        finishReason: 'stop',
        runId: 'run-completed-second',
        steps: [],
      };
      await (session as any)._flushUpdate((prev: any) => ({
        ...prev,
        pendingQueue: [
          {
            id: 'completed-first',
            admissionId: 'admission-completed-first',
            enqueuedAt: now,
            content: 'first',
            attachments: [],
          },
          {
            id: 'completed-second',
            admissionId: 'admission-completed-second',
            enqueuedAt: now + 1,
            content: 'second',
            attachments: [],
          },
        ],
        queueAdmissionReceipts: {
          'completed-first': {
            admissionId: 'admission-completed-first',
            admissionHash: 'hash-completed-first',
            queuedItemId: 'completed-first',
            status: 'completed',
            attempts: 1,
            enqueuedAt: now,
            updatedAt: now,
            result: firstResult,
          },
          'completed-second': {
            admissionId: 'admission-completed-second',
            admissionHash: 'hash-completed-second',
            queuedItemId: 'completed-second',
            status: 'completed',
            attempts: 1,
            enqueuedAt: now + 1,
            updatedAt: now + 1,
            result: secondResult,
          },
        },
      }));
      const originalMarkPostRunFinalized = (session as any)._markQueuedPostRunFinalized.bind(session);
      const seen = new Set<string>();
      (session as any)._markQueuedPostRunFinalized = async (queuedItemId: string, ...args: unknown[]) => {
        if (queuedItemId === 'completed-first' && !seen.has(queuedItemId)) {
          seen.add(queuedItemId);
          throw new Error('transient first finalization write failure');
        }
        return originalMarkPostRunFinalized(queuedItemId, ...args);
      };
      const first = deferred();
      const second = deferred();
      (session as any)._queueResolvers.set('completed-first', first);
      (session as any)._queueResolvers.set('completed-second', second);

      await session.cancel({ reason: 'cancel-two-completed' });

      expect(session.getRecord().pendingQueue.map(item => item.id)).toEqual(['completed-first']);
      expect(session.getRecord().queueAdmissionReceipts?.['completed-second']?.postRunFinalizedAt).toEqual(
        expect.any(Number),
      );
      await expect(second.promise).resolves.toBe(secondResult);

      await vi.advanceTimersByTimeAsync(1_000);

      expect(session.getRecord().pendingQueue).toEqual([]);
      expect(session.getRecord().queueAdmissionReceipts?.['completed-first']?.postRunFinalizedAt).toEqual(
        expect.any(Number),
      );
      await expect(first.promise).resolves.toBe(firstResult);
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears a suspended queued head and rejects its resolver', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const now = Date.now();
    await (session as any)._flushUpdate((prev: any) => ({
      ...prev,
      pendingQueue: [
        { id: 'suspended', admissionId: 'admission-suspended', enqueuedAt: now, content: 'active', attachments: [] },
      ],
      pendingResume: {
        kind: 'tool-approval',
        runId: 'run-suspended',
        toolCallId: 'tool-call-suspended',
        queuedItemId: 'suspended',
        source: 'parent',
        requestedAt: now,
      },
    }));
    (session as any)._currentQueuedItemId = 'suspended';
    const queued = deferred();
    (session as any)._queueResolvers.set('suspended', queued);
    const idle = session.waitForIdle({ timeoutMs: 100 });

    await session.cancel({ reason: 'cancel-suspended' });

    expect(session.getRecord().pendingQueue).toEqual([]);
    expect(session.getRecord().pendingResume?.queuedItemId).toBe('suspended');
    expect((session as any)._currentQueuedItemId).toBeUndefined();
    expect(session.isBusy()).toBe(false);
    await expect(idle).resolves.toBeUndefined();
    await expect(queued.promise).rejects.toBeInstanceOf(HarnessSessionCancelledError);
  });

  it('keeps already-resumed pending interaction evidence after cancellation', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const now = Date.now();
    await (session as any)._flushUpdate((prev: any) => ({
      ...prev,
      pendingResume: {
        kind: 'tool-approval',
        runId: 'run-resumed',
        toolCallId: 'tool-call-resumed',
        source: 'parent',
        requestedAt: now,
        resumedAt: now + 1,
      },
    }));
    const idle = session.waitForIdle({ timeoutMs: 100 });

    await session.cancel({ reason: 'cancel-resumed' });

    expect(session.getRecord().pendingResume?.resumedAt).toBe(now + 1);
    expect(session.isBusy()).toBe(false);
    await expect(idle).resolves.toBeUndefined();
  });

  it('rejects new message and queue turns after cancellation', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    await session.cancel({ reason: 'no-new-work' });

    await expect(session.message({ content: 'after cancel' })).rejects.toBeInstanceOf(HarnessSessionCancelledError);
    await expect(session.queue({ content: 'after cancel' })).rejects.toBeInstanceOf(HarnessSessionCancelledError);
    await expect(session.signal({ content: 'after cancel' })).rejects.toBeInstanceOf(HarnessSessionCancelledError);
    await expect(session.injectSystemReminder('after cancel')).rejects.toBeInstanceOf(HarnessSessionCancelledError);
  });

  it('aborts an in-flight turn only after the cancel marker is durable', async () => {
    const { harness, agent } = setupHarness();
    let release!: () => void;
    const holdUntil = new Promise<void>(resolve => {
      release = resolve;
    });
    let abortReason: unknown;
    agent.enqueueRun({ holdUntil, onAbort: reason => (abortReason = reason) });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const run = session.message({ content: 'long running' });
    await new Promise(resolve => setImmediate(resolve));

    await session.cancel({ reason: 'operator-stop' });
    release();
    await run;

    expect(session.getRecord().cancelRequest?.reason).toBe('operator-stop');
    expect(abortReason).toBe('operator-stop');
  });

  it('propagates cancellation to live child sessions but not upward', async () => {
    const { harness } = setupHarness();
    const parent = await harness.session({ resourceId: 'u-parent', threadId: { fresh: true } });
    const child = await harness.session({ resourceId: 'u-child', threadId: { fresh: true } });
    (parent as any)._activeSubagents.set('tool-call-1', {
      subagentSessionId: child.id,
      agentType: 'default',
      task: 'child task',
      parentToolCallId: 'tool-call-1',
      startedAt: Date.now(),
    });

    await parent.cancel({ reason: 'parent-cancel' });

    expect(child.getRecord().cancelRequest).toMatchObject({
      reason: 'parent-cancel',
      requestedBy: parent.id,
    });

    const otherParent = await harness.session({ resourceId: 'u-other-parent', threadId: { fresh: true } });
    const otherChild = await harness.session({ resourceId: 'u-other-child', threadId: { fresh: true } });
    (otherParent as any)._activeSubagents.set('tool-call-2', {
      subagentSessionId: otherChild.id,
      agentType: 'default',
      task: 'child task',
      parentToolCallId: 'tool-call-2',
      startedAt: Date.now(),
    });

    await otherChild.cancel({ reason: 'child-only' });

    expect(otherChild.getRecord().cancelRequest?.reason).toBe('child-only');
    expect(otherParent.getRecord().cancelRequest).toBeUndefined();
  });
});

describe('Session.cancelQueuedItem()', () => {
  it('removes only the targeted queued item and rejects its resolver', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const now = Date.now();
    await (session as any)._flushUpdate((prev: any) => ({
      ...prev,
      pendingQueue: [
        { id: 'queued-1', admissionId: 'admission-1', enqueuedAt: now, content: 'first', attachments: [] },
        { id: 'queued-2', admissionId: 'admission-2', enqueuedAt: now + 1, content: 'second', attachments: [] },
      ],
    }));
    const second = deferred();
    (session as any)._queueResolvers.set('queued-2', second);

    await session.cancelQueuedItem({ queuedItemId: 'queued-2', reason: 'single-drop' });

    expect(session.getRecord().cancelRequest).toBeUndefined();
    expect(session.getRecord().pendingQueue.map(item => item.id)).toEqual(['queued-1']);
    await expect(second.promise).rejects.toBeInstanceOf(HarnessSessionCancelledError);
  });

  it('does not remove a suspended queued item represented only by pendingResume', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const now = Date.now();
    await (session as any)._flushUpdate((prev: any) => ({
      ...prev,
      pendingQueue: [
        { id: 'suspended', admissionId: 'admission-suspended', enqueuedAt: now, content: 'first', attachments: [] },
      ],
      pendingResume: {
        kind: 'tool-approval',
        runId: 'run-suspended',
        toolCallId: 'tool-call-suspended',
        queuedItemId: 'suspended',
        source: 'parent',
        requestedAt: now,
      },
    }));

    await session.cancelQueuedItem({ queuedItemId: 'suspended', reason: 'single-drop' });

    expect(session.getRecord().pendingQueue.map(item => item.id)).toEqual(['suspended']);
    expect(session.getRecord().pendingResume?.queuedItemId).toBe('suspended');
  });

  it('does not remove the queue head because it can race with drain startup', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const now = Date.now();
    await (session as any)._flushUpdate((prev: any) => ({
      ...prev,
      pendingQueue: [
        { id: 'queued-head', admissionId: 'admission-head', enqueuedAt: now, content: 'first', attachments: [] },
        { id: 'queued-tail', admissionId: 'admission-tail', enqueuedAt: now + 1, content: 'second', attachments: [] },
      ],
    }));

    await session.cancelQueuedItem({ queuedItemId: 'queued-head', reason: 'single-drop' });

    expect(session.getRecord().pendingQueue.map(item => item.id)).toEqual(['queued-head', 'queued-tail']);
  });

  it('does not cancel terminal queue receipts', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const events: HarnessEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });
    const now = Date.now();
    const result = { text: 'done', finishReason: 'stop' };
    await (session as any)._flushUpdate((prev: any) => ({
      ...prev,
      pendingQueue: [
        { id: 'completed', admissionId: 'admission-completed', enqueuedAt: now, content: 'done', attachments: [] },
      ],
      queueAdmissionReceipts: {
        completed: {
          admissionId: 'admission-completed',
          admissionHash: 'hash-completed',
          queuedItemId: 'completed',
          status: 'completed',
          attempts: 1,
          enqueuedAt: now,
          updatedAt: now,
          result,
        },
      },
    }));

    await session.cancelQueuedItem({ queuedItemId: 'completed', reason: 'single-drop' });

    expect(session.getRecord().pendingQueue.map(item => item.id)).toEqual(['completed']);
    expect(events.filter(event => event.type === 'queue_item_cancelled')).toHaveLength(0);
  });

  it('is a no-op for unknown queuedItemIds and validates empty ids', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const events: HarnessEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    await session.cancelQueuedItem({ queuedItemId: 'missing' });

    expect(events.filter(event => event.type === 'queue_item_cancelled')).toHaveLength(0);
    await expect(session.cancelQueuedItem({ queuedItemId: '' })).rejects.toBeInstanceOf(HarnessValidationError);
  });
});

describe('Session.cancel() resume gating', () => {
  it('refuses to resume a pending interaction after cancellation', async () => {
    const { harness, agent } = setupHarness({ agents: { default: new MockAgent({ id: 'default' }) } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await (session as any)._flushUpdate((prev: any) => ({
      ...prev,
      pendingResume: {
        kind: 'tool-approval',
        runId: 'run-1',
        toolCallId: 'tool-call-1',
        itemId: 'item-1',
        toolName: 'dangerousTool',
        source: 'parent',
        requestedAt: Date.now(),
      },
    }));

    await session.cancel({ reason: 'cancel-before-resume' });

    await expect(session.respondToToolApproval({ approved: true })).rejects.toBeInstanceOf(
      HarnessSessionCancelledError,
    );
    expect(agent.resumeCalls).toHaveLength(0);
    expect(session.getRecord().pendingResume?.toolCallId).toBe('tool-call-1');
  });
});
