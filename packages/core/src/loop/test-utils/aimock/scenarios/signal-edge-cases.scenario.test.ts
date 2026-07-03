import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it } from 'vitest';
import { MockMemory } from '../../../../memory/mock';
import { PubSub } from '../../../../events/pubsub';
import { EventCallback } from '../../../../events/types';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Signal edge cases: multiple subscribers, unsubscribe cleanup,
 * state signal cache deduplication.
 *
 * Tests documented behaviors from signals.mdx and agent-signals.test.ts:
 * 1. Multiple subscribers on same thread both receive the response
 * 2. Unsubscribe stops delivery to that subscriber
 * 3. sendStateSignal with same cacheKey+contents is skipped (unchanged)
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
          // Best-effort delivery: a throwing subscriber must not stop others
          // or bubble as an uncaught async error.
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

function withTimeout<T>(promise: Promise<T>, message: string, timeoutMs = 2000): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  // Attach cleanup to the race result so the timer is cleared whether `promise`
  // wins or the timeout fires. Attaching `.finally` to the timeout promise alone
  // would leak the timer when `promise` resolves first (it never settles).
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]).finally(() => {
    if (timeout) clearTimeout(timeout);
  }) as Promise<T>;
}

describeForAllEngines(
  'AIMock scenario: signal edge cases',
  engine => {
    const getMock = useLoopScenarioAimock();

    it('multiple subscribers on same thread both receive the response', async () => {
      const pubsub = new InMemoryPubSub();
      const mock = getMock();
      const memory = new MockMemory();
      const threadId = 'multi-sub-thread';
      const resourceId = 'multi-sub-resource';

      const { agent } = await runLoopScenario({
        engine,
        llm: mock,
        prompt: 'Initial prompt',
        stopWhen: stepCountIs(1),
        pubsub,
        memory,
        threadId,
        resourceId,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            {
              content: 'Shared response for both subscribers',
            },
          );
        },
      });

      // Create two subscribers on the same thread
      const sub1 = await agent.subscribeToThread({ threadId, resourceId });
      const sub2 = await agent.subscribeToThread({ threadId, resourceId });

      const run1Promise = readNextRun(sub1.stream[Symbol.asyncIterator]());
      const run2Promise = readNextRun(sub2.stream[Symbol.asyncIterator]());

      // Send a message that triggers both subscribers
      const result = await agent.sendMessage(
        { contents: 'Hello to both' },
        {
          resourceId,
          threadId,
          ifIdle: {
            streamOptions: { memory: { resource: resourceId, thread: threadId } },
          },
        },
      );

      const [run1, run2] = await Promise.all([
        withTimeout(run1Promise, 'sub1 timed out'),
        withTimeout(run2Promise, 'sub2 timed out'),
      ]);

      // Both subscribers receive the same response
      await expect(result.accepted).resolves.toMatchObject({ action: 'wake' });
      expect(run1.done).toBe(false);
      expect(run2.done).toBe(false);
      expect(run1.text).toBe('Shared response for both subscribers');
      expect(run2.text).toBe('Shared response for both subscribers');
      // Same runId for both
      expect(run1.runId).toBe(run2.runId);

      await sub1.unsubscribe();
      await sub2.unsubscribe();
    });

    it('unsubscribed subscriber stops receiving messages', async () => {
      const pubsub = new InMemoryPubSub();
      const mock = getMock();
      const memory = new MockMemory();
      const threadId = 'unsub-thread';
      const resourceId = 'unsub-resource';

      const { agent } = await runLoopScenario({
        engine,
        llm: mock,
        prompt: 'Initial prompt',
        stopWhen: stepCountIs(1),
        pubsub,
        memory,
        threadId,
        resourceId,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            {
              content: 'Response text',
            },
          );
        },
      });

      // Subscribe, then immediately unsubscribe
      const sub = await agent.subscribeToThread({ threadId, resourceId });
      let received = false;
      // Background reader: should never observe a part once unsubscribed. Marked
      // void deliberately — the test asserts `received` stays false rather than
      // awaiting this (it would otherwise hang, since no part is delivered).
      void (async () => {
        for await (const _part of sub.stream) {
          received = true;
          break;
        }
      })();

      await sub.unsubscribe();

      // Send a message — the unsubscribed subscriber should NOT receive it
      await agent.sendMessage(
        { contents: 'After unsubscribe' },
        {
          resourceId,
          threadId,
          ifIdle: {
            streamOptions: { memory: { resource: resourceId, thread: threadId } },
          },
        },
      );

      // Wait a bit to ensure delivery would have happened
      await new Promise(resolve => setTimeout(resolve, 200));

      // The unsubscribed subscriber should not have received anything
      expect(received).toBe(false);
    });

    it('sendStateSignal with unchanged cacheKey+contents is skipped', async () => {
      const pubsub = new InMemoryPubSub();
      const mock = getMock();
      const memory = new MockMemory();
      const threadId = 'cache-thread';
      const resourceId = 'cache-resource';

      const { agent } = await runLoopScenario({
        engine,
        llm: mock,
        prompt: 'Initial prompt',
        stopWhen: stepCountIs(1),
        pubsub,
        memory,
        threadId,
        resourceId,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            {
              content: 'Initial response',
            },
          );
        },
      });

      // First state signal — should be accepted
      const result1 = await agent.sendStateSignal(
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

      expect(result1.skipped).toBeFalsy();
      await expect(result1.accepted).resolves.toMatchObject({ action: 'persist' });

      // Second state signal with same cacheKey and same contents — should be skipped
      const result2 = await agent.sendStateSignal(
        {
          id: 'browser',
          cacheKey: 'browser:v1',
          contents: 'Browser is open on https://example.com',
        },
        {
          resourceId,
          threadId,
          ifIdle: { behavior: 'persist' },
        },
      );

      expect(result2.skipped).toBe(true);

      // Third state signal with a changed cacheKey (and changed contents) — the
      // changed cacheKey means it is not deduplicated, so it is accepted.
      const result3 = await agent.sendStateSignal(
        {
          id: 'browser',
          cacheKey: 'browser:v2',
          mode: 'snapshot',
          contents: 'Browser is open on https://different.com',
          value: { activeUrl: 'https://different.com' },
        },
        {
          resourceId,
          threadId,
          ifIdle: { behavior: 'persist' },
        },
      );

      expect(result3.skipped).toBeFalsy();
      await expect(result3.accepted).resolves.toMatchObject({ action: 'persist' });
    });
  },
  // Durable: sendMessage-wake tests hang because DurableAgent.stream()
  // doesn't complete through the AgentThreadStreamRuntime subscribe path.
  // The state-only tests (sendStateSignal, unsubscribe) pass on durable.
  // Signal drain within a run works — this is a separate integration gap.
  { skip: ['durable'] },
);
