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
