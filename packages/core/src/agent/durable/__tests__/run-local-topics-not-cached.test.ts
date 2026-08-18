import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect } from 'vitest';
import { InMemoryServerCache } from '../../../cache/inmemory';
import type { Event } from '../../../events/types';
import { Mastra } from '../../../mastra';
import { Agent } from '../../agent';
import { AGENT_STREAM_TOPIC } from '../constants';
import { createEventedAgent } from '../index';

/**
 * Regression for #21668.
 *
 * The durable agent's CachingPubSub wraps `mastra.pubsub`, which is the proxy
 * that tags run-local publishes `localOnly`. Because the cache sits *above* the
 * proxy, it never observes that flag — so the `localOnly` bypass inside
 * CachingPubSub was unreachable for exactly the topic it was meant to protect,
 * and per-run `workflow.events.v2.*` watch events (cumulative step results,
 * routinely megabytes) were RPUSHed into a shared store no other instance can
 * read (#20646).
 *
 * The agent now declares the policy at construction time via `shouldCache`.
 */
describe('durable/evented agent — run-local topics are never written to the cache (#21668)', () => {
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

  function makeRegisteredAgent(id: string) {
    // Records every write so the assertion is about the store itself, not just
    // about what getHistory() happens to return.
    const writes: string[] = [];
    const cache = new InMemoryServerCache();
    const listPush = cache.listPush.bind(cache);
    cache.listPush = async (key: string, value: any) => {
      writes.push(key);
      return listPush(key, value);
    };
    const increment = cache.increment.bind(cache);
    cache.increment = async (key: string, amount: number) => {
      writes.push(key);
      return increment(key, amount);
    };

    const agent = createEventedAgent({
      agent: new Agent({ id, name: id, instructions: 'test', model: makeMockModel() }),
    });
    const mastra = new Mastra({ cache, agents: { [id]: agent as any } });
    void mastra;

    return { agent, writes };
  }

  it('does not write workflow.events.v2.* events to the cache', async () => {
    const { agent, writes } = makeRegisteredAgent('run-local-agent');
    const topic = `workflow.events.v2.run-1`;

    await agent.pubsub.publish(topic, { type: 'watch', runId: 'run-1', data: { big: 'payload' } });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(writes).toEqual([]);
    expect(await agent.pubsub.getHistory(topic)).toHaveLength(0);
  });

  it('still delivers workflow.events.v2.* events live to subscribers', async () => {
    const { agent } = makeRegisteredAgent('run-local-agent-2');
    const topic = `workflow.events.v2.run-2`;
    const received: Event[] = [];

    await agent.pubsub.subscribe(topic, event => {
      received.push(event);
    });
    await agent.pubsub.publish(topic, { type: 'watch', runId: 'run-2', data: { foo: 'bar' } });

    expect(received.map(event => event.type)).toEqual(['watch']);
  });

  it('still caches agent stream events, which observe/replay depends on', async () => {
    const { agent, writes } = makeRegisteredAgent('run-local-agent-3');
    const topic = AGENT_STREAM_TOPIC('run-3');

    await agent.pubsub.publish(topic, { type: 'chunk', runId: 'run-3', data: { c: '0' } });
    await agent.pubsub.publish(topic, { type: 'chunk', runId: 'run-3', data: { c: '1' } });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(writes.length).toBeGreaterThan(0);
    const history = await agent.pubsub.getHistory(topic);
    expect(history.map(e => (e.data as { c: string }).c)).toEqual(['0', '1']);
  });
});
