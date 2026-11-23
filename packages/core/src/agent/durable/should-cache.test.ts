/**
 * `shouldCache` lets callers opt individual topics out of the replay cache so
 * a hot topic (e.g. per-chunk stream events against a remote Redis) can be
 * published straight through to the inner PubSub. The run-local exclusion
 * (issue #20646) must still apply on top of whatever the caller returns.
 */

import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { InMemoryServerCache } from '../../cache';
import { CachingPubSub } from '../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Agent } from '../agent';
import { createDurableAgent } from './create-durable-agent';
import { createEventedAgent } from './create-evented-agent';

const makeAgent = () =>
  new Agent({
    id: 'inner',
    name: 'inner',
    instructions: 'x',
    model: new MockLanguageModelV2({}),
  });

const cacheKeyFor = (topic: string) => `pubsub:${topic}`;

describe('DurableAgent shouldCache', () => {
  it('caches every non-run-local topic by default', async () => {
    const cache = new InMemoryServerCache();
    const durable = createDurableAgent({ agent: makeAgent(), pubsub: new EventEmitterPubSub(), cache });

    await durable.pubsub.publish('agent.stream.run-1', { type: 'chunk', data: {} });

    expect(await cache.listLength(cacheKeyFor('agent.stream.run-1'))).toBe(1);
  });

  it('skips the cache for topics the caller opts out, still delivering live', async () => {
    const cache = new InMemoryServerCache();
    const inner = new EventEmitterPubSub();
    const durable = createDurableAgent({
      agent: makeAgent(),
      pubsub: inner,
      cache,
      shouldCache: topic => !topic.startsWith('agent.stream.'),
    });

    const received: string[] = [];
    await inner.subscribe('agent.stream.run-1', e => {
      received.push(e.type);
    });

    await durable.pubsub.publish('agent.stream.run-1', { type: 'chunk', data: {} });
    await durable.pubsub.publish('agent.control.run-1', { type: 'cancel', data: {} });
    await new Promise(r => setTimeout(r, 0));

    expect(received).toEqual(['chunk']);
    expect(await cache.listLength(cacheKeyFor('agent.stream.run-1'))).toBe(0);
    expect(await cache.listLength(cacheKeyFor('agent.control.run-1'))).toBe(1);
  });

  it('cannot re-enable caching for run-local topics', async () => {
    const cache = new InMemoryServerCache();
    const durable = createDurableAgent({
      agent: makeAgent(),
      pubsub: new EventEmitterPubSub(),
      cache,
      shouldCache: () => true,
    });

    await durable.pubsub.publish('workflow.events.v2.run-1', { type: 'watch', data: {} });

    expect(await cache.listLength(cacheKeyFor('workflow.events.v2.run-1'))).toBe(0);
  });

  it('warns and is ignored when the inner pubsub is already a CachingPubSub', async () => {
    const cache = new InMemoryServerCache();
    const existing = new CachingPubSub(new EventEmitterPubSub(), cache);
    const durable = createDurableAgent({
      agent: makeAgent(),
      pubsub: existing,
      cache,
      shouldCache: () => false,
    });
    const warn = vi.fn();
    durable.__setLogger({ debug: vi.fn(), info: vi.fn(), warn, error: vi.fn(), trace: vi.fn() } as any);

    // No double-wrapping: the existing instance is reused and its policy wins.
    expect(durable.pubsub).toBe(existing);
    await durable.pubsub.publish('agent.stream.run-1', { type: 'chunk', data: {} });

    expect(await cache.listLength(cacheKeyFor('agent.stream.run-1'))).toBe(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain("'shouldCache' is ignored");
  });

  it('is forwarded by createEventedAgent', async () => {
    const cache = new InMemoryServerCache();
    const evented = createEventedAgent({
      agent: makeAgent(),
      pubsub: new EventEmitterPubSub(),
      cache,
      shouldCache: () => false,
    });

    await evented.pubsub.publish('agent.stream.run-1', { type: 'chunk', data: {} });

    expect(await cache.listLength(cacheKeyFor('agent.stream.run-1'))).toBe(0);
  });
});
