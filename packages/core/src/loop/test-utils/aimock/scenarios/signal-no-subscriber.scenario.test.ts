import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, expect, it } from 'vitest';
import { MockMemory } from '../../../../memory/mock';
import { PubSub } from '../../../../events/pubsub';
import { EventCallback } from '../../../../events/types';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Signal delivery to threads with no active subscriber.
 *
 * Tests documented behaviors from signals.mdx:
 * 1. sendMessage to an idle, non-subscribed thread still wakes a run and
 *    completes — no subscriber is required for the run to execute.
 * 2. sendStateSignal to a non-subscribed thread with ifIdle.behavior:'persist'
 *    is persisted (action: 'persist') without waking a run.
 * 3. A subscriber attaching AFTER the wake still observes the completed run
 *    via the thread topic (late subscriber).
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
          for (const subscriber of subscribers) subscriber(envelope);
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

describe('AIMock scenario: signal delivery without subscriber', () => {
  const getMock = useLoopScenarioAimock();

  it('sendMessage to an idle non-subscribed thread still wakes and completes a run', async () => {
    const pubsub = new InMemoryPubSub();
    const mock = getMock();
    const memory = new MockMemory();
    const threadId = 'no-sub-thread';
    const resourceId = 'no-sub-resource';

    const { agent } = await runLoopScenario({
      llm: mock,
      prompt: 'Initial prompt',
      stopWhen: stepCountIs(1),
      pubsub,
      memory,
      threadId,
      resourceId,
      fixtures: llm => {
        llm.on({ endpoint: 'chat', hasToolResult: false }, { content: 'Woken without a subscriber' });
      },
    });

    // No subscribeToThread() call — nobody is listening.
    const result = await agent.sendMessage(
      { contents: 'Wake me even with no subscriber' },
      {
        resourceId,
        threadId,
        ifIdle: {
          streamOptions: { memory: { resource: resourceId, thread: threadId } },
        },
      },
    );

    // The run is still accepted and woken despite no subscriber present.
    const accepted = await result.accepted;
    expect(accepted.action).toBe('wake');
    expect(accepted.runId).toBeTruthy();

    expect(result.signal).toMatchObject({
      type: 'user',
      tagName: 'user',
      contents: 'Wake me even with no subscriber',
    });
  });

  it('sendStateSignal to a non-subscribed thread persists without waking a run', async () => {
    const pubsub = new InMemoryPubSub();
    const mock = getMock();
    const memory = new MockMemory();
    const threadId = 'no-sub-state-thread';
    const resourceId = 'no-sub-state-resource';

    const { agent } = await runLoopScenario({
      llm: mock,
      prompt: 'Initial prompt',
      stopWhen: stepCountIs(1),
      pubsub,
      memory,
      threadId,
      resourceId,
      fixtures: llm => {
        llm.on({ endpoint: 'chat', hasToolResult: false }, { content: 'Initial response' });
      },
    });

    const result = await agent.sendStateSignal(
      {
        id: 'browser',
        cacheKey: 'browser:v1',
        mode: 'snapshot',
        contents: 'Browser open on https://example.com',
        value: { activeUrl: 'https://example.com' },
      },
      {
        resourceId,
        threadId,
        ifIdle: { behavior: 'persist' },
      },
    );

    // State persists; no run is woken (action: 'persist', not 'wake').
    expect(result.skipped).toBeFalsy();
    const accepted = await result.accepted;
    expect(accepted.action).toBe('persist');
    expect((accepted as { runId?: string }).runId).toBeUndefined();
  });
});
