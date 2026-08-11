/**
 * Regression test for https://github.com/mastra-ai/mastra/issues/21223
 *
 * On a retained pubsub backend (Redis Streams), a fresh `subscribeToThread`
 * replays the topic backlog. A run that failed mid-stream (or whose process
 * died) published its partial chunks but never persisted a message, so
 * replaying it surfaces a phantom partial assistant message that hydrated
 * history can never reconcile. Replayed runs whose origin no longer holds the
 * thread lease must be buffered and only released to the subscriber when
 * their backlog proves they finished cleanly.
 */
import { describe, expect, it } from 'vitest';

import { PubSub } from '../../events/pubsub';
import type { LeaseProvider } from '../../events/pubsub';
import type { EventCallback } from '../../events/types';
import type { Agent } from '../agent';
import { AgentThreadStreamRuntime } from '../thread-stream-runtime';

const AGENT_THREAD_KEY_SEPARATOR = '\u0000';

function nextTicks(count = 5) {
  return Array.from({ length: count }).reduce<Promise<void>>(
    acc => acc.then(() => new Promise(resolve => setTimeout(resolve, 0))),
    Promise.resolve(),
  );
}

/** In-memory pubsub with a real lease provider, standing in for Redis Streams. */
class LeasePubSub extends PubSub implements LeaseProvider {
  owners = new Map<string, string>();
  #subscribers = new Map<string, Set<EventCallback>>();

  async publish(topic: string, event: any): Promise<void> {
    for (const subscriber of [...(this.#subscribers.get(topic) ?? [])]) {
      await subscriber({ ...event, id: 'evt', createdAt: new Date() }, async () => {});
    }
  }
  async flush(): Promise<void> {}
  async subscribe(topic: string, cb: EventCallback): Promise<void> {
    const subscribers = this.#subscribers.get(topic) ?? new Set<EventCallback>();
    subscribers.add(cb);
    this.#subscribers.set(topic, subscribers);
  }
  async unsubscribe(topic: string, cb: EventCallback): Promise<void> {
    this.#subscribers.get(topic)?.delete(cb);
  }
  async acquireLease(key: string, owner: string): Promise<{ acquired: boolean; owner?: string }> {
    const current = this.owners.get(key);
    if (current && current !== owner) return { acquired: false, owner: current };
    this.owners.set(key, owner);
    return { acquired: true, owner };
  }
  async getLeaseOwner(key: string): Promise<string | undefined> {
    return this.owners.get(key);
  }
  async releaseLease(key: string, owner: string): Promise<void> {
    if (this.owners.get(key) === owner) this.owners.delete(key);
  }
  async renewLease(key: string, owner: string): Promise<boolean> {
    return this.owners.get(key) === owner;
  }
  async transferLease(key: string, fromOwner: string, toOwner: string): Promise<boolean> {
    if (this.owners.get(key) !== fromOwner) return false;
    this.owners.set(key, toOwner);
    return true;
  }
}

const agent = { id: 'phantom-agent' } as Agent<any, any, any, any>;
const threadId = 'phantom-thread';
const resourceId = 'phantom-user';
const key = [resourceId, threadId].join(AGENT_THREAD_KEY_SEPARATOR);
const topic = `agent.thread-stream.${encodeURIComponent(key)}`;
const runId = 'replayed-run';
const streamId = 'replayed-stream';

function setup() {
  const runtime = new AgentThreadStreamRuntime();
  const pubsub = new LeasePubSub();
  const emit = (data: Record<string, unknown>) =>
    pubsub.publish(topic, { type: 'agent.thread-stream', runId: data.runId, data });
  const streamPart = (part: unknown) => emit({ type: 'stream-part', runId, streamId, sourceId: 'origin', part });
  return { runtime, pubsub, emit, streamPart };
}

async function collect(runtime: AgentThreadStreamRuntime, pubsub: LeasePubSub) {
  const subscription = await runtime.subscribeToThread(agent, { threadId, resourceId }, pubsub);
  const collected: Array<{ type: string }> = [];
  const consumed = (async () => {
    for await (const part of subscription.stream) collected.push(part as { type: string });
  })();
  return { subscription, collected, consumed };
}

describe('phantom replay of unpersisted runs', () => {
  it('does not replay a run that failed mid-stream and terminated with run-completed', async () => {
    const { runtime, pubsub, emit, streamPart } = setup();
    const { subscription, collected, consumed } = await collect(runtime, pubsub);

    // Replayed backlog of a dead run (no lease owner): partial content, an
    // in-band error, then the plain-stream() error path's `run-completed`.
    await emit({ type: 'run-registered', runId, streamId, streamSeq: 1 });
    await streamPart({ type: 'start', payload: {} });
    await streamPart({ type: 'text-delta', payload: { text: 'Your refund has been approved.' } });
    await streamPart({ type: 'error', payload: { error: 'connection dropped' } });
    await emit({ type: 'run-completed', runId, streamId });
    await nextTicks();

    expect(collected).toEqual([]);

    subscription.unsubscribe();
    await consumed;
    expect(collected).toEqual([]);
  });

  it('does not replay a run whose process crashed mid-stream (no terminal event)', async () => {
    const { runtime, pubsub, emit, streamPart } = setup();
    const { subscription, collected, consumed } = await collect(runtime, pubsub);

    await emit({ type: 'run-registered', runId, streamId, streamSeq: 1 });
    await streamPart({ type: 'start', payload: {} });
    await streamPart({ type: 'text-delta', payload: { text: 'partial' } });
    await nextTicks();

    expect(collected).toEqual([]);

    subscription.unsubscribe();
    await consumed;
    expect(collected).toEqual([]);
  });

  it('does not replay a run whose backlog terminates with run-failed', async () => {
    const { runtime, pubsub, emit, streamPart } = setup();
    const { subscription, collected, consumed } = await collect(runtime, pubsub);

    await emit({ type: 'run-registered', runId, streamId, streamSeq: 1 });
    await streamPart({ type: 'start', payload: {} });
    await streamPart({ type: 'text-delta', payload: { text: 'partial' } });
    await emit({ type: 'run-failed', runId, streamId, error: 'boom' });
    await nextTicks();

    expect(collected).toEqual([]);

    subscription.unsubscribe();
    await consumed;
  });

  it('still replays a run that completed cleanly', async () => {
    const { runtime, pubsub, emit, streamPart } = setup();
    const { subscription, collected, consumed } = await collect(runtime, pubsub);

    await emit({ type: 'run-registered', runId, streamId, streamSeq: 1 });
    await streamPart({ type: 'start', payload: {} });
    await streamPart({ type: 'text-delta', payload: { text: 'hello' } });
    await streamPart({
      type: 'finish',
      payload: { stepResult: { reason: 'stop' }, output: { usage: {} }, metadata: {} },
    });
    await emit({ type: 'run-completed', runId, streamId });
    await nextTicks();

    expect(collected.map(part => part.type)).toEqual(['start', 'text-delta', 'finish']);

    subscription.unsubscribe();
    await consumed;
  });

  it('trusts persisted: false over a clean-finish backlog', async () => {
    const { runtime, pubsub, emit, streamPart } = setup();
    const { subscription, collected, consumed } = await collect(runtime, pubsub);

    // Backlog looks clean, but the origin knows the storage flush failed.
    await emit({ type: 'run-registered', runId, streamId, streamSeq: 1 });
    await streamPart({ type: 'start', payload: {} });
    await streamPart({ type: 'text-delta', payload: { text: 'never stored' } });
    await streamPart({
      type: 'finish',
      payload: { stepResult: { reason: 'stop' }, output: { usage: {} }, metadata: {} },
    });
    await emit({ type: 'run-completed', runId, streamId, persisted: false });
    await nextTicks();

    expect(collected).toEqual([]);

    subscription.unsubscribe();
    await consumed;
  });

  it('trusts persisted: true even when the backlog is missing its finish chunk', async () => {
    const { runtime, pubsub, emit, streamPart } = setup();
    const { subscription, collected, consumed } = await collect(runtime, pubsub);

    // A subscriber can attach mid-topic-retention and miss trailing chunks;
    // the origin's verdict still marks the run as backed by storage.
    await emit({ type: 'run-registered', runId, streamId, streamSeq: 1 });
    await streamPart({ type: 'start', payload: {} });
    await streamPart({ type: 'text-delta', payload: { text: 'stored' } });
    await emit({ type: 'run-completed', runId, streamId, persisted: true });
    await nextTicks();

    expect(collected.map(part => part.type)).toEqual(['start', 'text-delta']);

    subscription.unsubscribe();
    await consumed;
  });

  it('defers a dead run discovered via stream-part without run-registered', async () => {
    const { runtime, pubsub, streamPart, emit } = setup();
    const { subscription, collected, consumed } = await collect(runtime, pubsub);

    // No run-registered in the retained window — first evidence of the run is
    // a replayed chunk. Dead origin (no lease), no terminal event: phantom.
    await streamPart({ type: 'start', payload: {} });
    await streamPart({ type: 'text-delta', payload: { text: 'partial' } });
    await nextTicks();

    expect(collected).toEqual([]);

    // A later clean terminal event still releases it.
    await streamPart({
      type: 'finish',
      payload: { stepResult: { reason: 'stop' }, output: { usage: {} }, metadata: {} },
    });
    await emit({ type: 'run-completed', runId, streamId, persisted: true });
    await nextTicks();

    expect(collected.map(part => part.type)).toEqual(['start', 'text-delta', 'finish']);

    subscription.unsubscribe();
    await consumed;
  });

  it('flushes a deferred run when it suspends (suspends persist a snapshot)', async () => {
    const { runtime, pubsub, emit, streamPart } = setup();
    const { subscription, collected, consumed } = await collect(runtime, pubsub);

    await emit({ type: 'run-registered', runId, streamId, streamSeq: 1 });
    await streamPart({ type: 'start', payload: {} });
    await streamPart({ type: 'text-delta', payload: { text: 'thinking' } });
    await emit({ type: 'run-suspended', runId, streamId });
    await nextTicks();

    expect(collected.map(part => part.type)).toEqual(['start', 'text-delta']);

    subscription.unsubscribe();
    await consumed;
  });

  it('still streams a live run whose origin holds the thread lease', async () => {
    const { runtime, pubsub, emit, streamPart } = setup();
    pubsub.owners.set(key, runId);
    const { subscription, collected, consumed } = await collect(runtime, pubsub);

    await emit({ type: 'run-registered', runId, streamId, streamSeq: 1 });
    await streamPart({ type: 'start', payload: {} });
    await streamPart({ type: 'text-delta', payload: { text: 'live' } });
    await nextTicks();

    // Live parts stream through immediately, before any terminal event.
    expect(collected.map(part => part.type)).toEqual(['start', 'text-delta']);

    await streamPart({
      type: 'finish',
      payload: { stepResult: { reason: 'stop' }, output: { usage: {} }, metadata: {} },
    });
    await emit({ type: 'run-completed', runId, streamId });
    await nextTicks();

    expect(collected.map(part => part.type)).toEqual(['start', 'text-delta', 'finish']);

    subscription.unsubscribe();
    await consumed;
  });
});
