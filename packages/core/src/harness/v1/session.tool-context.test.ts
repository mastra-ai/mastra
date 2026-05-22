/**
 * Harness v1 — HarnessRequestContext (§6.1).
 *
 * These tests check the slot the harness exposes to tools via
 * `requestContext.get('harness')`. They run against `MockAgent`, which
 * records every `stream`/`generate` call's options — including the
 * RequestContext we hand it. That lets us assert the slot's identity
 * fields, state reads/writes, abort plumbing, and event emission without
 * actually wiring a real tool execution.
 */

import { describe, expect, it, vi } from 'vitest';

import { setupHarness } from './__test-utils__/setup';
import { HarnessStateConflictError, HarnessValidationError } from './errors';
import type { HarnessRequestContext } from './types';

function getHarnessSlot(streamCalls: any[]): HarnessRequestContext {
  const ctx = streamCalls.at(-1)!.options.requestContext;
  expect(ctx).toBeDefined();
  const slot = ctx.get('harness');
  expect(slot).toBeDefined();
  return slot as HarnessRequestContext;
}

describe('HarnessRequestContext — identity fields', () => {
  it('populates harnessId / sessionId / threadId / resourceId / modeId', async () => {
    const { harness, agent } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.message({ content: 'hi' });

    const slot = getHarnessSlot(agent.streamCalls);
    expect(slot.harnessId).toBe(harness.ownerId);
    expect(slot.sessionId).toBe(session.id);
    expect(slot.threadId).toBe(session.threadId);
    expect(slot.resourceId).toBe('u1');
    expect(slot.modeId).toBe('default');
    expect(slot.modelId).toBeUndefined();
    expect(slot.source).toBe('parent');
    expect(slot.subagentDepth).toBe(0);
    expect(slot.parentSessionId).toBeUndefined();
  });

  it('reflects per-turn mode and model overrides', async () => {
    const { harness, agent } = setupHarness({
      modes: [
        { id: 'modeA', agentId: 'default' },
        { id: 'modeB', agentId: 'default' },
      ],
      defaultModeId: 'modeA',
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.message({ content: 'hi', mode: 'modeB', model: 'openai/gpt-5.5' });
    const slot = getHarnessSlot(agent.streamCalls);
    expect(slot.modeId).toBe('modeB');
    expect(slot.modelId).toBe('openai/gpt-5.5');
  });
});

describe('HarnessRequestContext — state reads/writes', () => {
  it('exposes a state snapshot that reflects setState writes', async () => {
    const { harness, agent } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.setState<{ counter: number }>({ counter: 5 });
    await session.message({ content: 'hi' });

    const slot = getHarnessSlot(agent.streamCalls);
    expect(slot.state).toEqual({ counter: 5 });
    expect(slot.getState()).toEqual({ counter: 5 });
  });

  it('object-form setState shallow-merges into state', async () => {
    const { harness, agent } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.setState<{ a: number; b?: number }>({ a: 1 });
    await session.message({ content: 'hi' });
    const slot = getHarnessSlot(agent.streamCalls);

    await slot.setState({ b: 2 });
    expect(await session.getState()).toEqual({ a: 1, b: 2 });
  });

  it('functional-form setState runs an atomic read-modify-write', async () => {
    const { harness, agent } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.setState<{ counter: number }>({ counter: 0 });
    await session.message({ content: 'hi' });
    const slot = getHarnessSlot(agent.streamCalls);

    await Promise.all([
      slot.setState((prev: { counter: number }) => ({ counter: prev.counter + 1 })),
      slot.setState((prev: { counter: number }) => ({ counter: prev.counter + 1 })),
      slot.setState((prev: { counter: number }) => ({ counter: prev.counter + 1 })),
    ]);
    expect(await session.getState()).toEqual({ counter: 3 });
  });

  it('updateState derives updates inside the serialized state mutation queue', async () => {
    const { harness, agent } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.setState<{ counter: number }>({ counter: 0 });
    await session.message({ content: 'hi' });
    const slot = getHarnessSlot(agent.streamCalls);

    await Promise.all([
      slot.updateState!(async state => {
        await Promise.resolve();
        return {
          updates: { counter: (state as { counter: number }).counter + 1 },
          result: 'first',
        };
      }),
      slot.updateState!(state => ({
        updates: { counter: (state as { counter: number }).counter + 1 },
        result: 'second',
      })),
    ]);

    expect(await session.getState()).toEqual({ counter: 2 });
  });

  it('updateState exposes an immutable snapshot and only persists explicit updates', async () => {
    const { harness, agent } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.setState<{ nested: { items: string[] }; kept: boolean }>({ nested: { items: ['a'] }, kept: true });
    await session.message({ content: 'hi' });
    const slot = getHarnessSlot(agent.streamCalls);

    await expect(
      slot.updateState!(state => {
        (state as { nested: { items: string[] } }).nested.items.push('leaked');
        return { result: 'done' };
      }),
    ).rejects.toBeInstanceOf(TypeError);
    await expect(session.getState()).resolves.toEqual({ nested: { items: ['a'] }, kept: true });
  });

  it('rejects setState when ifVersion no longer matches at the mutation point', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const version = session._internalRecordVersion;
    await session.setState({ first: true });

    await expect(session.setState({ stale: true }, { ifVersion: version })).rejects.toBeInstanceOf(
      HarnessStateConflictError,
    );
    await expect(session.getState()).resolves.toEqual({ first: true });
  });
});

describe('HarnessRequestContext — abort plumbing', () => {
  it('aborts the slot signal when the caller-supplied signal aborts', async () => {
    const { harness, agent } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const controller = new AbortController();
    await session.message({ content: 'hi', abortSignal: controller.signal });

    const slot = getHarnessSlot(agent.streamCalls);
    expect(slot.abortSignal).toBeInstanceOf(AbortSignal);
    expect(slot.abortSignal).not.toBe(controller.signal);
    controller.abort('caller-cancelled');
    expect(slot.abortSignal.aborted).toBe(true);
  });

  it('mints a fresh signal when the caller did not supply one', async () => {
    const { harness, agent } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.message({ content: 'hi' });

    const slot = getHarnessSlot(agent.streamCalls);
    expect(slot.abortSignal).toBeInstanceOf(AbortSignal);
    expect(slot.abortSignal.aborted).toBe(false);
  });
});

describe('HarnessRequestContext — queued turns', () => {
  it('queued turn surfaces the same slot shape to tools', async () => {
    const { harness, agent } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.queue({ content: 'queued' });
    // Drain to completion.
    await new Promise(r => setImmediate(r));

    const slot = getHarnessSlot(agent.streamCalls);
    expect(slot.sessionId).toBe(session.id);
    expect(slot.modeId).toBe('default');
    expect(slot.abortSignal).toBeInstanceOf(AbortSignal);
  });

  it('wakeup-admitted queued turns surface persisted app and channel context slots', async () => {
    const { harness, agent } = setupHarness();
    agent.enqueueRun({ finishReason: 'stop', text: 'wakeup reply' });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const admitted = await (session as any)._admitWakeupQueue({
      content: 'scheduled work',
      admissionId: 'wakeup-admission-1',
      attachments: [],
      requestContext: {
        metadata: { appId: 'scheduler' },
        channel: {
          origin: 'inbound',
          harnessName: 'default',
          channelId: 'slack-main',
          providerId: 'slack',
          platform: 'slack',
          externalThreadId: 'thread-1',
          externalMessageId: 'message-1',
          actor: { platformUserId: 'user-1', displayName: 'Ada' },
        },
      },
    });
    await session.waitForIdle({ timeoutMs: 1000 });

    expect(admitted).toMatchObject({ accepted: true, queuedItemId: expect.any(String), duplicate: false });
    const requestContext = agent.streamCalls.at(-1)!.options.requestContext;
    expect(requestContext.get('app')).toEqual({ appId: 'scheduler' });
    expect(requestContext.get('channel')).toMatchObject({
      origin: 'inbound',
      harnessName: 'default',
      channelId: 'slack-main',
      providerId: 'slack',
      externalThreadId: 'thread-1',
      externalMessageId: 'message-1',
      actor: { platformUserId: 'user-1', displayName: 'Ada' },
    });
    const slot = getHarnessSlot(agent.streamCalls);
    expect(slot.app).toEqual({ appId: 'scheduler' });
    expect(slot.channel).toMatchObject({
      origin: 'inbound',
      harnessName: 'default',
      channelId: 'slack-main',
      providerId: 'slack',
      externalThreadId: 'thread-1',
      externalMessageId: 'message-1',
      actor: { platformUserId: 'user-1', displayName: 'Ada' },
    });
  });

  it('preserves yolo when admitting durable wakeup queue rows', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const admitQueue = vi.spyOn(session as any, '_admitQueue').mockResolvedValue({
      queuedItemId: 'queued-yolo',
      evidence: {},
      duplicate: false,
    });

    await (session as any)._admitWakeupQueue({
      content: 'scheduled work',
      admissionId: 'wakeup-admission-yolo',
      yolo: true,
      attachments: [],
    });

    expect(admitQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'scheduled work',
        admissionId: 'wakeup-admission-yolo',
        yolo: true,
      }),
      'admitQueue()',
      expect.objectContaining({ persistedAttachments: [] }),
    );
    admitQueue.mockRestore();
  });

  it('wakeup admission rejects persisted refs owned by another session', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(
      (session as any)._admitWakeupQueue({
        content: 'scheduled work',
        admissionId: 'wakeup-admission-foreign-ref',
        attachments: [
          {
            kind: 'ref',
            name: 'foreign.txt',
            mimeType: 'text/plain',
            ownerSessionId: 'other-session',
            attachmentId: 'attachment-1',
            bytes: 12,
            sha256: 'sha256-1',
            source: 'preupload',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(HarnessValidationError);
  });
});

describe('HarnessRequestContext — §15 pending registration acceptance', () => {
  it('commits a question pending row before emitting the pending event', async () => {
    const { harness, storage, agent } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const eventRecords: Array<Promise<unknown>> = [];
    session.subscribe(event => {
      if (event.type === 'suspension_required' && event.kind === 'question') {
        eventRecords.push(storage.loadSession({ sessionId: session.id }));
      }
    });

    await session.message({ content: 'capture context' });
    const slot = getHarnessSlot(agent.streamCalls);

    await (slot.registerQuestion as any)({
      questionId: 'question-1',
      question: 'Pick one',
      options: [{ label: 'A' }],
      selectionMode: 'single_select',
      runId: 'run-question-1',
      toolCallId: 'tool-question-1',
    });

    expect(eventRecords).toHaveLength(1);
    await expect(eventRecords[0]).resolves.toMatchObject({
      pendingResume: {
        kind: 'question',
        itemId: 'question-1',
        runId: 'run-question-1',
        toolCallId: 'tool-question-1',
        payload: {
          question: 'Pick one',
          options: [{ label: 'A' }],
          selectionMode: 'single_select',
        },
      },
    });
  });

  it('commits a plan pending row before emitting the pending event', async () => {
    const { harness, storage, agent } = setupHarness({
      modes: [
        { id: 'plan', agentId: 'default', transitionsTo: 'build' },
        { id: 'build', agentId: 'default' },
      ],
      defaultModeId: 'plan',
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const eventRecords: Array<Promise<unknown>> = [];
    session.subscribe(event => {
      if (event.type === 'suspension_required' && event.kind === 'plan-approval') {
        eventRecords.push(storage.loadSession({ sessionId: session.id }));
      }
    });

    await session.message({ content: 'capture plan context', mode: 'plan' });
    const slot = getHarnessSlot(agent.streamCalls);

    await (slot.registerPlanApproval as any)({
      planId: 'plan-1',
      title: 'Plan title',
      plan: 'Step 1',
      runId: 'run-plan-1',
      toolCallId: 'tool-plan-1',
    });

    expect(eventRecords).toHaveLength(1);
    await expect(eventRecords[0]).resolves.toMatchObject({
      pendingResume: {
        kind: 'plan-approval',
        itemId: 'plan-1',
        runId: 'run-plan-1',
        toolCallId: 'tool-plan-1',
        modeId: 'plan',
        transitionModeId: 'build',
        payload: {
          title: 'Plan title',
          plan: 'Step 1',
        },
      },
    });
  });
});
