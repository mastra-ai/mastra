/**
 * Shared fixtures for thread-stream deferred-replay tests
 * (thread-stream-phantom-replay.test.ts, thread-stream-replay-ordering.test.ts).
 */
import { PubSub } from '../../events/pubsub';
import type { LeaseProvider } from '../../events/pubsub';
import type { EventCallback } from '../../events/types';
import type { Agent } from '../agent';
import { AgentThreadStreamRuntime } from '../thread-stream-runtime';

export const AGENT_THREAD_KEY_SEPARATOR = '\u0000';

export function nextTicks(count = 5) {
  return Array.from({ length: count }).reduce<Promise<void>>(
    acc => acc.then(() => new Promise(resolve => setTimeout(resolve, 0))),
    Promise.resolve(),
  );
}

/** In-memory pubsub with a real lease provider, standing in for Redis Streams. */
export class LeasePubSub extends PubSub implements LeaseProvider {
  owners = new Map<string, string>();
  /** Deliver retained events after subscribe() returns, as Redis Streams does. */
  delayBacklog = false;
  #subscribers = new Map<string, Set<EventCallback>>();
  /** One entry per delivery, in publish order — enough to assert what was acked. */
  deliveries: Array<{ topic: string; event: any; acked: boolean; nacked: boolean }> = [];
  /** Topics whose publishes reject, to model a reply that never reaches the backend. */
  failPublish = new Set<string>();
  /** When true, topics keep every event and replay the backlog to new subscribers, like Redis Streams. */
  retain = false;
  #retained = new Map<string, any[]>();

  /** Delay each `stream-part` publish, like a remote round trip, so publishing lags production. */
  streamPartDelayMs = 0;

  async publish(topic: string, event: any): Promise<void> {
    if (this.failPublish.has(topic)) throw new Error(`publish to ${topic} failed`);
    if (this.streamPartDelayMs && event.data?.type === 'stream-part') {
      await new Promise(resolve => setTimeout(resolve, this.streamPartDelayMs));
    }
    const stamped = { ...event, id: 'evt', createdAt: event.createdAt ?? new Date() };
    if (this.retain) this.#retained.set(topic, [...(this.#retained.get(topic) ?? []), stamped]);
    for (const subscriber of [...(this.#subscribers.get(topic) ?? [])]) {
      await this.#deliver(topic, stamped, subscriber);
    }
  }
  async #deliver(topic: string, event: any, subscriber: EventCallback) {
    {
      const record = { topic, event, acked: false, nacked: false };
      this.deliveries.push(record);
      await subscriber(
        event,
        async () => {
          record.acked = true;
        },
        async () => {
          record.nacked = true;
        },
      );
    }
  }
  async flush(): Promise<void> {}
  async subscribe(topic: string, cb: EventCallback): Promise<void> {
    const subscribers = this.#subscribers.get(topic) ?? new Set<EventCallback>();
    subscribers.add(cb);
    this.#subscribers.set(topic, subscribers);
    const backlog = [...(this.#retained.get(topic) ?? [])];
    if (this.delayBacklog) {
      // Redis Streams returns from subscribe() before the backlog is read.
      setTimeout(
        () =>
          void (async () => {
            for (const event of backlog) await this.#deliver(topic, event, cb);
          })(),
        0,
      );
      return;
    }
    for (const event of backlog) await this.#deliver(topic, event, cb);
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

export interface ThreadStreamHarness {
  agent: Agent<any, any, any, any>;
  threadId: string;
  resourceId: string;
  topic: string;
  runId: string;
  streamId: string;
}

export function createHarness(prefix: string): ThreadStreamHarness {
  const threadId = `${prefix}-thread`;
  const resourceId = `${prefix}-user`;
  const key = [resourceId, threadId].join(AGENT_THREAD_KEY_SEPARATOR);
  return {
    agent: { id: `${prefix}-agent` } as Agent<any, any, any, any>,
    threadId,
    resourceId,
    topic: `agent.thread-stream.${encodeURIComponent(key)}`,
    runId: `${prefix}-run`,
    streamId: `${prefix}-stream`,
  };
}

export function setupRuntime(harness: ThreadStreamHarness) {
  const runtime = new AgentThreadStreamRuntime();
  const pubsub = new LeasePubSub();
  const emit = (data: Record<string, unknown>) =>
    pubsub.publish(harness.topic, { type: 'agent.thread-stream', runId: data.runId, data });
  const streamPart = (part: unknown) =>
    emit({ type: 'stream-part', runId: harness.runId, streamId: harness.streamId, sourceId: 'origin', part });
  return { runtime, pubsub, emit, streamPart };
}

export async function collectThread(
  harness: ThreadStreamHarness,
  runtime: AgentThreadStreamRuntime,
  pubsub: LeasePubSub,
) {
  const subscription = await runtime.subscribeToThread(
    harness.agent,
    { threadId: harness.threadId, resourceId: harness.resourceId },
    pubsub,
  );
  const collected: Array<{ type: string }> = [];
  const consumed = (async () => {
    for await (const part of subscription.stream) collected.push(part as { type: string });
  })();
  return { subscription, collected, consumed };
}
