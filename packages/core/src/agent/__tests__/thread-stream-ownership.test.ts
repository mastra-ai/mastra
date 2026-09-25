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

  it('ignores a live same-source redelivery for a finished local run', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new LeasePubSub();
    pubsub.retain = true;
    const threadId = 'same-source-thread';
    const resourceId = 'same-source-user';
    const topic = `agent.thread-stream.${encodeURIComponent([resourceId, threadId].join('\u0000'))}`;
    const agent = { id: 'same-source-agent' } as unknown as Agent<any, any, any, any>;

    const runA = registerRun(runtime, agent, pubsub, 'run-a', threadId, resourceId);
    await runA.registered;
    runA.markFinished();
    pubsub.owners.clear();
    const runB = registerRun(runtime, agent, pubsub, 'run-b', threadId, resourceId);
    await runB.registered;

    // Without initial history nothing counts as backlog, so only the
    // same-source rule stands between run A's redelivery and the thread.
    const subscription = await runtime.subscribeToThread(agent, { threadId, resourceId }, pubsub);
    const registeredA = pubsub
      .retainedEvents(topic)
      .find(event => event.data?.type === 'run-registered' && event.runId === 'run-a');
    await pubsub.publish(topic, registeredA);
    await nextTicks(20);

    expect(subscription.activeRunId()).toBe('run-b');
    subscription.unsubscribe();
    runA.complete();
    runB.complete();
  });

  it('does not deliver a signal to a remote run owned by a different agent', async () => {
    const ownerRuntime = new AgentThreadStreamRuntime();
    const senderRuntime = new AgentThreadStreamRuntime();
    const pubsub = new LeasePubSub();
    const ownerAgent = { id: 'owner-agent' } as unknown as Agent<any, any, any, any>;
    const senderAgent = { id: 'sender-agent', stream: vi.fn() } as unknown as Agent<any, any, any, any>;
    const threadId = 'cross-agent-thread';
    const resourceId = 'cross-agent-user';

    const subscription = await senderRuntime.subscribeToThread(senderAgent, { threadId, resourceId }, pubsub);
    const run = registerRun(ownerRuntime, ownerAgent, pubsub, 'owner-run', threadId, resourceId);
    await run.registered;
    await vi.waitFor(() => expect(subscription.activeRunId()).toBe('owner-run'));

    const result = senderRuntime.sendSignal(
      senderAgent,
      { type: 'user-message', contents: 'hello' },
      { resourceId, threadId },
      pubsub,
    );

    await expect(result.accepted).resolves.toEqual({ action: 'blocked', reason: 'thread-blocked', runId: 'owner-run' });
    expect((senderAgent as any).stream).not.toHaveBeenCalled();

    subscription.unsubscribe();
    run.complete();
  });

  it('forgets remote ownership once the last observer leaves', async () => {
    const ownerRuntime = new AgentThreadStreamRuntime();
    const senderRuntime = new AgentThreadStreamRuntime();
    const pubsub = new LeasePubSub();
    const agent = { id: 'observer-gap-agent' } as unknown as Agent<any, any, any, any>;
    const threadId = 'observer-gap-thread';
    const resourceId = 'observer-gap-user';

    const first = await senderRuntime.subscribeToThread(agent, { threadId, resourceId }, pubsub);
    const run = registerRun(ownerRuntime, agent, pubsub, 'gap-run', threadId, resourceId);
    await run.registered;
    await vi.waitFor(() => expect(first.activeRunId()).toBe('gap-run'));
    first.unsubscribe();

    // The run can finish while nobody observes it; a later observer must not
    // inherit the stale remote ownership.
    run.complete();
    await nextTicks(20);
    const second = await senderRuntime.subscribeToThread(agent, { threadId, resourceId }, pubsub);
    const result = senderRuntime.sendSignal(
      agent,
      { type: 'user-message', contents: 'late' },
      { resourceId, threadId, ifIdle: { behavior: 'discard' } },
      pubsub,
    );
    await expect(result.accepted).resolves.toEqual({ action: 'discard' });
    second.unsubscribe();
  });

  it('does not let a lease that reports a finished local run as live displace the active run', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new LeasePubSub();
    pubsub.retain = true;
    const threadId = 'lease-replay-thread';
    const resourceId = 'lease-replay-user';
    const topic = `agent.thread-stream.${encodeURIComponent([resourceId, threadId].join('\u0000'))}`;
    const agent = { id: 'lease-replay-agent' } as unknown as Agent<any, any, any, any>;

    const runA = registerRun(runtime, agent, pubsub, 'run-a', threadId, resourceId);
    await runA.registered;
    runA.markFinished();
    pubsub.owners.clear();
    const runB = registerRun(runtime, agent, pubsub, 'run-b', threadId, resourceId);
    await runB.registered;
    const subscription = await runtime.subscribeToThread(agent, { threadId, resourceId }, pubsub);

    // Fallback lease providers report every run as leased; model that by
    // pointing the lease at run A before its registration is redelivered.
    const [leaseKey] = [...pubsub.owners.keys()];
    pubsub.owners.set(leaseKey!, 'run-a');
    const registeredA = pubsub
      .retainedEvents(topic)
      .find(event => event.data?.type === 'run-registered' && event.runId === 'run-a');
    await pubsub.publish(topic, { ...registeredA, data: { ...registeredA.data, sourceId: 'other-instance' } });
    await nextTicks(20);

    expect(subscription.activeRunId()).toBe('run-b');
    subscription.unsubscribe();
    runA.complete();
    runB.complete();
  });

  it('does not deliver a signal to a remote run whose owner agent is unknown', async () => {
    const senderRuntime = new AgentThreadStreamRuntime();
    const pubsub = new LeasePubSub();
    const senderAgent = { id: 'unknown-owner-sender', stream: vi.fn() } as unknown as Agent<any, any, any, any>;
    const threadId = 'unknown-owner-thread';
    const resourceId = 'unknown-owner-user';
    const key = [resourceId, threadId].join('\u0000');
    const topic = `agent.thread-stream.${encodeURIComponent(key)}`;

    const subscription = await senderRuntime.subscribeToThread(senderAgent, { threadId, resourceId }, pubsub);
    // A stream part arrives before the run's registration, so the owner agent is unknown.
    pubsub.owners.set(key, 'part-first-run');
    await pubsub.publish(topic, {
      type: 'agent.thread-stream',
      runId: 'part-first-run',
      data: {
        type: 'stream-part',
        runId: 'part-first-run',
        streamId: 'part-first-stream',
        sourceId: 'other-instance',
        part: { type: 'start', runId: 'part-first-run' },
      },
    });
    await vi.waitFor(() => expect(subscription.activeRunId()).toBe('part-first-run'));

    const result = senderRuntime.sendSignal(
      senderAgent,
      { type: 'user-message', contents: 'hello' },
      { resourceId, threadId },
      pubsub,
    );

    await expect(result.accepted).resolves.toEqual({
      action: 'blocked',
      reason: 'thread-blocked',
      runId: 'part-first-run',
    });
    expect((senderAgent as any).stream).not.toHaveBeenCalled();
    subscription.unsubscribe();
  });
});
