import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InMemoryServerCache } from '../../../cache/inmemory';
import { CachingPubSub } from '../../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { PubSub } from '../../../events/pubsub';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage/mock';
import { Agent } from '../../agent';
import { AGENT_CONTROL_TOPIC } from '../../streams/constants';
import { writeAgentRunRecord } from '../../streams/run-records';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import { durableReplayOwnerKey } from '../replay-owners';

/** Count requests on the shared control topic so aborts are not delivered twice. */
function countControlPublishes(pubsub: PubSub, runId: string): () => number {
  let count = 0;
  const publish = pubsub.publish.bind(pubsub);
  pubsub.publish = async (topic, event) => {
    if (topic === AGENT_CONTROL_TOPIC(runId)) count++;
    return publish(topic, event);
  };
  return () => count;
}

function setup(create = createDurableAgent) {
  const pubsub = new EventEmitterPubSub();
  const serverCache = new InMemoryServerCache();
  const agent = new Agent({
    id: 'plain-publisher-agent',
    name: 'a',
    instructions: 'x',
    model: new MockLanguageModelV2(),
  });
  const durableAgent = create({ agent });
  const mastra = new Mastra({
    logger: false,
    storage: new InMemoryStore(),
    pubsub,
    cache: serverCache,
    agents: { durableAgent },
  });
  return { pubsub, serverCache, durableAgent: mastra.getAgent('durableAgent'), mastra };
}

describe('DurableAgent shares the run publisher transport and records', () => {
  const mastras: Mastra[] = [];
  afterEach(async () => {
    await Promise.all(mastras.splice(0).map(m => m.shutdown?.()));
  });

  it('publishes a single abort request for a run executing elsewhere', async () => {
    const { pubsub, durableAgent, mastra } = setup();
    mastras.push(mastra);
    const runId = 'remote-run';
    const published = countControlPublishes(pubsub, runId);

    expect(durableAgent.abortRunStream(runId)).toBe(false);
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(published()).toBe(1);
  });

  it('reads shared run ownership records at the existing durable key for cross-server authorization', async () => {
    const { durableAgent, serverCache, mastra } = setup();
    mastras.push(mastra);
    const runId = 'recorded-run';
    await writeAgentRunRecord(
      serverCache,
      {
        agentId: durableAgent.id,
        runId,
        resourceId: 'someone',
        status: 'running',
        updatedAt: Date.now(),
      },
      durableReplayOwnerKey(durableAgent.id, runId),
    );

    await expect(durableAgent.__getRunRecord(runId)).resolves.toMatchObject({
      agentId: durableAgent.id,
      runId,
      resourceId: 'someone',
      status: 'running',
    });
    await expect(durableAgent.__getReplayOwner(runId)).resolves.toEqual({ resourceId: 'someone' });
  });

  it.each([
    ['durable', createDurableAgent],
    ['evented', createEventedAgent],
  ] as const)('%s accepts legacy records only as replay ownership, not stream status', async (_engine, create) => {
    const { durableAgent, serverCache, mastra } = setup(create);
    mastras.push(mastra);
    const runId = 'legacy-recorded-run';
    const key = durableReplayOwnerKey(durableAgent.id, runId);
    const legacy = { agentId: durableAgent.id, runId, resourceId: 'someone', threadId: 'legacy-thread' };
    await serverCache.set(key, legacy);

    await expect(durableAgent.__getReplayOwner(runId)).resolves.toEqual({
      resourceId: 'someone',
      threadId: 'legacy-thread',
    });
    await expect(durableAgent.__getRunRecord(runId)).resolves.toBeUndefined();
    expect(durableAgent.__getRunOwner(runId)).toBeUndefined();
    expect(durableAgent.abortRunStream(runId)).toBe(false);
    expect(await serverCache.get(key)).toEqual(legacy);

    await serverCache.set(key, { ...legacy, runId: 'different-run' });
    await expect(durableAgent.__getReplayOwner(runId)).resolves.toBeUndefined();
    await serverCache.set(key, { ...legacy, agentId: 'different-agent' });
    await expect(durableAgent.__getReplayOwner(runId)).resolves.toBeUndefined();

    vi.spyOn(serverCache, 'get').mockRejectedValueOnce(new Error('Cache unavailable'));
    await expect(durableAgent.__getReplayOwner(runId)).rejects.toThrow('Cache unavailable');
  });

  it('exposes only its own singly wrapped bus', () => {
    const { durableAgent, mastra } = setup();
    mastras.push(mastra);
    const bus = durableAgent.__getStreamBus()!;

    expect(bus.pubsub).toBe(durableAgent.pubsub);
    expect(bus.pubsub).toBeInstanceOf(CachingPubSub);
    expect((bus.pubsub as CachingPubSub).getInner()).toBe(mastra.pubsub);
    expect(durableAgent.hasResumableStreams()).toBe(true);
  });

  it('keeps reporting durable as false', () => {
    const { durableAgent, mastra } = setup();
    mastras.push(mastra);

    expect(durableAgent.durable).toBe(false);
  });
});
