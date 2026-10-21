import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventEmitterPubSub } from '../../events/event-emitter';
import { Agent } from '../agent';
import { createSignal } from '../signals';
import { AgentThreadStreamRuntime, agentThreadStreamRuntime } from '../thread-stream-runtime';
import {
  nextTick,
  ControlledLeasePubSub,
  readNextRunWithParts,
  waitForActiveRun,
  waitForCondition,
  withTimeout,
  createFakeThreadRun,
} from './signals-test-utils';

describe('Agent signals: drain and lease handoff', () => {
  beforeEach(() => {
    agentThreadStreamRuntime.resetForTests();
  });

  it('delivers sendMessage into an active same-agent run', async () => {
    let releaseFirst!: () => void;
    const firstFinished = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    let streamCount = 0;
    const prompts: any[][] = [];
    const handledSignalMetadata: unknown[] = [];
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        streamCount += 1;
        prompts.push(prompt);
        const responseText = streamCount === 1 ? 'first response' : 'message response';
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: new ReadableStream({
            async start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({
                type: 'response-metadata',
                id: `send-message-${streamCount}`,
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              });
              controller.enqueue({ type: 'text-start', id: 'text-1' });
              controller.enqueue({ type: 'text-delta', id: 'text-1', delta: responseText });
              controller.enqueue({ type: 'text-end', id: 'text-1' });
              if (streamCount === 1) {
                await firstFinished;
              }
              controller.enqueue({
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              });
              controller.close();
            },
          }),
        };
      },
    });
    const agent = new Agent({
      id: 'active-message-agent',
      name: 'Active Message Agent',
      instructions: 'Test',
      model,
      inputProcessors: [
        {
          id: 'capture-active-message-metadata',
          processInputStep: ({ messageList }) => {
            for (const message of messageList.get.input.db()) {
              if (message.role !== 'signal') continue;
              const signal = message.content.metadata?.signal as Record<string, unknown> | undefined;
              if (signal?.metadata !== undefined) handledSignalMetadata.push(signal.metadata);
            }
          },
        },
      ],
    });
    const subscription = await agent.subscribeToThread({
      threadId: 'active-message-thread',
      resourceId: 'active-message-user',
    });

    const stream = await agent.stream('Hello', {
      memory: { thread: 'active-message-thread', resource: 'active-message-user' },
    });
    await expect(waitForActiveRun(subscription)).resolves.toBe(stream.runId);
    await waitForCondition(() => stream._getImmediateText() === 'first response');
    const result = agent.sendMessage(
      {
        contents: 'Hello while active',
        metadata: { channel: { attachmentId: 'file-1' } },
      },
      {
        resourceId: 'active-message-user',
        threadId: 'active-message-thread',
      },
    );

    await expect(result.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });
    releaseFirst();
    await expect(stream.text).resolves.toBe('first responsemessage response');
    expect(streamCount).toBe(2);
    expect(JSON.stringify(prompts[1])).toContain('Hello while active');
    expect(handledSignalMetadata).toContainEqual({ channel: { attachmentId: 'file-1' } });

    subscription.unsubscribe();
  });

  it('queues sendMessage behind a suspended same-agent approval run', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const agent = {
      id: 'suspended-message-agent',
      stream: vi.fn(),
    } as unknown as Agent<any, any, any, any>;
    const runId = 'suspended-message-run';
    const threadId = 'suspended-message-thread';
    const resourceId = 'suspended-message-user';
    let finishRun!: () => void;
    const finished = new Promise<void>(resolve => {
      finishRun = resolve;
    });
    const subscription = await runtime.subscribeToThread(agent, { threadId, resourceId });
    const iterator = subscription.stream[Symbol.asyncIterator]();

    try {
      runtime.registerRun(
        agent,
        {
          runId,
          status: 'suspended',
          fullStream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'start', runId });
              controller.enqueue({
                type: 'tool-call-approval',
                runId,
                payload: { toolCallId: 'tool-call-1', toolName: 'testTool' },
              });
            },
          }),
          _waitUntilFinished: () => finished,
        } as any,
        { memory: { thread: threadId, resource: resourceId } } as any,
      );

      await withTimeout(iterator.next(), 'Timed out waiting for approval run start');
      await withTimeout(iterator.next(), 'Timed out waiting for approval chunk');
      expect(runtime.getThreadState({ resourceId, threadId })).toBe('active');

      const result = runtime.sendMessage(agent, 'Queued behind approval', { resourceId, threadId });

      await expect(result.accepted).resolves.toMatchObject({ action: 'deliver', runId });
      expect((agent as any).stream).not.toHaveBeenCalled();
      const [signal] = runtime.drainPendingSignals(runId);
      expect(signal).toMatchObject({ type: 'user', contents: 'Queued behind approval' });
    } finally {
      finishRun();
      subscription.unsubscribe();
    }
  });

  it('restores a queued signal when the drain follow-up stream fails', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const streamMock = vi.fn().mockRejectedValue(new Error('connection error: ECONNRESET'));
    const agent = {
      id: 'drain-failure-agent',
      stream: streamMock,
    } as unknown as Agent<any, any, any, any>;
    const runId = 'drain-failure-run';
    const threadId = 'drain-failure-thread';
    const resourceId = 'drain-failure-user';
    let finishRun!: () => void;
    const finished = new Promise<void>(resolve => {
      finishRun = resolve;
    });
    const subscription = await runtime.subscribeToThread(agent, { threadId, resourceId });
    const iterator = subscription.stream[Symbol.asyncIterator]();

    try {
      runtime.registerRun(
        agent,
        {
          runId,
          status: 'running',
          fullStream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'start', runId });
              controller.enqueue({ type: 'finish', runId, payload: {} });
              controller.close();
            },
          }),
          _waitUntilFinished: () => finished,
        } as any,
        { memory: { thread: threadId, resource: resourceId } } as any,
      );

      await withTimeout(readNextRunWithParts(iterator), 'Timed out waiting for the first run to stream');
      const result = runtime.sendMessage(agent, 'steer follow-up', { resourceId, threadId });
      await expect(result.accepted).resolves.toMatchObject({ action: 'deliver', runId });
      expect(streamMock).not.toHaveBeenCalled();

      finishRun();
      await waitForCondition(() => streamMock.mock.calls.length === 1);
      await nextTick();
      await nextTick();

      // Probe: register a fresh run on the same thread so the public
      // drainPendingSignals can resolve the thread key, then inspect the queue.
      // The failed signal must have been restored to the queue head.
      runtime.registerRun(
        agent,
        {
          runId: 'drain-failure-probe',
          status: 'running',
          fullStream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'start', runId: 'drain-failure-probe' });
            },
          }),
          _waitUntilFinished: () => new Promise<void>(() => {}),
        } as any,
        { memory: { thread: threadId, resource: resourceId } } as any,
      );
      const restored = runtime.drainPendingSignals('drain-failure-probe');
      expect(restored).toHaveLength(1);
      expect(restored[0]).toMatchObject({ type: 'user', contents: 'steer follow-up' });
    } finally {
      subscription.unsubscribe();
    }
  });

  it('publishes run-failed when the drain follow-up stream fails', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const streamMock = vi.fn().mockRejectedValue(new Error('connection error: ECONNRESET'));
    const agent = {
      id: 'drain-failure-event-agent',
      stream: streamMock,
    } as unknown as Agent<any, any, any, any>;
    const runId = 'drain-failure-event-run';
    const threadId = 'drain-failure-event-thread';
    const resourceId = 'drain-failure-event-user';
    let finishRun!: () => void;
    const finished = new Promise<void>(resolve => {
      finishRun = resolve;
    });
    const subscription = await runtime.subscribeToThread(agent, { threadId, resourceId });
    const iterator = subscription.stream[Symbol.asyncIterator]();

    try {
      runtime.registerRun(
        agent,
        {
          runId,
          status: 'running',
          fullStream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'start', runId });
              controller.enqueue({ type: 'finish', runId, payload: {} });
              controller.close();
            },
          }),
          _waitUntilFinished: () => finished,
        } as any,
        { memory: { thread: threadId, resource: resourceId } } as any,
      );

      await withTimeout(readNextRunWithParts(iterator), 'Timed out waiting for the first run to stream');
      const result = runtime.sendMessage(agent, 'steer follow-up', { resourceId, threadId });
      await expect(result.accepted).resolves.toMatchObject({ action: 'deliver', runId });

      finishRun();
      await waitForCondition(() => streamMock.mock.calls.length === 1);

      const errorRun = await withTimeout(
        readNextRunWithParts(iterator),
        'Timed out waiting for the run-failed error run',
        1000,
      );
      expect(errorRun.done).toBe(false);
      expect(errorRun.value?.part?.type).toBe('error');
      const errorPayload = errorRun.value?.part?.payload?.error;
      const errorMessage = errorPayload instanceof Error ? errorPayload.message : String(errorPayload);
      expect(errorMessage).toContain('failed to start follow-up run for queued message');
    } finally {
      subscription.unsubscribe();
    }
  });

  it('notifies only the owning run synchronously after pending input is queued', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    const agent = { id: 'pending-notification-agent' } as Agent<any, any, any, any>;
    const target = { resourceId: 'pending-user', threadId: 'pending-thread' };
    const runId = 'pending-run';
    let finish!: () => void;
    const finished = new Promise<void>(resolve => {
      finish = resolve;
    });
    await runtime.registerRun(
      agent,
      createFakeThreadRun(runId, finished),
      { memory: { resource: target.resourceId, thread: target.threadId } },
      pubsub,
    );
    const admitted: string[][] = [];
    const unsubscribe = runtime.subscribePendingSignals(
      runId,
      () => {
        admitted.push(runtime.drainPendingSignals(runId, pubsub).map(signal => signal.id));
      },
      pubsub,
    );
    const observer = vi.fn();
    const unobserve = runtime.subscribePendingSignals('not-an-owner', observer, pubsub);
    try {
      const first = runtime.sendMessage(agent, 'first', target, pubsub);
      expect(admitted).toEqual([[first.signal.id]]);
      await first.accepted;
      await pubsub.flush();
      expect(admitted).toHaveLength(1); // The publisher's own echo must not notify twice.
      expect(observer).not.toHaveBeenCalled();
      for (const behavior of ['discard', 'persist'] as const) {
        const ignored = runtime.sendSignal(
          agent,
          { type: 'notification', contents: 'ignored', transient: true },
          { ...target, ifActive: { behavior } },
          pubsub,
        );
        await ignored.accepted;
      }
      const wrongResource = runtime.sendMessage(
        agent,
        'wrong resource',
        { ...target, resourceId: 'other-user', ifIdle: { behavior: 'discard' } },
        pubsub,
      );
      const wrongThread = runtime.sendMessage(
        agent,
        'wrong thread',
        { ...target, threadId: 'other-thread', ifIdle: { behavior: 'discard' } },
        pubsub,
      );
      await Promise.all([wrongResource.accepted, wrongThread.accepted]);
      const queued = runtime.queueMessage(agent, 'idle only', target, pubsub);
      await queued.accepted;
      runtime.cancelQueuedMessages(agent, { ...target, signalIds: [queued.signal.id] }, pubsub);
      expect(admitted).toHaveLength(1);
      unsubscribe();
      const next = runtime.sendMessage(agent, 'after unsubscribe', target, pubsub);
      await next.accepted;
      expect(admitted).toHaveLength(1);
      expect(runtime.drainPendingSignals(runId, pubsub).map(signal => signal.id)).toEqual([next.signal.id]);
    } finally {
      unsubscribe();
      unobserve();
      finish();
    }
  });

  it('preserves input queued before registration and removes listeners after failed startup', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    const agent = { id: 'reserved-notification-agent' } as Agent<any, any, any, any>;
    const target = { resourceId: 'reserved-user', threadId: 'reserved-thread' };
    const runId = 'reserved-notification-run';
    const options = { runId, memory: { resource: target.resourceId, thread: target.threadId } };
    await runtime.waitForCrossAgentThreadRun(agent, options, pubsub);
    const before = runtime.sendMessage(agent, 'before listener', target, pubsub);
    const listener = vi.fn();
    const unsubscribe = runtime.subscribePendingSignals(runId, listener, pubsub);
    expect(runtime.drainPendingSignals(runId, pubsub, 'pre-run').map(signal => signal.id)).toEqual([before.signal.id]);
    const after = runtime.sendMessage(agent, 'after listener', target, pubsub);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(runtime.drainPendingSignals(runId, pubsub, 'pre-run').map(signal => signal.id)).toEqual([after.signal.id]);
    runtime.releaseThreadRunReservation(runId, pubsub);
    // Reusing the identity proves startup cleanup removed the old listener, even without its unsubscribe.
    await runtime.waitForCrossAgentThreadRun(agent, options, pubsub);
    const replacement = runtime.sendMessage(agent, 'replacement reservation', target, pubsub);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(runtime.drainPendingSignals(runId, pubsub, 'pre-run').map(signal => signal.id)).toEqual([
      replacement.signal.id,
    ]);
    unsubscribe();
    runtime.releaseThreadRunReservation(runId, pubsub);
  });

  it('removes pending-input listeners when the owning run completes', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    const agent = { id: 'completed-notification-agent' } as Agent<any, any, any, any>;
    const target = { resourceId: 'completed-user', threadId: 'completed-thread' };
    const runId = 'completed-notification-run';
    let finish!: () => void;
    const finished = new Promise<void>(resolve => {
      finish = resolve;
    });
    await runtime.registerRun(
      agent,
      createFakeThreadRun(runId, finished),
      { memory: { resource: target.resourceId, thread: target.threadId } },
      pubsub,
    );
    const listener = vi.fn();
    const unsubscribe = runtime.subscribePendingSignals(runId, listener, pubsub);
    finish();
    await vi.waitFor(() => expect(runtime.getThreadState(target, pubsub)).toBe('idle'));
    await runtime.waitForCrossAgentThreadRun(
      agent,
      { runId, memory: { resource: target.resourceId, thread: target.threadId } },
      pubsub,
    );
    const signal = runtime.sendMessage(agent, 'replacement', target, pubsub);
    expect(listener).not.toHaveBeenCalled();
    expect(runtime.drainPendingSignals(runId, pubsub, 'pre-run').map(item => item.id)).toEqual([signal.signal.id]);
    unsubscribe();
    runtime.releaseThreadRunReservation(runId, pubsub);
  });

  it('restores the failed signal at the queue head ahead of later queued signals', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const streamMock = vi.fn().mockRejectedValue(new Error('connection error: ECONNRESET'));
    const agent = {
      id: 'drain-order-agent',
      stream: streamMock,
    } as unknown as Agent<any, any, any, any>;
    const runId = 'drain-order-run';
    const threadId = 'drain-order-thread';
    const resourceId = 'drain-order-user';
    let finishRun!: () => void;
    const finished = new Promise<void>(resolve => {
      finishRun = resolve;
    });

    runtime.registerRun(agent, createFakeThreadRun(runId, finished), {
      memory: { thread: threadId, resource: resourceId },
    } as any);

    const first = runtime.sendMessage(agent, 'first steer', { resourceId, threadId });
    const second = runtime.sendMessage(agent, 'second steer', { resourceId, threadId });
    await expect(first.accepted).resolves.toMatchObject({ action: 'deliver', runId });
    await expect(second.accepted).resolves.toMatchObject({ action: 'deliver', runId });

    finishRun();
    await waitForCondition(() => streamMock.mock.calls.length === 1);
    await nextTick();
    await nextTick();

    runtime.registerRun(agent, createFakeThreadRun('drain-order-probe', new Promise<void>(() => {})), {
      memory: { thread: threadId, resource: resourceId },
    } as any);
    const restored = runtime.drainPendingSignals('drain-order-probe');
    expect(restored).toHaveLength(2);
    expect(restored[0]).toMatchObject({ contents: 'first steer' });
    expect(restored[1]).toMatchObject({ contents: 'second steer' });
  });

  it('queues a retained signal it queued locally but forwarded during drain when it later owns the run', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new ControlledLeasePubSub();
    const streamMock = vi.fn();
    const agent = { id: 'drain-forward-agent', stream: streamMock } as unknown as Agent<any, any, any, any>;
    const threadId = 'drain-forward-thread';
    const resourceId = 'drain-forward-user';
    const options = { memory: { thread: threadId, resource: resourceId } } as any;
    let finishRun!: () => void;
    const finished = new Promise<void>(resolve => {
      finishRun = resolve;
    });

    runtime.registerRun(agent, createFakeThreadRun('drain-forward-run', finished), options, pubsub);
    const queued = runtime.sendMessage(agent, 'drained notification', { resourceId, threadId }, pubsub);
    await expect(queued.accepted).resolves.toMatchObject({ action: 'deliver', runId: 'drain-forward-run' });
    const enqueued = pubsub.publishedData.find(data => data.type === 'signal-enqueued');
    expect(enqueued).toBeDefined();

    // Another runtime wins the lease at handoff, so the drain forwards the signal instead of running it.
    vi.spyOn(pubsub, 'transferLease').mockImplementationOnce(async key => {
      pubsub.owners.set(key, 'other-owner-run');
      return false;
    });
    finishRun();
    await waitForCondition(() =>
      pubsub.publishedData.some(data => data.type === 'signal-enqueued' && data.runId === 'other-owner-run'),
    );
    expect(streamMock).not.toHaveBeenCalled();
    const forwarded = pubsub.publishedData.find(
      data => data.type === 'signal-enqueued' && data.runId === 'other-owner-run',
    );

    // The other owner dies before consuming it; this runtime takes over its run and retained events replay.
    pubsub.owners.clear();
    runtime.registerRun(agent, createFakeThreadRun('other-owner-run', new Promise<void>(() => {})), options, pubsub);
    const topic = `agent.thread-stream.${encodeURIComponent(`${resourceId}\u0000${threadId}`)}`;
    // The original local enqueue is still a self-echo and must not be queued again.
    await pubsub.publish(topic, { type: 'signal-enqueued', data: enqueued });
    await pubsub.publish(topic, { type: 'signal-enqueued', data: forwarded });
    await pubsub.flush();
    await nextTick();

    const restored = runtime.drainPendingSignals('other-owner-run', pubsub);
    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({ contents: 'drained notification' });
  });

  it('releases the thread lease with the failed run id when the handoff starts nothing', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new ControlledLeasePubSub();
    const releaseSpy = vi.spyOn(pubsub, 'releaseLease');
    const streamMock = vi.fn().mockRejectedValue(new Error('connection error: ECONNRESET'));
    const agent = {
      id: 'drain-release-agent',
      stream: streamMock,
    } as unknown as Agent<any, any, any, any>;
    const runId = 'drain-release-run';
    const threadId = 'drain-release-thread';
    const resourceId = 'drain-release-user';
    let finishRun!: () => void;
    const finished = new Promise<void>(resolve => {
      finishRun = resolve;
    });

    runtime.registerRun(
      agent,
      createFakeThreadRun(runId, finished),
      { memory: { thread: threadId, resource: resourceId } } as any,
      pubsub,
    );

    const result = runtime.sendMessage(agent, 'steer follow-up', { resourceId, threadId }, pubsub);
    await expect(result.accepted).resolves.toMatchObject({ action: 'deliver', runId });

    finishRun();
    await waitForCondition(() => streamMock.mock.calls.length === 1);
    const nextRunId = streamMock.mock.calls[0]?.[1]?.runId;
    expect(nextRunId).toBeTruthy();
    expect(nextRunId).not.toBe(runId);

    // Run registration fails open on lease acquisition, so "a fresh run can
    // start" would pass even without the release. Assert the release call
    // directly, with the FAILED run's id (its renewal timer is keyed by it).
    await waitForCondition(() => releaseSpy.mock.calls.some(call => call[1] === nextRunId));
    expect(releaseSpy).toHaveBeenCalledWith(expect.stringContaining(threadId), nextRunId);
  });

  it('restores the signal when the lease transfer step throws', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new ControlledLeasePubSub();
    // Only a SYNCHRONOUS throw reaches the drain's catch: async provider
    // rejections are swallowed inside the lease helpers and take the
    // lease-lost branch instead. Throw once so the follow-up drain below can
    // prove the restored signal still delivers afterwards.
    vi.spyOn(pubsub, 'transferLease').mockImplementationOnce(() => {
      throw new Error('lease backend down');
    });
    const streamMock = vi.fn().mockResolvedValue({} as any);
    const agent = {
      id: 'drain-lease-throw-agent',
      stream: streamMock,
    } as unknown as Agent<any, any, any, any>;
    const runId = 'drain-lease-throw-run';
    const threadId = 'drain-lease-throw-thread';
    const resourceId = 'drain-lease-throw-user';
    let finishRun!: () => void;
    const finished = new Promise<void>(resolve => {
      finishRun = resolve;
    });

    runtime.registerRun(
      agent,
      createFakeThreadRun(runId, finished),
      { memory: { thread: threadId, resource: resourceId } } as any,
      pubsub,
    );

    const result = runtime.sendMessage(agent, 'steer follow-up', { resourceId, threadId }, pubsub);
    await expect(result.accepted).resolves.toMatchObject({ action: 'deliver', runId });

    finishRun();
    await waitForCondition(() =>
      pubsub.publishedData.some(
        data => data?.type === 'run-failed' && String(data?.error).includes('failed to start follow-up run'),
      ),
    );
    expect(streamMock).not.toHaveBeenCalled();

    // The synchronous transfer throw leaves the lease still owned by the
    // FINISHED previous run (the transfer never got to stop its renewal), so
    // the catch must release that owner too or the key is held forever and
    // the next drain loses the restored signal via the lease-lost branch.
    await waitForCondition(() => ![...pubsub.owners.values()].includes(runId));

    // Prove a subsequent NATURAL drain actually delivers the restored signal,
    // not merely that it sits in the queue.
    let finishSecondRun!: () => void;
    const secondFinished = new Promise<void>(resolve => {
      finishSecondRun = resolve;
    });
    runtime.registerRun(
      agent,
      createFakeThreadRun('drain-lease-throw-second', secondFinished),
      { memory: { thread: threadId, resource: resourceId } } as any,
      pubsub,
    );
    finishSecondRun();
    await waitForCondition(() => streamMock.mock.calls.length === 1);
    expect(JSON.stringify(streamMock.mock.calls[0]?.[0])).toContain('steer follow-up');
  });

  it('releases the stale previous-run lease on a transfer throw even when an idle signal is queued', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new ControlledLeasePubSub();
    vi.spyOn(pubsub, 'transferLease').mockImplementationOnce(() => {
      throw new Error('lease backend down');
    });
    const streamMock = vi.fn().mockResolvedValue({} as any);
    const agent = {
      id: 'drain-lease-throw-idle-agent',
      stream: streamMock,
    } as unknown as Agent<any, any, any, any>;
    const runId = 'drain-lease-throw-idle-run';
    const threadId = 'drain-lease-throw-idle-thread';
    const resourceId = 'drain-lease-throw-idle-user';
    let finishRun!: () => void;
    const finished = new Promise<void>(resolve => {
      finishRun = resolve;
    });

    runtime.registerRun(
      agent,
      createFakeThreadRun(runId, finished),
      { memory: { thread: threadId, resource: resourceId } } as any,
      pubsub,
    );

    const result = runtime.sendMessage(agent, 'steer follow-up', { resourceId, threadId }, pubsub);
    await expect(result.accepted).resolves.toMatchObject({ action: 'deliver', runId });
    // Queue an idle message while the run is active so the failure path's
    // handoff has idle work to consider. The idle drain reports work on its
    // lease-lost branch without starting a local run, so a release gated on
    // the handoff outcome would be skipped here and the finished run would
    // hold the lease forever.
    const queued = runtime.queueMessage(agent, 'idle follow-up', { resourceId, threadId }, pubsub);
    await expect(queued.accepted).resolves.toMatchObject({ action: 'deliver' });

    finishRun();
    await waitForCondition(() =>
      pubsub.publishedData.some(
        data => data?.type === 'run-failed' && String(data?.error).includes('failed to start follow-up run'),
      ),
    );

    // The finished run must not own the lease, no matter what the handoff did.
    await waitForCondition(() => ![...pubsub.owners.values()].includes(runId));
  });

  it('redelivers the restored signal exactly once on the next natural drain trigger', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const streamMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('connection error: ECONNRESET'))
      .mockResolvedValue({} as any);
    const agent = {
      id: 'drain-redeliver-agent',
      stream: streamMock,
    } as unknown as Agent<any, any, any, any>;
    const threadId = 'drain-redeliver-thread';
    const resourceId = 'drain-redeliver-user';
    let finishFirst!: () => void;
    const firstFinished = new Promise<void>(resolve => {
      finishFirst = resolve;
    });

    runtime.registerRun(agent, createFakeThreadRun('drain-redeliver-run-1', firstFinished), {
      memory: { thread: threadId, resource: resourceId },
    } as any);

    const result = runtime.sendMessage(agent, 'steer follow-up', { resourceId, threadId });
    await expect(result.accepted).resolves.toMatchObject({ action: 'deliver', runId: 'drain-redeliver-run-1' });

    finishFirst();
    await waitForCondition(() => streamMock.mock.calls.length === 1);
    await nextTick();
    await nextTick();

    // The next natural trigger: another run on the same thread completing.
    let finishSecond!: () => void;
    const secondFinished = new Promise<void>(resolve => {
      finishSecond = resolve;
    });
    runtime.registerRun(agent, createFakeThreadRun('drain-redeliver-run-2', secondFinished), {
      memory: { thread: threadId, resource: resourceId },
    } as any);
    finishSecond();

    await waitForCondition(() => streamMock.mock.calls.length === 2);
    expect(streamMock.mock.calls[1]?.[0]).toMatchObject({ type: 'user', contents: 'steer follow-up' });

    await nextTick();
    await nextTick();
    expect(streamMock.mock.calls).toHaveLength(2);

    runtime.registerRun(agent, createFakeThreadRun('drain-redeliver-probe', new Promise<void>(() => {})), {
      memory: { thread: threadId, resource: resourceId },
    } as any);
    expect(runtime.drainPendingSignals('drain-redeliver-probe')).toHaveLength(0);
  });

  it('hands the lease to a pending continuation instead of releasing it when the signal drain fails', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new ControlledLeasePubSub();
    const releaseSpy = vi.spyOn(pubsub, 'releaseLease');
    const streamMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('connection error: ECONNRESET'))
      .mockResolvedValue({} as any);
    const agent = {
      id: 'drain-continuation-agent',
      stream: streamMock,
    } as unknown as Agent<any, any, any, any>;
    const runId = 'drain-continuation-run';
    const threadId = 'drain-continuation-thread';
    const resourceId = 'drain-continuation-user';
    let finishRun!: () => void;
    const finished = new Promise<void>(resolve => {
      finishRun = resolve;
    });

    runtime.registerRun(
      agent,
      createFakeThreadRun(runId, finished),
      { memory: { thread: threadId, resource: resourceId } } as any,
      pubsub,
    );

    const result = runtime.sendMessage(agent, 'steer follow-up', { resourceId, threadId }, pubsub);
    await expect(result.accepted).resolves.toMatchObject({ action: 'deliver', runId });
    const continuation = runtime.continueWithMessages(agent, 'continuation work', { resourceId, threadId }, pubsub);
    expect(continuation.accepted).toBe(true);

    finishRun();
    // Call 1: the failed signal drain. Call 2: the continuation started by the
    // failure path's handoff.
    await waitForCondition(() => streamMock.mock.calls.length === 2);
    expect(streamMock.mock.calls[1]?.[0]).toBe('continuation work');
    expect(streamMock.mock.calls[1]?.[1]?.runId).toBe(continuation.runId);
    await nextTick();
    await nextTick();

    // The lease was handed to the continuation, not released. The failure path
    // does release the finished previous run's id unconditionally (an
    // owner-guarded no-op here), so assert ownership rather than call count:
    // the continuation's lease must survive, and nothing may release its runId.
    expect(releaseSpy.mock.calls.some(call => call[1] === continuation.runId)).toBe(false);
    expect([...pubsub.owners.values()]).toContain(continuation.runId);

    // The failed steer signal is still queued for a later drain, untouched by
    // the continuation handoff.
    runtime.registerRun(
      agent,
      createFakeThreadRun('drain-continuation-probe', new Promise<void>(() => {})),
      { memory: { thread: threadId, resource: resourceId } } as any,
      pubsub,
    );
    const restored = runtime.drainPendingSignals('drain-continuation-probe', pubsub);
    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({ contents: 'steer follow-up' });
  });

  it.each(['request_access', 'ask_user'])('keeps %s suspensions discoverable and blocks idle wake', async toolName => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    const agent = {
      id: `generic-suspended-${toolName}`,
      stream: vi.fn(),
    } as unknown as Agent<any, any, any, any>;
    const idleAgent = {
      id: `idle-agent-${toolName}`,
      stream: vi.fn(),
    } as unknown as Agent<any, any, any, any>;
    const runId = `generic-suspended-run-${toolName}`;
    const threadId = `generic-suspended-thread-${toolName}`;
    const resourceId = `generic-suspended-user-${toolName}`;
    const topic = `agent.thread-stream.${encodeURIComponent(`${resourceId}\u0000${threadId}`)}`;
    const events: any[] = [];
    let finishRun!: () => void;
    const finished = new Promise<void>(resolve => {
      finishRun = resolve;
    });
    await pubsub.subscribe(topic, event => events.push(event.data));
    const subscription = await runtime.subscribeToThread(agent, { threadId, resourceId }, pubsub);
    const iterator = subscription.stream[Symbol.asyncIterator]();

    try {
      runtime.registerRun(
        agent,
        {
          runId,
          status: 'suspended',
          fullStream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'start', runId });
              controller.enqueue({
                type: 'tool-call-suspended',
                runId,
                payload: { toolCallId: `tool-call-${toolName}`, toolName },
              });
              controller.close();
            },
          }),
          _waitUntilFinished: () => finished,
        } as any,
        { memory: { thread: threadId, resource: resourceId } } as any,
        pubsub,
      );

      await withTimeout(iterator.next(), 'Timed out waiting for generic suspended run start');
      await withTimeout(iterator.next(), 'Timed out waiting for generic suspended chunk');
      expect(runtime.getThreadState({ resourceId, threadId }, pubsub)).toBe('active');
      expect(runtime.getActiveThreadRunId({ resourceId, threadId }, pubsub)).toBe(runId);

      const queuedForSuspendedRun = runtime.sendMessage(
        agent,
        'Resume-adjacent input',
        { resourceId, threadId },
        pubsub,
      );
      await expect(queuedForSuspendedRun.accepted).resolves.toMatchObject({ action: 'deliver', runId });
      expect((agent as any).stream).not.toHaveBeenCalled();
      expect(runtime.drainPendingSignals(runId, pubsub)[0]).toMatchObject({
        type: 'user',
        contents: 'Resume-adjacent input',
      });

      finishRun();
      await waitForCondition(() => events.some(event => event?.type === 'run-suspended' && event.runId === runId));
      expect(runtime.getThreadState({ resourceId, threadId }, pubsub)).toBe('active');
      expect(runtime.getActiveThreadRunId({ resourceId, threadId }, pubsub)).toBe(runId);

      const idleWake = runtime.sendSignal(
        idleAgent,
        createSignal({ type: 'user-message', contents: 'Unrelated idle wake' }),
        { resourceId, threadId, ifIdle: { streamOptions: { memory: { resource: resourceId, thread: threadId } } } },
        pubsub,
      );
      await expect(idleWake.accepted).resolves.toMatchObject({ action: 'blocked', reason: 'thread-blocked', runId });
      expect((idleAgent as any).stream).not.toHaveBeenCalled();
      expect(runtime.getThreadState({ resourceId, threadId }, pubsub)).toBe('active');

      expect(runtime.abortThread({ resourceId, threadId }, pubsub)).toBe(true);
      await waitForCondition(() => events.some(event => event?.type === 'run-aborted' && event.runId === runId));
      expect(runtime.getActiveThreadRunId({ resourceId, threadId }, pubsub)).toBeUndefined();
      expect(runtime.getThreadState({ resourceId, threadId }, pubsub)).toBe('idle');
      expect(runtime.hasThreadRun(runId, pubsub)).toBe(false);
      expect(runtime.abortThread({ resourceId, threadId }, pubsub)).toBe(false);
    } finally {
      finishRun();
      subscription.unsubscribe();
    }
  });

  it('queues queueMessage until the active run completes', async () => {
    let releaseFirst!: () => void;
    const firstFinished = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    let streamCount = 0;
    const prompts: any[][] = [];
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        streamCount += 1;
        prompts.push(prompt);
        const responseText = streamCount === 1 ? 'first response' : 'queued response';
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: new ReadableStream({
            async start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({
                type: 'response-metadata',
                id: `queue-message-${streamCount}`,
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              });
              controller.enqueue({ type: 'text-start', id: 'text-1' });
              controller.enqueue({ type: 'text-delta', id: 'text-1', delta: responseText });
              controller.enqueue({ type: 'text-end', id: 'text-1' });
              if (streamCount === 1) {
                await firstFinished;
              }
              controller.enqueue({
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              });
              controller.close();
            },
          }),
        };
      },
    });
    const agent = new Agent({ id: 'queue-message-agent', name: 'Queue Message Agent', instructions: 'Test', model });
    const subscription = await agent.subscribeToThread({
      threadId: 'queue-message-thread',
      resourceId: 'queue-message-user',
    });
    const iterator = subscription.stream[Symbol.asyncIterator]();
    const firstRun = readNextRunWithParts(iterator);

    const stream = await agent.stream('Hello', {
      memory: { thread: 'queue-message-thread', resource: 'queue-message-user' },
    });
    await expect(waitForActiveRun(subscription)).resolves.toBe(stream.runId);
    const result = agent.queueMessage('Queued follow-up', {
      resourceId: 'queue-message-user',
      threadId: 'queue-message-thread',
    });

    const settled = await result.accepted;
    const queuedRunId = 'runId' in settled ? settled.runId : undefined;
    expect(settled.action).toBe('deliver');
    expect(queuedRunId).not.toBe(stream.runId);
    await nextTick();
    expect(streamCount).toBe(1);

    releaseFirst();
    await expect(stream.text).resolves.toBe('first response');
    await firstRun;
    const secondRun = await readNextRunWithParts(iterator);
    expect(secondRun.value.runId).toBe(queuedRunId);
    expect(secondRun.value.text).toBe('queued response');
    expect(
      agent.cancelQueuedMessages({
        resourceId: 'queue-message-user',
        threadId: 'queue-message-thread',
        signalIds: [result.signal.id],
      }),
    ).toEqual({ cancelledSignalIds: [] });
    expect(streamCount).toBe(2);
    expect(JSON.stringify(prompts[1])).toContain('Queued follow-up');

    subscription.unsubscribe();
  });

  it('queues a typed queueSignal until the active run completes', async () => {
    let releaseFirst!: () => void;
    const firstFinished = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    let streamCount = 0;
    const prompts: any[][] = [];
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        streamCount += 1;
        prompts.push(prompt);
        const responseText = streamCount === 1 ? 'first response' : 'skill response';
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: new ReadableStream({
            async start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({
                type: 'response-metadata',
                id: `queue-signal-${streamCount}`,
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              });
              controller.enqueue({ type: 'text-start', id: 'text-1' });
              controller.enqueue({ type: 'text-delta', id: 'text-1', delta: responseText });
              controller.enqueue({ type: 'text-end', id: 'text-1' });
              if (streamCount === 1) {
                await firstFinished;
              }
              controller.enqueue({
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              });
              controller.close();
            },
          }),
        };
      },
    });
    const agent = new Agent({ id: 'queue-signal-agent', name: 'Queue Signal Agent', instructions: 'Test', model });
    const subscription = await agent.subscribeToThread({
      threadId: 'queue-signal-thread',
      resourceId: 'queue-signal-user',
    });
    const iterator = subscription.stream[Symbol.asyncIterator]();
    const firstRun = readNextRunWithParts(iterator);

    const stream = await agent.stream('Hello', {
      memory: { thread: 'queue-signal-thread', resource: 'queue-signal-user' },
    });
    await expect(waitForActiveRun(subscription)).resolves.toBe(stream.runId);
    const result = agent.queueSignal(
      { type: 'reactive', tagName: 'skill', attributes: { name: 'factory-triage' }, contents: 'Triage the card.' },
      {
        resourceId: 'queue-signal-user',
        threadId: 'queue-signal-thread',
        ifIdle: { attributes: { delivery: 'queued' } },
      },
    );

    expect(result.signal).toMatchObject({
      type: 'reactive',
      tagName: 'skill',
      attributes: { name: 'factory-triage', delivery: 'queued' },
    });
    const settled = await result.accepted;
    const queuedRunId = 'runId' in settled ? settled.runId : undefined;
    expect(settled.action).toBe('deliver');
    expect(queuedRunId).not.toBe(stream.runId);
    await vi.waitFor(() => expect(streamCount).toBe(1));
    await nextTick();
    expect(streamCount).toBe(1);

    releaseFirst();
    await expect(stream.text).resolves.toBe('first response');
    await firstRun;
    const secondRun = await readNextRunWithParts(iterator);
    expect(secondRun.value.runId).toBe(queuedRunId);
    expect(secondRun.value.text).toBe('skill response');
    expect(streamCount).toBe(2);
    expect(JSON.stringify(prompts[0])).not.toContain('Triage the card.');
    expect(JSON.stringify(prompts[1])).toContain(
      '<skill delivery=\\"queued\\" name=\\"factory-triage\\">Triage the card.</skill>',
    );

    subscription.unsubscribe();
  });

  it('cancels a queued typed signal before it runs', async () => {
    let releaseFirst!: () => void;
    const firstFinished = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    const prompts: any[][] = [];
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        prompts.push(prompt);
        const isFirst = prompts.length === 1;
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: new ReadableStream({
            async start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({ type: 'text-start', id: 'text-1' });
              controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'response' });
              controller.enqueue({ type: 'text-end', id: 'text-1' });
              if (isFirst) await firstFinished;
              controller.enqueue({
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              });
              controller.close();
            },
          }),
        };
      },
    });
    const agent = new Agent({ id: 'cancel-signal-agent', name: 'Cancel Signal Agent', instructions: 'Test', model });
    const subscription = await agent.subscribeToThread({ threadId: 'cancel-signal-thread', resourceId: 'cancel-user' });

    const stream = await agent.stream('Hello', { memory: { thread: 'cancel-signal-thread', resource: 'cancel-user' } });
    await expect(waitForActiveRun(subscription)).resolves.toBe(stream.runId);
    const result = agent.queueSignal(
      { type: 'reactive', tagName: 'skill', contents: 'Cancelled skill' },
      { resourceId: 'cancel-user', threadId: 'cancel-signal-thread' },
    );
    await result.accepted;

    expect(
      agent.cancelQueuedMessages({
        resourceId: 'cancel-user',
        threadId: 'cancel-signal-thread',
        signalIds: [result.signal.id],
      }),
    ).toEqual({ cancelledSignalIds: [result.signal.id] });

    releaseFirst();
    await expect(stream.text).resolves.toBe('response');
    await nextTick();
    await nextTick();
    expect(prompts).toHaveLength(1);

    subscription.unsubscribe();
  });

  it('observes only relevant owner-scoped queue changes and validates cancellation selectors', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new ControlledLeasePubSub();
    const resourceId = 'observed-queue-resource';
    const threadId = 'observed-queue-thread';
    const ownerId = 'observed-owner';
    const activeRunId = 'observed-active-run';
    const neverFinished = new Promise<void>(() => {});
    const agent = { id: 'observed-agent', stream: vi.fn() } as unknown as Agent<any, any, any, any>;
    const otherAgent = { id: 'other-observed-agent', stream: vi.fn() } as unknown as Agent<any, any, any, any>;

    runtime.registerRun(
      agent,
      createFakeThreadRun(activeRunId, neverFinished),
      { memory: { resource: resourceId, thread: threadId } } as any,
      pubsub,
    );

    const events: Array<{ type: 'queue-count-changed'; count: number }> = [];
    const counts: number[] = [];
    const unsubscribe = runtime.subscribeThreadEvents(
      agent,
      { resourceId, threadId, queueOwnerId: ownerId },
      event => {
        if (event.type === 'queue-count-changed') {
          events.push(event);
          counts.push(event.count);
        }
      },
      pubsub,
    );
    const sharedCounts: number[] = [];
    const unsubscribeShared = runtime.subscribeThreadEvents(
      otherAgent,
      { resourceId, threadId },
      event => {
        if (event.type === 'queue-count-changed') sharedCounts.push(event.count);
      },
      pubsub,
    );
    const owned = runtime.queueMessage(
      agent,
      'owned queued message',
      { resourceId, threadId, queueOwnerId: ownerId },
      pubsub,
    );
    runtime.registerRun(
      agent,
      createFakeThreadRun('other-resource-run', neverFinished),
      { memory: { resource: 'other-resource', thread: threadId } } as any,
      pubsub,
    );
    runtime.registerRun(
      agent,
      createFakeThreadRun('other-thread-run', neverFinished),
      { memory: { resource: resourceId, thread: 'other-thread' } } as any,
      pubsub,
    );
    runtime.queueMessage(
      agent,
      'other resource queued message',
      { resourceId: 'other-resource', threadId, queueOwnerId: ownerId },
      pubsub,
    );
    runtime.queueMessage(
      agent,
      'other thread queued message',
      { resourceId, threadId: 'other-thread', queueOwnerId: ownerId },
      pubsub,
    );
    const untagged = runtime.queueMessage(agent, 'untagged supervisor message', { resourceId, threadId }, pubsub);
    const other = runtime.queueMessage(
      otherAgent,
      'other agent queued message',
      { resourceId, threadId, queueOwnerId: ownerId },
      pubsub,
    );

    expect(counts).toEqual([0, 1]);
    expect(sharedCounts).toEqual([0, 1, 2, 3]);
    expect(runtime.cancelQueuedMessages(otherAgent, { resourceId, threadId, queueOwnerId: ownerId }, pubsub)).toEqual({
      cancelledSignalIds: [other.signal.id],
    });
    expect(counts).toEqual([0, 1]);
    expect(runtime.cancelQueuedMessages(agent, { resourceId, threadId, queueOwnerId: ownerId }, pubsub)).toEqual({
      cancelledSignalIds: [owned.signal.id],
    });
    expect(
      runtime.cancelQueuedMessages(otherAgent, { resourceId, threadId, signalIds: [untagged.signal.id] }, pubsub),
    ).toEqual({
      cancelledSignalIds: [untagged.signal.id],
    });
    expect(
      runtime.cancelQueuedMessages(agent, { resourceId, threadId, signalIds: [untagged.signal.id] }, pubsub),
    ).toEqual({
      cancelledSignalIds: [],
    });
    expect(counts).toEqual([0, 1, 0]);
    expect(events).toEqual([
      { type: 'queue-count-changed', count: 0 },
      { type: 'queue-count-changed', count: 1 },
      { type: 'queue-count-changed', count: 0 },
    ]);
    expect(() => runtime.cancelQueuedMessages(agent, { resourceId, threadId } as any, pubsub)).toThrow(
      'exactly one of signalIds or queueOwnerId',
    );

    expect(sharedCounts).toEqual([0, 1, 2, 3, 2, 1, 0]);
    unsubscribeShared();
    unsubscribeShared();
    unsubscribe();
    unsubscribe();
    runtime.queueMessage(agent, 'unobserved queued message', { resourceId, threadId, queueOwnerId: ownerId }, pubsub);
    expect(counts).toEqual([0, 1, 0]);
    expect(sharedCounts).toEqual([0, 1, 2, 3, 2, 1, 0]);
  });

  it('isolates listener errors and permits reentrant owner cancellation', () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new ControlledLeasePubSub();
    const resourceId = 'reentrant-queue-resource';
    const threadId = 'reentrant-queue-thread';
    const queueOwnerId = 'reentrant-owner';
    const activeRunId = 'reentrant-active-run';
    const neverFinished = new Promise<void>(() => {});
    const agent = { id: 'reentrant-agent', stream: vi.fn() } as unknown as Agent<any, any, any, any>;

    runtime.registerRun(
      agent,
      createFakeThreadRun(activeRunId, neverFinished),
      { memory: { resource: resourceId, thread: threadId } } as any,
      pubsub,
    );

    const counts: number[] = [];
    runtime.subscribeThreadEvents(
      agent,
      { resourceId, threadId, queueOwnerId },
      event => {
        if (event.type === 'queue-count-changed') {
          counts.push(event.count);
          if (event.count > 0) {
            runtime.cancelQueuedMessages(agent, { resourceId, threadId, queueOwnerId }, pubsub);
          }
        }
      },
      pubsub,
    );
    runtime.subscribeThreadEvents(
      agent,
      { resourceId, threadId, queueOwnerId },
      () => {
        throw new Error('listener failure must not interrupt the queue');
      },
      pubsub,
    );

    const queued = runtime.queueMessage(agent, 'cancel from listener', { resourceId, threadId, queueOwnerId }, pubsub);
    expect(counts).toEqual([0, 1, 0]);
    expect(
      runtime.cancelQueuedMessages(agent, { resourceId, threadId, signalIds: [queued.signal.id] }, pubsub),
    ).toEqual({
      cancelledSignalIds: [],
    });
  });

  it('keeps observed messages pending through lease handoff and drops them before stream registration', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new ControlledLeasePubSub();
    const handoff = Promise.withResolvers<void>();
    const resourceId = 'handoff-observation-resource';
    const threadId = 'handoff-observation-thread';
    const queueOwnerId = 'handoff-observation-owner';
    const activeRunId = 'handoff-observation-active-run';
    let finishActiveRun!: () => void;
    let handoffStarted = false;
    const activeRunFinished = new Promise<void>(resolve => {
      finishActiveRun = resolve;
    });
    const counts: number[] = [];
    const agent = {
      id: 'handoff-observation-agent',
      stream: vi.fn(async () => {
        expect(counts).toEqual([0, 1, 0]);
        return { runId: 'handoff-observation-next-run' };
      }),
    } as unknown as Agent<any, any, any, any>;
    pubsub.transferLeaseWait = handoff.promise;
    pubsub.onTransferLease = () => {
      handoffStarted = true;
    };
    pubsub.owners.set(`${resourceId}\u0000${threadId}`, activeRunId);

    runtime.registerRun(
      agent,
      createFakeThreadRun(activeRunId, activeRunFinished),
      { memory: { resource: resourceId, thread: threadId } } as any,
      pubsub,
    );
    runtime.subscribeThreadEvents(
      agent,
      { resourceId, threadId, queueOwnerId },
      event => {
        if (event.type === 'queue-count-changed') counts.push(event.count);
      },
      pubsub,
    );
    const queued = runtime.queueMessage(
      agent,
      'handoff observed message',
      { resourceId, threadId, queueOwnerId },
      pubsub,
    );

    finishActiveRun();
    await waitForCondition(() => handoffStarted);
    expect(counts).toEqual([0, 1]);
    handoff.resolve();
    await waitForCondition(() => (agent.stream as any).mock.calls.length === 1);
    expect(counts).toEqual([0, 1, 0]);
    expect(runtime.cancelQueuedMessages(agent, { resourceId, threadId, queueOwnerId }, pubsub)).toEqual({
      cancelledSignalIds: [],
    });
    expect(queued.signal.id).toBeDefined();
  });

  it('removes observed messages when a lease loss forwards them or execution fails', async () => {
    const resourceId = 'queue-terminal-resource';
    const threadId = 'queue-terminal-thread';
    const queueOwnerId = 'queue-terminal-owner';

    for (const outcome of ['forward', 'fail'] as const) {
      const runtime = new AgentThreadStreamRuntime();
      const pubsub = new ControlledLeasePubSub();
      const activeRunId = `queue-terminal-active-${outcome}`;
      let finishActiveRun!: () => void;
      const activeRunFinished = new Promise<void>(resolve => {
        finishActiveRun = resolve;
      });
      const stream = vi.fn().mockRejectedValue(new Error('queued stream failure'));
      const agent = { id: `queue-terminal-agent-${outcome}`, stream } as unknown as Agent<any, any, any, any>;
      const counts: number[] = [];
      pubsub.owners.set(`${resourceId}\u0000${threadId}`, activeRunId);
      if (outcome === 'forward') {
        pubsub.transferLeaseWait = new Promise<void>(resolve => {
          pubsub.onTransferLease = () => {
            pubsub.owners.set(`${resourceId}\u0000${threadId}`, 'remote-winner');
            resolve();
          };
        });
      }

      runtime.registerRun(
        agent,
        createFakeThreadRun(activeRunId, activeRunFinished),
        { memory: { resource: resourceId, thread: threadId } } as any,
        pubsub,
      );
      runtime.subscribeThreadEvents(
        agent,
        { resourceId, threadId, queueOwnerId },
        event => {
          if (event.type === 'queue-count-changed') counts.push(event.count);
        },
        pubsub,
      );
      const queued = runtime.queueMessage(agent, `queued ${outcome}`, { resourceId, threadId, queueOwnerId }, pubsub);
      finishActiveRun();

      await waitForCondition(() => counts.at(-1) === 0);
      expect(counts).toEqual([0, 1, 0]);
      if (outcome === 'forward') {
        expect(stream).not.toHaveBeenCalled();
        expect(pubsub.publishedData).toContainEqual(
          expect.objectContaining({
            type: 'signal-enqueued',
            signal: expect.objectContaining({ id: queued.signal.id }),
          }),
        );
      } else {
        expect(stream).toHaveBeenCalledTimes(1);
      }
    }
  });

  it('removes observed messages after lease acquisition failure', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new ControlledLeasePubSub();
    const resourceId = 'lease-failure-observation-resource';
    const threadId = 'lease-failure-observation-thread';
    const queueOwnerId = 'lease-failure-observation-owner';
    const activeRunId = 'lease-failure-observation-active-run';
    let finishActiveRun!: () => void;
    const activeRunFinished = new Promise<void>(resolve => {
      finishActiveRun = resolve;
    });
    const stream = vi.fn();
    const agent = { id: 'lease-failure-observation-agent', stream } as unknown as Agent<any, any, any, any>;
    const counts: number[] = [];
    pubsub.owners.set(`${resourceId}\u0000${threadId}`, activeRunId);
    vi.spyOn(pubsub, 'transferLease').mockRejectedValue(new Error('lease backend unavailable'));

    runtime.registerRun(
      agent,
      createFakeThreadRun(activeRunId, activeRunFinished),
      { memory: { resource: resourceId, thread: threadId } } as any,
      pubsub,
    );
    runtime.subscribeThreadEvents(
      agent,
      { resourceId, threadId, queueOwnerId },
      event => {
        if (event.type === 'queue-count-changed') counts.push(event.count);
      },
      pubsub,
    );
    runtime.queueMessage(agent, 'lease failure', { resourceId, threadId, queueOwnerId }, pubsub);
    finishActiveRun();

    await waitForCondition(() => counts.at(-1) === 0);
    expect(counts).toEqual([0, 1, 0]);
    expect(stream).not.toHaveBeenCalled();
  });

  it('does not forward a cancelled observed message after losing the lease', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new ControlledLeasePubSub();
    const resourceId = 'lease-loss-cancel-resource';
    const threadId = 'lease-loss-cancel-thread';
    const queueOwnerId = 'lease-loss-cancel-owner';
    const activeRunId = 'lease-loss-cancel-active-run';
    let finishActiveRun!: () => void;
    let transferStarted!: () => void;
    const activeRunFinished = new Promise<void>(resolve => {
      finishActiveRun = resolve;
    });
    const transferStartedPromise = new Promise<void>(resolve => {
      transferStarted = resolve;
    });
    let releaseTransfer!: () => void;
    const stream = vi.fn();
    const agent = { id: 'lease-loss-cancel-agent', stream } as unknown as Agent<any, any, any, any>;
    const counts: number[] = [];
    pubsub.owners.set(`${resourceId}\u0000${threadId}`, activeRunId);
    pubsub.transferLeaseWait = new Promise<void>(resolve => {
      releaseTransfer = resolve;
    });
    pubsub.onTransferLease = transferStarted;

    runtime.registerRun(
      agent,
      createFakeThreadRun(activeRunId, activeRunFinished),
      { memory: { resource: resourceId, thread: threadId } } as any,
      pubsub,
    );
    runtime.subscribeThreadEvents(
      agent,
      { resourceId, threadId, queueOwnerId },
      event => {
        if (event.type === 'queue-count-changed') counts.push(event.count);
      },
      pubsub,
    );
    const queued = runtime.queueMessage(
      agent,
      'cancel before lease loss',
      { resourceId, threadId, queueOwnerId },
      pubsub,
    );
    finishActiveRun();
    await transferStartedPromise;

    expect(runtime.cancelQueuedMessages(agent, { resourceId, threadId, queueOwnerId }, pubsub)).toEqual({
      cancelledSignalIds: [queued.signal.id],
    });
    pubsub.owners.set(`${resourceId}\u0000${threadId}`, 'remote-winner');
    releaseTransfer();
    await waitForCondition(() => runtime.getActiveThreadRunId({ resourceId, threadId }, pubsub) === undefined);
    expect(counts).toEqual([0, 1, 0]);
    expect(stream).not.toHaveBeenCalled();
    expect(pubsub.publishedData).not.toContainEqual(expect.objectContaining({ type: 'signal-enqueued' }));
  });

  it('cancels a queueMessage after dequeue but before the lease handoff starts execution', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new ControlledLeasePubSub();
    const handoff = Promise.withResolvers<void>();
    const stream = vi.fn().mockResolvedValue({ runId: 'should-not-start' });
    const agent = { id: 'cancel-prestart-agent', stream } as unknown as Agent<any, any, any, any>;
    const resourceId = 'cancel-prestart-resource';
    const threadId = 'cancel-prestart-thread';
    const activeRunId = 'cancel-prestart-active';
    let finishActiveRun!: () => void;
    let handoffStarted = false;
    const activeRunFinished = new Promise<void>(resolve => {
      finishActiveRun = resolve;
    });
    pubsub.transferLeaseWait = handoff.promise;
    pubsub.onTransferLease = () => {
      handoffStarted = true;
    };
    pubsub.owners.set(`${resourceId}\u0000${threadId}`, activeRunId);

    runtime.registerRun(
      agent,
      createFakeThreadRun(activeRunId, activeRunFinished),
      { memory: { resource: resourceId, thread: threadId } } as any,
      pubsub,
    );
    const queued = runtime.queueMessage(agent, 'cancel before execution', { resourceId, threadId }, pubsub);
    await expect(queued.accepted).resolves.toMatchObject({ action: 'deliver' });

    finishActiveRun();
    await waitForCondition(() => handoffStarted);
    expect(
      runtime.cancelQueuedMessages(agent, { resourceId, threadId, signalIds: [queued.signal.id] }, pubsub),
    ).toEqual({
      cancelledSignalIds: [queued.signal.id],
    });
    handoff.resolve();
    await nextTick();
    await nextTick();

    expect(stream).not.toHaveBeenCalled();
  });
});
