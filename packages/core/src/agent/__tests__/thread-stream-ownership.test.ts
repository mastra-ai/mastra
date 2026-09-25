/**
 * Thread ownership must survive history replay and instance boundaries (#24878):
 * a replayed `run-registered` for a finished local run must not displace the
 * live run, and `sendSignal` must deliver to an active run owned by another
 * runtime instance instead of treating the thread as idle.
 */
import { describe, expect, it, vi } from 'vitest';

import type { Agent } from '../agent';
import { AgentThreadStreamRuntime } from '../thread-stream-runtime';
import { LeasePubSub, nextTicks } from './thread-stream-test-utils';

function registerRun(
  runtime: AgentThreadStreamRuntime,
  agent: Agent<any, any, any, any>,
  pubsub: LeasePubSub,
  runId: string,
  threadId: string,
  resourceId: string,
) {
  let finish!: () => void;
  const finished = new Promise<void>(resolve => {
    finish = resolve;
  });
  let close!: () => void;
  const fullStream = new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'start', runId });
      close = () => {
        controller.enqueue({
          type: 'finish',
          runId,
          payload: { usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, finishReason: 'stop' },
        });
        controller.close();
      };
    },
  });
  const output = { runId, status: 'running', fullStream, _waitUntilFinished: () => finished } as any;
  const registered = runtime.registerRun(
    agent,
    output,
    { memory: { thread: threadId, resource: resourceId } } as any,
    pubsub,
  );
  return {
    registered,
    markFinished: () => {
      output.status = 'success';
    },
    complete: () => {
      output.status = 'success';
      close();
      finish();
    },
  };
}

describe('thread ownership (#24878)', () => {
  it('ignores a replayed run-registered for a finished local run', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new LeasePubSub();
    pubsub.retain = true;
    const threadId = 'replay-owner-thread';
    const resourceId = 'replay-owner-user';
    const topic = `agent.thread-stream.${encodeURIComponent([resourceId, threadId].join('\u0000'))}`;
    const agent = {
      id: 'replay-owner-agent',
      getMemory: async () => ({
        getThreadById: async ({ threadId }: { threadId: string }) => ({ id: threadId }),
        recall: async () => ({ messages: [], hasMore: false }),
      }),
    } as unknown as Agent<any, any, any, any>;

    const runA = registerRun(runtime, agent, pubsub, 'run-a', threadId, resourceId);
    await runA.registered;
    // Run A has finished and released the thread lease, but its local record
    // has not been cleaned up yet: still local, no longer blocking the thread.
    runA.markFinished();
    pubsub.owners.clear();

    const runB = registerRun(runtime, agent, pubsub, 'run-b', threadId, resourceId);
    await runB.registered;

    const subscription = await runtime.subscribeToThread(
      agent,
      { threadId, resourceId, withInitialHistory: true },
      pubsub,
    );
    await nextTicks(20);
    expect(subscription.activeRunId()).toBe('run-b');

    // A backlog redelivery of run A's registration (e.g. a reclaimed stream
    // entry) must not hand the thread back to the finished run.
    const registeredA = pubsub
      .retainedEvents(topic)
      .find(event => event.data?.type === 'run-registered' && event.runId === 'run-a');
    expect(registeredA).toBeDefined();
    await pubsub.publish(topic, registeredA);
    await nextTicks(20);

    expect(subscription.activeRunId()).toBe('run-b');
    subscription.unsubscribe();
    runA.complete();
    runB.complete();
  });

  it('delivers a thread-targeted signal to an active run owned by another instance', async () => {
    const ownerRuntime = new AgentThreadStreamRuntime();
    const senderRuntime = new AgentThreadStreamRuntime();
    const pubsub = new LeasePubSub();
    const agent = { id: 'remote-signal-agent', stream: vi.fn() } as unknown as Agent<any, any, any, any>;
    const threadId = 'remote-signal-thread';
    const resourceId = 'remote-signal-user';

    const subscription = await senderRuntime.subscribeToThread(agent, { threadId, resourceId }, pubsub);
    const run = registerRun(ownerRuntime, agent, pubsub, 'remote-run', threadId, resourceId);
    await run.registered;
    await vi.waitFor(() => expect(subscription.activeRunId()).toBe('remote-run'));

    // The sender must see the remote run as active, so `ifActive` applies.
    // Treating the thread as idle would ignore it and wake/hand off instead.
    const result = senderRuntime.sendSignal(
      agent,
      { type: 'user-message', contents: 'steer' },
      { resourceId, threadId, ifActive: { behavior: 'discard' } },
      pubsub,
    );

    await expect(result.accepted).resolves.toEqual({ action: 'discard' });
    expect(subscription.activeRunId()).toBe('remote-run');
    expect((agent as any).stream).not.toHaveBeenCalled();

    subscription.unsubscribe();
    run.complete();
  });
});
