import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect } from 'vitest';
import { InMemoryServerCache } from '../../../cache/inmemory';
import { CachingPubSub } from '../../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { Agent } from '../../agent';
import { AGENT_STREAM_TOPIC } from '../constants';
import { createEventedAgent } from '../index';

/**
 * Regression for #18148.
 *
 * When a user passes a CachingPubSub to `new Mastra({ pubsub })`, the agent
 * adopts mastra.pubsub as its inner transport on registration. If the agent then
 * wraps it again in its own CachingPubSub sharing the same cache, every event is
 * stored twice (once per layer, with consecutive indices), so observe()/replay
 * delivers the buffered prefix doubled. The agent must reuse the already-caching
 * pubsub instead of double-wrapping it.
 */
describe('durable/evented agent — no double-wrapping of an already-caching pubsub (#18148)', () => {
  function makeMockModel() {
    return new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'text-delta', textDelta: 'hi' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    }) as LanguageModelV2;
  }

  it('caches each event once when mastra.pubsub is a CachingPubSub sharing the cache', async () => {
    const cache = new InMemoryServerCache();
    const pubsub = new CachingPubSub(new EventEmitterPubSub(), cache);

    const baseAgent = new Agent({
      id: 'demo-agent',
      name: 'Demo Agent',
      instructions: 'test',
      model: makeMockModel(),
    });
    const agent = createEventedAgent({ agent: baseAgent });

    // Registration makes the agent adopt mastra.pubsub as its inner transport.
    const mastra = new Mastra({ pubsub, cache, agents: { 'demo-agent': agent as any } });
    void mastra;

    // The already-caching pubsub must be reused, not wrapped again.
    expect(agent.pubsub).toBe(mastra.pubsub);

    const topic = AGENT_STREAM_TOPIC('run-1');
    await agent.pubsub.publish(topic, { type: 'chunk', runId: 'run-1', data: { c: '0' } });
    await agent.pubsub.publish(topic, { type: 'chunk', runId: 'run-1', data: { c: '1' } });
    await agent.pubsub.publish(topic, { type: 'chunk', runId: 'run-1', data: { c: '2' } });

    const history = await agent.pubsub.getHistory(topic);
    // Before the fix this was 6 (every event cached twice). Must be 3.
    expect(history).toHaveLength(3);
    expect(history.map(e => (e.data as { c: string }).c)).toEqual(['0', '1', '2']);
  });

  it('still wraps a non-caching inner pubsub exactly once', async () => {
    // Default Mastra pubsub is a plain EventEmitterPubSub; the agent should add
    // a single caching layer so replay still works.
    const baseAgent = new Agent({
      id: 'demo-agent-2',
      name: 'Demo Agent 2',
      instructions: 'test',
      model: makeMockModel(),
    });
    const agent = createEventedAgent({ agent: baseAgent });
    const mastra = new Mastra({ agents: { 'demo-agent-2': agent as any } });
    void mastra;

    const topic = AGENT_STREAM_TOPIC('run-2');
    await agent.pubsub.publish(topic, { type: 'chunk', runId: 'run-2', data: { c: '0' } });
    await agent.pubsub.publish(topic, { type: 'chunk', runId: 'run-2', data: { c: '1' } });

    const history = await agent.pubsub.getHistory(topic);
    expect(history).toHaveLength(2);
  });
});
