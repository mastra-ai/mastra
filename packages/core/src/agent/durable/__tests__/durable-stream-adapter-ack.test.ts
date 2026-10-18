/**
 * Regression test for https://github.com/mastra-ai/mastra/issues/24348
 *
 * The durable stream adapter subscribes to a run's stream topic directly and
 * hands `handleEvent` (which takes only the event) to `subscribeWithReplay` /
 * `subscribeFromOffset` / `subscribe`. `handleEvent` never saw the `ack`
 * handle, so on a durable backend every chunk of a stream stayed pending and
 * was redelivered.
 *
 * `RecordingPubSub` captures ack/nack per delivery, so the assertion observes
 * the contract instead of inferring it from streamed output. It fails when the
 * adapter passes `handleEvent` through unwrapped.
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';

import { PubSub } from '../../../events/pubsub';
import type { LeaseProvider } from '../../../events/pubsub';
import type { EventCallback } from '../../../events/types';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

/** PubSub that records ack/nack for every delivery instead of routing it. */
class RecordingPubSub extends PubSub implements LeaseProvider {
  owners = new Map<string, string>();
  #subscribers = new Map<string, Set<EventCallback>>();
  deliveries: Array<{ topic: string; acked: boolean }> = [];

  async publish(topic: string, event: any): Promise<void> {
    for (const subscriber of [...(this.#subscribers.get(topic) ?? [])]) {
      const record = { topic, acked: false };
      this.deliveries.push(record);
      await subscriber({ ...event, id: 'evt', createdAt: new Date() }, async () => {
        record.acked = true;
      });
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
  async acquireLease(key: string, owner: string) {
    this.owners.set(key, owner);
    return { acquired: true, owner };
  }
  async getLeaseOwner(key: string) {
    return this.owners.get(key);
  }
  async releaseLease(key: string, owner: string) {
    if (this.owners.get(key) === owner) this.owners.delete(key);
  }
  async renewLease(key: string, owner: string) {
    return this.owners.get(key) === owner;
  }
  async transferLease(key: string, fromOwner: string, toOwner: string) {
    if (this.owners.get(key) !== fromOwner) return false;
    this.owners.set(key, toOwner);
    return true;
  }
}

function createTextModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'hello' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  });
}

describe('durable stream adapter acknowledges every delivery', () => {
  it('acks every event delivered on the run stream topic', async () => {
    const pubsub = new RecordingPubSub();
    const baseAgent = new Agent({
      id: 'ack-agent',
      name: 'Ack Agent',
      instructions: 'Test',
      model: createTextModel() as LanguageModelV2,
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    const { output, runId, cleanup } = await durableAgent.stream('Go');

    await output.consumeStream();

    const { AGENT_STREAM_TOPIC } = await import('../constants');
    const topic = AGENT_STREAM_TOPIC(runId);
    const deliveries = pubsub.deliveries.filter(d => d.topic === topic);

    // The run published real events, and the adapter was subscribed.
    expect(deliveries.length).toBeGreaterThan(0);
    expect(deliveries.filter(d => !d.acked)).toEqual([]);

    cleanup();
  });
});
