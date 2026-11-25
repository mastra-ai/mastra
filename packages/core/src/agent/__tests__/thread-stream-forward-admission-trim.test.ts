/**
 * A process that forwards a user message to another process's run holds its copy until the owner admits it.
 * The owner's run trim must not erase that admission before a lagging forwarder reads it, or the forwarder sees
 * the run end alone, queues its copy again and the message runs twice.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EventCallback } from '../../events/types';
import { MockMemory } from '../../memory/mock';
import { Agent } from '../agent';
import { AgentThreadStreamRuntime } from '../thread-stream-runtime';
import { createBlockingFirstTextStreamModel, waitForCondition } from './signals-test-utils';
import { LeasePubSub } from './thread-stream-test-utils';

/**
 * Models Redis Streams readers: publish doesn't wait for them, each reads its entries in order, and a reader that
 * has fallen behind (paused) reads the retained stream from where it stopped on resume, so entries deleted in
 * between are never seen.
 */
class LaggingReaderPubSub extends LeasePubSub {
  lagNewSubscribers = false;
  #lagging: Array<{ topic: string; read: (event: any) => void; caughtUp: () => Promise<void> }> = [];
  #paused = false;
  /** Event types the lagging readers have handled. */
  handledTypes: string[] = [];

  override async subscribe(topic: string, cb: EventCallback): Promise<void> {
    const lags = this.lagNewSubscribers;
    const seen = new Set<string>();
    let tail = Promise.resolve();
    const read = (event: any) => {
      if (seen.has(event.id)) return;
      seen.add(event.id);
      tail = tail
        .then(() => new Promise<void>(resolve => setTimeout(resolve, 0)))
        .then(async () => {
          await cb(event);
          if (lags) this.handledTypes.push(event.data?.type);
        });
    };
    if (lags) this.#lagging.push({ topic, read, caughtUp: () => tail });
    return super.subscribe(topic, event => {
      if (!(lags && this.#paused)) read(event);
    });
  }

  laggingReaders() {
    return this.#lagging.length;
  }

  /** Resolves once every lagging reader has handled everything it has read, including what it read meanwhile. */
  async caughtUp() {
    let handled: number;
    do {
      handled = this.handledTypes.length;
      await Promise.all(this.#lagging.map(reader => reader.caughtUp()));
    } while (handled !== this.handledTypes.length);
  }

  pause() {
    this.#paused = true;
  }

  resume() {
    this.#paused = false;
    for (const reader of this.#lagging) {
      for (const event of this.retainedEvents(reader.topic)) reader.read(event);
    }
  }
}

/**
 * The owner admits and runs a forward while the forwarder's reader lags, then trims the run and lets go of the lease.
 */
async function forwardWhileLagging() {
  const scope = { resourceId: 'forward-admission-user', threadId: 'forward-admission-thread' };
  const pubsub = new LaggingReaderPubSub();
  pubsub.retain = true;
  const completed: string[] = [];
  let admitted!: () => void;
  const forwardAdmitted = new Promise<void>(resolve => {
    admitted = resolve;
  });
  const publish = pubsub.publish.bind(pubsub);
  pubsub.publish = async (topic: string, event: any) => {
    if (event.type === 'run-completed') completed.push(event.runId);
    await publish(topic, event);
    // The forwarder falls behind right after sending its forward.
    if (event.data?.type === 'signal-enqueued' && JSON.stringify(event.data.signal).includes('idle B')) {
      pubsub.pause();
    }
    if (
      event.data?.type === 'user-message-presentation' &&
      event.data.chunk.data.metadata?.status === 'pending' &&
      JSON.stringify(event.data.chunk).includes('idle B')
    ) {
      admitted();
    }
  };
  const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel(
    'first response',
    'later response',
  );
  const doStream = model.doStream.bind(model);
  model.doStream = async options => {
    if (getStreamCount() !== 1) return doStream(options);
    // Keep the follow-up run live until it has admitted the forward.
    const result = await doStream(options);
    const held = new TransformStream({ flush: () => forwardAdmitted });
    return { ...result, stream: result.stream.pipeThrough(held) };
  };
  const agent = new Agent({
    id: 'forward-admission',
    name: 'Forward admission',
    instructions: 'Test',
    model,
    memory: new MockMemory(),
    pubsub,
  });
  const ownerSubscription = await agent.subscribeToThread(scope);
  const follower = new AgentThreadStreamRuntime();
  pubsub.lagNewSubscribers = true;
  const followerSubscription = await follower.subscribeToThread(agent, scope, pubsub);
  pubsub.lagNewSubscribers = false;
  // The follower's thread control subscription and its stream reader both lag.
  expect(pubsub.laggingReaders()).toBe(2);
  for (const subscription of [ownerSubscription, followerSubscription]) {
    void (async () => {
      for await (const _ of subscription.stream);
    })();
  }
  const stream = await agent.stream('first', { memory: { resource: scope.resourceId, thread: scope.threadId } });
  const topic = pubsub.retainedTopics()[0]!;
  const idleBRuns = () =>
    model.doStreamCalls.filter(call => {
      const users = (call.prompt as any[]).filter(message => message.role === 'user');
      return JSON.stringify(users.at(-1)).includes('idle B');
    }).length;
  try {
    await vi.waitFor(() => expect(getStreamCount()).toBe(1));
    await agent.sendSignal({ type: 'user-message', contents: 'pending A' }, scope).accepted;
    await vi.waitFor(() => expect(followerSubscription.activeRunId()).toBe(stream.runId));
    await follower.queueMessage(agent, 'idle B', scope, pubsub).accepted;
    // Cancelling the first run hands "pending A" to a follow-up run that holds the lease when the follower
    // forwards "idle B" to it.
    expect(ownerSubscription.abort()).toBe(true);
    releaseFirst();
    await stream.text;
    await forwardAdmitted;

    // The owner admits and runs the forward, and its runs end and are trimmed while the forwarder lags.
    await vi.waitFor(() => expect(idleBRuns()).toBe(1), { timeout: 2_000 });
    await vi.waitFor(() => expect(pubsub.owners.size).toBe(0), { timeout: 2_000 });
    await waitForCondition(() => completed.length === 2, 2_000);
    // The admitting run's trim has landed: only its terminal events are left under its run ID.
    await waitForCondition(
      () =>
        pubsub
          .retainedEvents(topic)
          .filter(event => event.runId === completed[1])
          .every(event => ['run-registered', 'run-completed'].includes(event.data?.type)),
      2_000,
    );

    pubsub.resume();
    await pubsub.caughtUp();
    await vi.waitFor(() => expect(pubsub.owners.size).toBe(0));
    expect(idleBRuns()).toBe(1);
  } finally {
    admitted();
    releaseFirst();
    ownerSubscription.unsubscribe();
    followerSubscription.unsubscribe();
  }
}

describe('forwarded user message admission', () => {
  // Lease checks run on the interval timer, which is the only one faked.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs a forwarded message once when the owner trims its run before the forwarder reads the admission', () =>
    forwardWhileLagging());
});
