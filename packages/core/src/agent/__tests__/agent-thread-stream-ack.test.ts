/**
 * Thread fan-out subscriptions are private per-subscriber consumer groups on a
 * persistent backend (Redis streams). Anything a subscriber never acknowledges
 * stays in that group's pending entries list forever, so both thread
 * subscribers must acknowledge *every* delivery they inspect — including
 * events they filter out — and must not unsubscribe before the terminal
 * acknowledgement lands.
 */
import { describe, expect, it } from 'vitest';

import { PubSub } from '../../events/pubsub';
import type { LeaseProvider } from '../../events/pubsub';
import type { EventCallback } from '../../events/types';
import type { Agent } from '../agent';
import { AgentThreadStreamRuntime } from '../thread-stream-runtime';

const AGENT_THREAD_KEY_SEPARATOR = '\u0000';

function nextTick() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * In-memory pubsub that models an acknowledged backend: every delivery stays
 * "pending" until the subscriber acks (removes it) or nacks (redelivery
 * eligible). Delivery order is preserved and publish resolves only once the
 * subscriber callback has settled, so tests can assert on the pending set.
 */
class AckTrackingPubSub extends PubSub implements LeaseProvider {
  owners = new Map<string, string>();
  acked: string[] = [];
  nacked: string[] = [];
  pending = new Set<string>();
  unsubscribedAt: number | null = null;
  #order = 0;
  #subscribers = new Map<string, Set<EventCallback>>();
  #index = 0;

  async publish(topic: string, event: any): Promise<void> {
    const id = `event-${this.#index++}`;
    const envelope = { ...event, id, createdAt: new Date() };
    for (const subscriber of [...(this.#subscribers.get(topic) ?? [])]) {
      this.pending.add(id);
      const ack = async () => {
        this.pending.delete(id);
        this.acked.push(id);
        this.#order++;
      };
      const nack = async () => {
        this.nacked.push(id);
      };
      try {
        await subscriber(envelope, ack, nack);
      } catch {
        // A rejected callback is the negative acknowledgement signal; a real
        // backend nacks on it rather than dropping the entry.
        await nack();
      }
    }
  }

  async flush(): Promise<void> {}

  async subscribe(topic: string, cb: EventCallback): Promise<void> {
    const subscribers = this.#subscribers.get(topic) ?? new Set<EventCallback>();
    subscribers.add(cb);
    this.#subscribers.set(topic, subscribers);
  }

  async unsubscribe(topic: string, cb: EventCallback): Promise<void> {
    this.unsubscribedAt = this.#order;
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

const agent = { id: 'ack-agent' } as Agent<any, any, any, any>;
const threadId = 'ack-thread';
const resourceId = 'ack-user';
const key = [resourceId, threadId].join(AGENT_THREAD_KEY_SEPARATOR);
const topic = `agent.thread-stream.${encodeURIComponent(key)}`;

describe('thread stream subscriber acknowledgements', () => {
  it('acks every delivered event, including ones it filters out', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new AckTrackingPubSub();
    pubsub.owners.set(key, 'remote-run');

    const subscription = await runtime.subscribeToThread(agent, { threadId, resourceId }, pubsub);

    // An event with no payload is ignored by the handler but still delivered.
    await pubsub.publish(topic, { type: 'agent.thread-stream', runId: 'remote-run', data: undefined });
    await pubsub.publish(topic, {
      type: 'agent.thread-stream',
      runId: 'remote-run',
      data: { type: 'run-registered', runId: 'remote-run', streamId: 'remote-stream', streamSeq: 1 },
    });
    await pubsub.publish(topic, {
      type: 'agent.thread-stream',
      runId: 'remote-run',
      data: {
        type: 'stream-part',
        runId: 'remote-run',
        streamId: 'remote-stream',
        sourceId: 'other-process',
        part: { type: 'text-delta', payload: { text: 'hi' } },
      },
    });
    await pubsub.publish(topic, {
      type: 'agent.thread-stream',
      runId: 'remote-run',
      data: { type: 'run-completed', runId: 'remote-run', streamId: 'remote-stream' },
    });

    expect(pubsub.acked).toHaveLength(4);
    expect(pubsub.pending.size).toBe(0);
    expect(pubsub.nacked).toEqual([]);

    subscription.unsubscribe();
  });

  it('nacks a delivery whose processing throws and keeps processing later events', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new AckTrackingPubSub();

    const subscription = await runtime.subscribeToThread(agent, { threadId, resourceId }, pubsub);

    // `state` signals cannot be transient — createSignal throws, which is the
    // subscriber's negative acknowledgement path.
    await pubsub.publish(topic, {
      type: 'agent.thread-stream',
      runId: 'remote-run',
      data: {
        type: 'signal-enqueued',
        runId: 'remote-run',
        sourceId: 'other-process',
        signal: { type: 'state', transient: true, contents: 'boom' },
      },
    });

    expect(pubsub.nacked).toHaveLength(1);
    expect(pubsub.acked).toEqual([]);
    expect(pubsub.pending.size).toBe(1);

    await pubsub.publish(topic, {
      type: 'agent.thread-stream',
      runId: 'remote-run',
      data: { type: 'run-registered', runId: 'remote-run', streamId: 'remote-stream', streamSeq: 1 },
    });
    expect(pubsub.acked).toHaveLength(1);

    subscription.unsubscribe();
  });

  it('acks every event the remote-run waiter inspects before unsubscribing', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new AckTrackingPubSub();
    pubsub.owners.set(key, 'remote-run');

    // Seed the runtime's view of the thread with a remote run that has no local
    // record, which is what routes the waiter through #waitForRemoteRunToFinish.
    const seeder = await runtime.subscribeToThread(agent, { threadId, resourceId }, pubsub);
    await pubsub.publish(topic, {
      type: 'agent.thread-stream',
      runId: 'remote-run',
      data: { type: 'run-registered', runId: 'remote-run', streamId: 'remote-stream', streamSeq: 1 },
    });
    seeder.unsubscribe();

    const ackedBefore = pubsub.acked.length;
    const waiting = runtime.waitForCrossAgentThreadRun(
      { id: 'other-agent' } as Agent<any, any, any, any>,
      { memory: { thread: threadId, resource: resourceId } } as any,
      pubsub,
    );
    await nextTick();

    // A non-terminal event is acked even though the waiter ignores it.
    await pubsub.publish(topic, {
      type: 'agent.thread-stream',
      runId: 'remote-run',
      data: {
        type: 'stream-part',
        runId: 'remote-run',
        streamId: 'remote-stream',
        sourceId: 'other-process',
        part: { type: 'text-delta', payload: { text: 'hi' } },
      },
    });
    pubsub.owners.delete(key);
    await pubsub.publish(topic, {
      type: 'agent.thread-stream',
      runId: 'remote-run',
      data: { type: 'run-completed', runId: 'remote-run', streamId: 'remote-stream' },
    });

    await waiting;

    expect(pubsub.acked.length - ackedBefore).toBe(2);
    expect(pubsub.pending.size).toBe(0);
    // Unsubscribe must happen after the terminal ack, never racing it.
    expect(pubsub.unsubscribedAt).toBe(pubsub.acked.length);
  });
});
