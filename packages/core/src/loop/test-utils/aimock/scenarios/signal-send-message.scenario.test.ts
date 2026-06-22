import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, expect, it } from 'vitest';
import { MockMemory } from '../../../../memory/mock';
import { PubSub } from '../../../../events/pubsub';
import { EventCallback } from '../../../../events/types';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Signal integration (sendMessage + subscribeToThread)
 *
 * Tests the documented signal API from signals.mdx:
 * 1. Subscribe to a thread via `agent.subscribeToThread()`
 * 2. Send a message via `agent.sendMessage()`
 * 3. Verify the subscription receives the response
 *
 * Uses a real in-memory PubSub implementation (matching the pattern from
 * agent-signals.test.ts) to enable signal flow through the Mastra instance.
 */

class InMemoryPubSub extends PubSub {
  #subscribers = new Map<string, Set<EventCallback>>();
  #index = 0;
  #pending = new Set<Promise<void>>();

  async publish(topic: string, event: any, _options?: { localOnly?: boolean }): Promise<void> {
    const subscribers = [...(this.#subscribers.get(topic) ?? [])];
    const envelope = {
      ...event,
      id: `event-${this.#index}`,
      createdAt: new Date(),
      index: this.#index++,
    };
    const pending = new Promise<void>(resolve => {
      setTimeout(() => {
        try {
          // Best-effort delivery: one subscriber throwing must not stop the
          // others from being notified, and must not bubble as an uncaught
          // async error (mirrors PubSub semantics in core/src/events/pubsub.ts).
          for (const subscriber of subscribers) {
            try {
              subscriber(envelope);
            } catch {
              // ignore individual subscriber failures
            }
          }
        } finally {
          resolve();
        }
      }, 0);
    });
    this.#pending.add(pending);
    pending.finally(() => this.#pending.delete(pending));
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
}

async function readNextRun(iterator: AsyncIterator<any>) {
  let runId: string | undefined;
  let text = '';
  const parts: any[] = [];

  while (true) {
    const next = await iterator.next();
    if (next.done) return { runId, text, parts, done: true };

    const part = next.value;
    parts.push(part);
    runId ??= part.runId;
    if (part.type === 'text-delta') {
      text += part.payload.text;
    }
    if (part.type === 'finish' || part.type === 'error' || part.type === 'abort') {
      return { runId, text, parts, done: false };
    }
  }
}

describe('AIMock scenario: signal sendMessage integration', () => {
  const getMock = useLoopScenarioAimock();

  it('subscribes to thread and receives sendMessage response', async () => {
    const pubsub = new InMemoryPubSub();
    const mock = getMock();

    const { agent } = await runLoopScenario({
      llm: mock,
      prompt: 'Initial prompt',
      stopWhen: stepCountIs(1),
      pubsub,
      fixtures: llm => {
        llm.on({ endpoint: 'chat', hasToolResult: false }, {
          content: 'Initial response',
        });
      },
    });

    // Now test the signal API
    const threadId = 'signal-test-thread';
    const resourceId = 'signal-test-resource';

    // Subscribe to the thread
    const subscription = await agent.subscribeToThread({
      threadId,
      resourceId,
    });

    // Set up to read the next run from the subscription
    const nextRunPromise = readNextRun(subscription.stream[Symbol.asyncIterator]());

    // Send a message via the signal API
    const result = await agent.sendMessage(
      { contents: 'Hello from signal', attributes: { sentFrom: 'test' } },
      {
        resourceId,
        threadId,
        ifIdle: {
          streamOptions: {
            memory: { resource: resourceId, thread: threadId },
          },
        },
      },
    );

    // Wait for the response
    const subscribedRun = await nextRunPromise;

    // Verify the signal was accepted and processed
    await expect(result.accepted).resolves.toMatchObject({
      action: 'wake',
      runId: subscribedRun.runId,
    });

    expect(result.signal).toMatchObject({
      type: 'user',
      tagName: 'user',
      contents: 'Hello from signal',
    });

    // Verify the subscription received the run
    expect(subscribedRun.done).toBe(false);
    expect(subscribedRun.text).toBe('Initial response');

    await subscription.unsubscribe();
  });

  it('sendStateSignal persists state without waking agent', async () => {
    const pubsub = new InMemoryPubSub();
    const mock = getMock();
    const memory = new MockMemory();

    const { agent } = await runLoopScenario({
      llm: mock,
      prompt: 'Initial prompt',
      stopWhen: stepCountIs(1),
      pubsub,
      memory,
      threadId: 'state-test-thread',
      resourceId: 'state-test-resource',
      fixtures: llm => {
        llm.on({ endpoint: 'chat', hasToolResult: false }, {
          content: 'Initial response',
        });
      },
    });

    const threadId = 'state-test-thread';
    const resourceId = 'state-test-resource';

    // Send a state signal with persist-only behavior
    const result = await agent.sendStateSignal(
      {
        id: 'browser',
        cacheKey: 'browser:v1',
        mode: 'snapshot',
        contents: 'Browser is open on https://example.com',
        value: { activeUrl: 'https://example.com' },
      },
      {
        resourceId,
        threadId,
        ifIdle: { behavior: 'persist' },
      },
    );

    // Verify the state signal was persisted
    expect(result.skipped).toBeFalsy();
    await expect(result.accepted).resolves.toMatchObject({ action: 'persist' });
    expect(result.signal).toMatchObject({
      type: 'state',
      tagName: 'state',
      metadata: expect.objectContaining({
        state: expect.objectContaining({
          id: 'browser',
          cacheKey: 'browser:v1',
          mode: 'snapshot',
        }),
      }),
    });
  });
});
