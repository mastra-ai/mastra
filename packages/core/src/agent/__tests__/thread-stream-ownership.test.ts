/**
 * Thread ownership must survive history replay and instance boundaries (#24878):
 * a replayed `run-registered` for a finished local run must not displace the
 * live run, and `sendSignal` must deliver to an active run owned by another
 * runtime instance instead of treating the thread as idle.
 */
import { describe, expect, it, vi } from 'vitest';

import type { Agent } from '../agent';
import { AgentThreadStreamRuntime, THREAD_OWNER_DID_NOT_ACCEPT_SIGNAL_ERROR_ID } from '../thread-stream-runtime';
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

  it('ignores a redelivered run-registered for a finished run whose record was already cleaned up', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new LeasePubSub();
    pubsub.retain = true;
    const threadId = 'redelivery-owner-thread';
    const resourceId = 'redelivery-owner-user';
    const topic = `agent.thread-stream.${encodeURIComponent([resourceId, threadId].join('\u0000'))}`;
    const agent = {
      id: 'redelivery-owner-agent',
      getMemory: async () => ({
        getThreadById: async ({ threadId }: { threadId: string }) => ({ id: threadId }),
        recall: async () => ({ messages: [], hasMore: false }),
      }),
    } as unknown as Agent<any, any, any, any>;

    // Run A finishes and its local record is removed, as a durable run's is.
    const runA = registerRun(runtime, agent, pubsub, 'run-a', threadId, resourceId);
    await runA.registered;
    const registeredA = pubsub
      .retainedEvents(topic)
      .find(event => event.data?.type === 'run-registered' && event.runId === 'run-a');
    expect(registeredA).toBeDefined();
    runA.complete();
    await nextTicks(20);

    const runB = registerRun(runtime, agent, pubsub, 'run-b', threadId, resourceId);
    await runB.registered;

    const subscription = await runtime.subscribeToThread(agent, { threadId, resourceId }, pubsub);
    await nextTicks(20);
    expect(subscription.activeRunId()).toBe('run-b');

    // Same-source redelivery (e.g. a reclaimed stream entry) while B still runs.
    await pubsub.publish(topic, registeredA);
    await nextTicks(20);

    expect(subscription.activeRunId()).toBe('run-b');
    subscription.unsubscribe();
    runB.complete();
  });

  it('ignores a redelivered run-registered after the run ended on an idle thread', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new LeasePubSub();
    pubsub.retain = true;
    const threadId = 'idle-redelivery-thread';
    const resourceId = 'idle-redelivery-user';
    const topic = `agent.thread-stream.${encodeURIComponent([resourceId, threadId].join('\u0000'))}`;
    const agent = {
      id: 'idle-redelivery-agent',
      getMemory: async () => ({
        getThreadById: async ({ threadId }: { threadId: string }) => ({ id: threadId }),
        recall: async () => ({ messages: [], hasMore: false }),
      }),
    } as unknown as Agent<any, any, any, any>;

    const subscription = await runtime.subscribeToThread(agent, { threadId, resourceId }, pubsub);
    const runA = registerRun(runtime, agent, pubsub, 'run-a', threadId, resourceId);
    await runA.registered;
    await nextTicks(20);
    expect(subscription.activeRunId()).toBe('run-a');
    const registeredA = pubsub
      .retainedEvents(topic)
      .find(event => event.data?.type === 'run-registered' && event.runId === 'run-a');
    expect(registeredA).toBeDefined();

    runA.complete();
    await nextTicks(20);
    expect(subscription.activeRunId()).toBeNull();

    await pubsub.publish(topic, registeredA);
    await nextTicks(20);

    expect(subscription.activeRunId()).toBeNull();
    subscription.unsubscribe();
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

  // A failed lease check defers the registration; a later stream-part promotes the run. The owner agent
  // from the registration must survive that, or a same-agent follow-up is treated as cross-agent.
  it('delivers a thread-targeted signal to a remote run promoted after a failed lease check', async () => {
    const ownerRuntime = new AgentThreadStreamRuntime();
    const senderRuntime = new AgentThreadStreamRuntime();
    const pubsub = new LeasePubSub();
    const agent = { id: 'promoted-signal-agent', stream: vi.fn() } as unknown as Agent<any, any, any, any>;
    const threadId = 'promoted-signal-thread';
    const resourceId = 'promoted-signal-user';
    const topic = `agent.thread-stream.${encodeURIComponent([resourceId, threadId].join('\u0000'))}`;

    const subscription = await senderRuntime.subscribeToThread(agent, { threadId, resourceId }, pubsub);
    vi.spyOn(pubsub, 'getLeaseOwner').mockRejectedValueOnce(new Error('Lease unavailable'));
    const run = registerRun(ownerRuntime, agent, pubsub, 'remote-run', threadId, resourceId);
    await run.registered;
    await nextTicks(10);
    const streamId = pubsub.deliveries.find(
      ({ event }) => event.data?.type === 'run-registered' && event.runId === 'remote-run',
    )?.event.data.streamId;
    await pubsub.publish(topic, {
      type: 'agent.thread-stream',
      runId: 'remote-run',
      data: {
        type: 'stream-part',
        runId: 'remote-run',
        streamId,
        sourceId: 'origin',
        part: { type: 'text-delta', payload: { text: 'live' } },
      },
    });
    await vi.waitFor(() => expect(subscription.activeRunId()).toBe('remote-run'));

    const result = senderRuntime.sendSignal(
      agent,
      { type: 'user-message', contents: 'steer' },
      { resourceId, threadId, ifActive: { behavior: 'discard' } },
      pubsub,
    );

    await expect(result.accepted).resolves.toEqual({ action: 'discard' });
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

    for (const ifActive of [undefined, { behavior: 'persist' as const }, { behavior: 'discard' as const }]) {
      const result = senderRuntime.sendSignal(
        senderAgent,
        { type: 'user-message', contents: 'hello' },
        { resourceId, threadId, ifActive },
        pubsub,
      );

      expect(result.persisted).toBeUndefined();
      await expect(result.accepted).resolves.toEqual({
        action: 'blocked',
        reason: 'thread-blocked',
        runId: 'owner-run',
      });
    }
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

  it('starts a new run when the lease disappears between acquisition and owner lookup', async () => {
    class VanishingLeasePubSub extends LeasePubSub {
      first = true;
      override async acquireLease(key: string, owner: string) {
        if (this.first) {
          this.first = false;
          return { acquired: false, owner: undefined };
        }
        return super.acquireLease(key, owner);
      }
    }
    const pubsub = new VanishingLeasePubSub();
    const runtime = new AgentThreadStreamRuntime();
    const agent = {
      id: 'vanishing-lease-agent',
      stream: vi.fn(async (_signal: unknown, options: { runId: string }) => ({ runId: options.runId })),
    } as unknown as Agent<any, any, any, any>;

    const result = runtime.sendSignal(
      agent,
      { type: 'user-message', contents: 'not lost' },
      { resourceId: 'user', threadId: 'thread' },
      pubsub,
    );
    const accepted = await result.accepted;
    expect(accepted.action).toBe('wake');
    expect((agent as any).stream).toHaveBeenCalledOnce();
    runtime.releaseThreadRunReservation(accepted.runId!, pubsub);
  });

  it('does not report delivery to an ended run whose lease is still being released', async () => {
    let release!: () => void;
    const released = new Promise<void>(resolve => {
      release = resolve;
    });
    let releasing!: () => void;
    const releaseStarted = new Promise<void>(resolve => {
      releasing = resolve;
    });
    let checked!: () => void;
    const leaseChecked = new Promise<void>(resolve => {
      checked = resolve;
    });
    class DelayedReleasePubSub extends LeasePubSub {
      override async releaseLease(key: string, owner: string) {
        releasing();
        await released;
        return super.releaseLease(key, owner);
      }
      override async acquireLease(key: string, owner: string) {
        const lease = await super.acquireLease(key, owner);
        if (owner !== 'ended-run') checked();
        return lease;
      }
    }
    const pubsub = new DelayedReleasePubSub();
    const owner = new AgentThreadStreamRuntime();
    const sender = new AgentThreadStreamRuntime();
    const agent = {
      id: 'ending-run-agent',
      stream: vi.fn(async (_signal: unknown, options: { runId: string }) => ({ runId: options.runId })),
    } as unknown as Agent<any, any, any, any>;
    const run = registerRun(owner, agent, pubsub, 'ended-run', 'thread', 'user');
    await run.registered;
    run.complete();
    await releaseStarted;

    const result = sender.sendSignal(
      agent,
      { type: 'user-message', contents: 'not lost' },
      { resourceId: 'user', threadId: 'thread' },
      pubsub,
    );
    await leaseChecked;
    release();
    const accepted = await result.accepted;
    expect(accepted.action).toBe('wake');
    expect(accepted.runId).not.toBe('ended-run');
    expect((agent as any).stream).toHaveBeenCalledOnce();
    sender.releaseThreadRunReservation(accepted.runId!, pubsub);
  });

  it('confirms a live owner admitted a remotely forwarded signal', async () => {
    const pubsub = new LeasePubSub();
    const owner = new AgentThreadStreamRuntime();
    const sender = new AgentThreadStreamRuntime();
    const agent = { id: 'live-owner-agent', stream: vi.fn() } as unknown as Agent<any, any, any, any>;
    const run = registerRun(owner, agent, pubsub, 'live-run', 'thread', 'user');
    await run.registered;

    const result = sender.sendSignal(
      agent,
      { type: 'user-message', contents: 'delivered' },
      { resourceId: 'user', threadId: 'thread' },
      pubsub,
    );
    expect(await result.accepted).toEqual({ action: 'deliver', runId: 'live-run' });
    expect((agent as any).stream).not.toHaveBeenCalled();
    run.complete();
  });

  it('re-acknowledges an admitted signal when the first acceptance reply is lost', async () => {
    class DroppedReplyPubSub extends LeasePubSub {
      replies = 0;
      override async publish(topic: string, event: any) {
        if (event.data?.type === 'signal-accepted' && ++this.replies === 1) return;
        return super.publish(topic, event);
      }
    }
    const pubsub = new DroppedReplyPubSub();
    const owner = new AgentThreadStreamRuntime();
    const sender = new AgentThreadStreamRuntime();
    const agent = { id: 'retry-owner-agent', stream: vi.fn() } as unknown as Agent<any, any, any, any>;
    const run = registerRun(owner, agent, pubsub, 'retry-run', 'thread', 'user');
    await run.registered;

    const result = sender.sendSignal(
      agent,
      { type: 'user-message', contents: 'retry delivery' },
      { resourceId: 'user', threadId: 'thread' },
      pubsub,
    );
    expect(await result.accepted).toEqual({ action: 'deliver', runId: 'retry-run' });
    expect(pubsub.replies).toBe(2);
    run.complete();
  });

  it('does not acknowledge a finished run while its terminal broadcast is pending', async () => {
    const pubsub = new LeasePubSub();
    pubsub.streamPartDelayMs = 500;
    const owner = new AgentThreadStreamRuntime();
    const agent = { id: 'finished-owner-agent', stream: vi.fn() } as unknown as Agent<any, any, any, any>;
    const run = registerRun(owner, agent, pubsub, 'finished-run', 'thread', 'user');
    await run.registered;
    run.complete();
    await nextTicks();

    const key = 'user\u0000thread';
    const topic = `agent.thread-stream.${encodeURIComponent(key)}`;
    const replyTopic = `${topic}.signal-acceptance.test`;
    let acknowledged = false;
    await pubsub.subscribe(replyTopic, async (_event, ack) => {
      acknowledged = true;
      await ack();
    });
    await pubsub.publish(topic, {
      type: 'agent.thread-stream',
      runId: 'finished-run',
      data: {
        type: 'signal-enqueued',
        runId: 'finished-run',
        sourceId: 'other-instance',
        signal: { id: 'late-signal', type: 'user-message', contents: 'late', createdAt: new Date() },
        replyTopic,
        requestId: 'late-request',
      },
    });
    expect(pubsub.owners.get(key)).toBe('finished-run');
    expect(acknowledged).toBe(false);
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

  // A pub/sub that can hold back and drop thread events on their way to
  // subscribers, to model a reader that lags behind production and a
  // `run-completed` lost to a Redis restart or trim.
  class LossyPubSub extends LeasePubSub {
    holding = false;
    held: Array<{ topic: string; event: any }> = [];
    dropTypes = new Set<string>();
    override async publish(topic: string, event: any): Promise<void> {
      if (this.dropTypes.has(event.data?.type)) return;
      if (this.holding && topic.startsWith('agent.thread-stream.') && !topic.includes('.signal-acceptance.')) {
        this.held.push({ topic, event });
        return;
      }
      return super.publish(topic, event);
    }
    async flush() {
      this.holding = false;
      for (const { topic, event } of this.held.splice(0)) await this.publish(topic, event);
    }
  }

  it('does not mark a local run active from its own registration echo after it ended here', async () => {
    const pubsub = new LossyPubSub();
    const runtime = new AgentThreadStreamRuntime();
    const threadId = 'late-echo-thread';
    const resourceId = 'late-echo-user';
    const agent = {
      id: 'late-echo-agent',
      stream: vi.fn(async (_signal: unknown, options: { runId: string }) => ({ runId: options.runId })),
    } as unknown as Agent<any, any, any, any>;

    const subscription = await runtime.subscribeToThread(agent, { threadId, resourceId }, pubsub);
    // The reader falls behind, then the run finishes and is cleaned up locally.
    pubsub.holding = true;
    const run = registerRun(runtime, agent, pubsub, 'ended-here', threadId, resourceId);
    await run.registered;
    run.complete();
    await nextTicks(20);
    // The registration echo arrives late and `run-completed` never does.
    pubsub.dropTypes.add('run-completed');
    await pubsub.flush();
    await nextTicks(20);
    pubsub.dropTypes.clear();

    expect(subscription.activeRunId()).toBeNull();
    const result = runtime.sendSignal(
      agent,
      { type: 'user-message', contents: 'next turn' },
      { resourceId, threadId },
      pubsub,
    );
    const accepted = await result.accepted;
    expect(accepted.action).toBe('wake');
    expect((agent as any).stream).toHaveBeenCalledOnce();
    runtime.releaseThreadRunReservation(accepted.runId!, pubsub);
    subscription.unsubscribe();
  });

  it('does not mark a local run active from its own late stream parts while its lease is still being released', async () => {
    const pubsub = new LossyPubSub();
    const runtime = new AgentThreadStreamRuntime();
    const threadId = 'late-parts-thread';
    const resourceId = 'late-parts-user';
    const key = [resourceId, threadId].join('\u0000');
    const agent = {
      id: 'late-parts-agent',
      stream: vi.fn(async (_signal: unknown, options: { runId: string }) => ({ runId: options.runId })),
    } as unknown as Agent<any, any, any, any>;

    const subscription = await runtime.subscribeToThread(agent, { threadId, resourceId }, pubsub);
    pubsub.holding = true;
    const run = registerRun(runtime, agent, pubsub, 'ended-here', threadId, resourceId);
    await run.registered;
    run.complete();
    await nextTicks(20);
    // The registration echo and stream parts reach the reader while the lease
    // release is still in flight; `run-completed` is lost.
    pubsub.owners.set(key, 'ended-here');
    pubsub.dropTypes.add('run-completed');
    await pubsub.flush();
    await nextTicks(20);
    pubsub.dropTypes.clear();
    pubsub.owners.delete(key);

    expect(subscription.activeRunId()).toBeNull();
    const result = runtime.sendSignal(
      agent,
      { type: 'user-message', contents: 'next turn' },
      { resourceId, threadId },
      pubsub,
    );
    const accepted = await result.accepted;
    expect(accepted.action).toBe('wake');
    expect((agent as any).stream).toHaveBeenCalledOnce();
    runtime.releaseThreadRunReservation(accepted.runId!, pubsub);
    subscription.unsubscribe();
  });

  it('starts a new run when a remote run ended without its run-completed reaching this process', async () => {
    const pubsub = new LossyPubSub();
    const ownerRuntime = new AgentThreadStreamRuntime();
    const senderRuntime = new AgentThreadStreamRuntime();
    const threadId = 'missed-completion-thread';
    const resourceId = 'missed-completion-user';
    const agent = {
      id: 'missed-completion-agent',
      stream: vi.fn(async (_signal: unknown, options: { runId: string }) => ({ runId: options.runId })),
    } as unknown as Agent<any, any, any, any>;

    const subscription = await senderRuntime.subscribeToThread(agent, { threadId, resourceId }, pubsub);
    const run = registerRun(ownerRuntime, agent, pubsub, 'remote-ended', threadId, resourceId);
    await run.registered;
    await vi.waitFor(() => expect(subscription.activeRunId()).toBe('remote-ended'));
    // The run ends at its owner, but its `run-completed` is trimmed or lost.
    pubsub.dropTypes.add('run-completed');
    run.complete();
    await vi.waitFor(() => expect(pubsub.owners.has([resourceId, threadId].join('\u0000'))).toBe(false));
    pubsub.dropTypes.clear();

    const result = senderRuntime.sendSignal(
      agent,
      { type: 'user-message', contents: 'next turn' },
      { resourceId, threadId },
      pubsub,
    );
    const accepted = await result.accepted;
    expect(accepted.action).toBe('wake');
    expect(accepted.runId).not.toBe('remote-ended');
    expect((agent as any).stream).toHaveBeenCalledOnce();
    senderRuntime.releaseThreadRunReservation(accepted.runId!, pubsub);
    subscription.unsubscribe();
  });

  describe('when a live remote run acknowledges late or never', () => {
    class AckDroppingPubSub extends LossyPubSub {
      acksToDrop = 0;
      droppedAcks = 0;
      enqueued = 0;
      onDroppedAck?: () => void;
      override async publish(topic: string, event: any): Promise<void> {
        if (event.data?.type === 'signal-enqueued') this.enqueued++;
        if (event.data?.type === 'signal-accepted' && this.droppedAcks < this.acksToDrop) {
          this.droppedAcks++;
          this.onDroppedAck?.();
          return;
        }
        return super.publish(topic, event);
      }
    }

    const setup = async (acksToDrop: number) => {
      const pubsub = new AckDroppingPubSub();
      pubsub.acksToDrop = acksToDrop;
      const ownerRuntime = new AgentThreadStreamRuntime();
      const senderRuntime = new AgentThreadStreamRuntime();
      const threadId = `lost-ack-thread-${acksToDrop}`;
      const resourceId = 'lost-ack-user';
      const agent = {
        id: 'lost-ack-agent',
        stream: vi.fn(async (_signal: unknown, options: { runId: string }) => ({ runId: options.runId })),
      } as unknown as Agent<any, any, any, any>;
      const ownerSubscription = await ownerRuntime.subscribeToThread(agent, { threadId, resourceId }, pubsub);
      const subscription = await senderRuntime.subscribeToThread(agent, { threadId, resourceId }, pubsub);
      const run = registerRun(ownerRuntime, agent, pubsub, 'remote-live', threadId, resourceId);
      await run.registered;
      await vi.waitFor(() => expect(subscription.activeRunId()).toBe('remote-live'));
      const result = senderRuntime.sendSignal(
        agent,
        { type: 'user-message', contents: 'while remote runs' },
        { resourceId, threadId },
        pubsub,
      );
      return {
        pubsub,
        agent,
        run,
        result,
        cleanup: () => (subscription.unsubscribe(), ownerSubscription.unsubscribe()),
      };
    };

    it('delivers to the live run once and starts no second run when its first acknowledgement is lost', async () => {
      const { pubsub, agent, run, result, cleanup } = await setup(1);
      const accepted = await result.accepted;
      expect(accepted).toMatchObject({ action: 'deliver', runId: 'remote-live' });
      expect(pubsub.droppedAcks).toBe(1);
      // The retry re-forwarded the same signal to the lease holder; no run was started for it.
      expect(pubsub.enqueued).toBeGreaterThanOrEqual(2);
      expect((agent as any).stream).not.toHaveBeenCalled();
      run.complete();
      cleanup();
    }, 20_000);

    it('rejects without starting a second run when the live run never acknowledges', async () => {
      const { agent, run, result, cleanup } = await setup(Number.POSITIVE_INFINITY);
      await expect(result.accepted).rejects.toThrow(/Thread owner did not accept signal/);
      await expect(result.accepted).rejects.toMatchObject({
        id: THREAD_OWNER_DID_NOT_ACCEPT_SIGNAL_ERROR_ID,
        domain: 'AGENT',
        details: { threadId: 'lost-ack-thread-Infinity', resourceId: 'lost-ack-user', retryable: true },
      });
      expect((agent as any).stream).not.toHaveBeenCalled();
      run.complete();
      cleanup();
    }, 20_000);

    it('runs the signal once when the run ends after admitting it and its acknowledgement is lost', async () => {
      const pubsub = new AckDroppingPubSub();
      pubsub.acksToDrop = 1;
      const ownerRuntime = new AgentThreadStreamRuntime();
      const senderRuntime = new AgentThreadStreamRuntime();
      const threadId = 'lost-ack-ended-thread';
      const resourceId = 'lost-ack-user';
      const agent = {
        id: 'lost-ack-agent',
        stream: vi.fn(async (_signal: unknown, options: { runId: string }) => ({ runId: options.runId })),
      } as unknown as Agent<any, any, any, any>;
      const ownerSubscription = await ownerRuntime.subscribeToThread(agent, { threadId, resourceId }, pubsub);
      const subscription = await senderRuntime.subscribeToThread(agent, { threadId, resourceId }, pubsub);
      const run = registerRun(ownerRuntime, agent, pubsub, 'remote-ending', threadId, resourceId);
      await run.registered;
      await vi.waitFor(() => expect(subscription.activeRunId()).toBe('remote-ending'));
      // The owner admits the signal, then the run ends and releases its lease while the ack is lost.
      pubsub.onDroppedAck = () => run.complete();
      const result = senderRuntime.sendSignal(
        agent,
        { type: 'user-message', contents: 'admitted then ended' },
        { resourceId, threadId },
        pubsub,
      );
      const accepted = await result.accepted;
      // The owner's follow-up drain ran the admitted signal; the sender's retry was
      // re-forwarded to that run and deduplicated instead of waking a second run.
      expect(accepted.action).toBe('deliver');
      await new Promise(resolve => setTimeout(resolve, 1_000));
      const stream = (agent as any).stream;
      expect(stream).toHaveBeenCalledTimes(1);
      expect(stream.mock.calls[0][1].runId).toBe(accepted.runId);
      // The follow-up run received the admitted signal itself, not just some run.
      expect(stream.mock.calls[0][0]).toEqual(
        expect.objectContaining({ id: result.signal.id, contents: 'admitted then ended' }),
      );
      expect(ownerRuntime.drainPendingSignals('remote-ending', pubsub)).toEqual([]);
      subscription.unsubscribe();
      ownerSubscription.unsubscribe();
    }, 20_000);
  });
});
