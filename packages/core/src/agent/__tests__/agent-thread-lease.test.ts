/**
 * Every thread-bound run registered through `registerRun` must hold the
 * cross-process thread lease while it is live. PR #19806 made lease ownership
 * authoritative for run liveness (markActiveIfLive / #waitForRemoteRunToFinish
 * treat a lease-less run as a ghost), so a plain `agent.stream()` run that
 * never acquires the lease is invisible to contending instances — they start
 * competing runs instead of serializing behind it.
 *
 * Kept in its own file (rather than agent-signals.test.ts) so the suite Tyler's
 * PR shipped stays untouched.
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

async function waitForCondition(predicate: () => boolean, timeoutMs = 2_000) {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await nextTick();
  }
}

/**
 * Minimal in-memory pubsub that also implements LeaseProvider, mirroring
 * ControlledLeasePubSub in agent-signals.test.ts (copied, not imported, to
 * keep that file untouched).
 */
class ControlledLeasePubSub extends PubSub implements LeaseProvider {
  owners = new Map<string, string>();
  #subscribers = new Map<string, Set<EventCallback>>();
  #pending = new Set<Promise<void>>();
  #index = 0;

  async publish(topic: string, event: any): Promise<void> {
    const envelope = { ...event, id: `event-${this.#index}`, createdAt: new Date(), index: this.#index++ };
    const subscribers = [...(this.#subscribers.get(topic) ?? [])];
    const pending = new Promise<void>(resolve => {
      setTimeout(() => {
        for (const subscriber of subscribers) subscriber(envelope);
        resolve();
      }, 0);
    });
    this.#pending.add(pending);
    void pending.finally(() => this.#pending.delete(pending));
  }

  async subscribe(topic: string, cb: EventCallback): Promise<void> {
    const subscribers = this.#subscribers.get(topic) ?? new Set<EventCallback>();
    subscribers.add(cb);
    this.#subscribers.set(topic, subscribers);
  }

  async unsubscribe(topic: string, cb: EventCallback): Promise<void> {
    this.#subscribers.get(topic)?.delete(cb);
  }

  async flush(): Promise<void> {
    await Promise.all([...this.#pending]);
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

describe('registerRun thread lease', () => {
  it('acquires the thread lease for a plain thread-bound run and releases it on completion', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new ControlledLeasePubSub();
    const agent = { id: 'plain-lease-agent' } as Agent<any, any, any, any>;
    const threadId = 'plain-lease-thread';
    const resourceId = 'plain-lease-user';
    const key = [resourceId, threadId].join(AGENT_THREAD_KEY_SEPARATOR);
    const runId = 'plain-lease-run-1';

    let finish!: () => void;
    const finished = new Promise<void>(resolve => {
      finish = resolve;
    });
    const fullStream = new ReadableStream({
      start(controller) {
        controller.enqueue({ type: 'start', runId });
        controller.enqueue({
          type: 'finish',
          runId,
          payload: { usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, finishReason: 'stop' },
        });
        controller.close();
      },
    });

    const registered = runtime.registerRun(
      agent,
      {
        runId,
        status: 'running',
        fullStream,
        _waitUntilFinished: () => finished,
      } as any,
      { memory: { thread: threadId, resource: resourceId } } as any,
      pubsub,
    );
    expect(registered).toBeDefined();
    await registered;

    // A plain (non-signal) run must own the cross-process thread lease once
    // registration settles — otherwise remote liveness checks treat it as a
    // ghost and contending instances start competing runs.
    expect(pubsub.owners.get(key)).toBe(runId);

    finish();
    // Release is fire-and-forget inside the completion watcher's finally —
    // poll rather than asserting immediately.
    await waitForCondition(() => pubsub.owners.get(key) === undefined);
  });
});
