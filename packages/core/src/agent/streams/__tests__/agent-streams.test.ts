/**
 * The `streams` option on a plain Agent: when its runs are published on
 * `agent.stream.<runId>`, and on which bus. Model traffic goes through AIMock.
 */
import { createOpenAI } from '@ai-sdk/openai-v5';
import { describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Event } from '../../../events/types';
import { useLoopScenarioAimock } from '../../../loop/test-utils/aimock/aimock-scenario';
import { SCENARIO_MODEL_ID } from '../../../loop/test-utils/aimock/types';
import { Mastra } from '../../../mastra';
import { Agent } from '../../agent';
import type { AgentConfig } from '../../types';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes } from '../constants';

type Published = Omit<Event, 'id' | 'createdAt'>;

class RecordingPubSub extends EventEmitterPubSub {
  readonly published: Array<{ topic: string; event: Published }> = [];

  override async publish(topic: string, event: Published, options?: { localOnly?: boolean }): Promise<void> {
    if (topic.startsWith('agent.stream.')) this.published.push({ topic, event });
    return super.publish(topic, event, options);
  }

  types(runId: string) {
    return this.published.filter(p => p.topic === AGENT_STREAM_TOPIC(runId)).map(p => p.event.type);
  }
}

describe('Agent streams option', () => {
  const getMock = useLoopScenarioAimock();

  const makeAgent = (config: Partial<AgentConfig<any, any, any>> = {}) => {
    getMock().on({ endpoint: 'chat' }, { content: 'Hello there.' });
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${getMock().url}/v1` });
    return new Agent({
      id: 'streams-agent',
      name: 'streams-agent',
      instructions: 'Be brief.',
      model: openai(SCENARIO_MODEL_ID),
      ...config,
    } as AgentConfig<any, any, any>);
  };

  const run = async (agent: Agent<any, any, any>) => {
    const output = await agent.stream('Say hello.');
    await output.consumeStream();
    return output.runId;
  };

  const waitForFinish = (pubsub: RecordingPubSub, runId: string) =>
    vi.waitFor(() => expect(pubsub.types(runId)).toContain(AgentStreamEventTypes.FINISH));

  it('publishes runs of an agent registered on Mastra on mastra.pubsub by default', async () => {
    const pubsub = new RecordingPubSub();
    const agent = makeAgent();
    new Mastra({ agents: { agent }, pubsub, logger: false });

    const runId = await run(agent);
    await waitForFinish(pubsub, runId);
    expect(agent.__getStreamBus()?.cache).toBeDefined();
  });

  it('does not publish runs of a registered agent with `streams: false`', async () => {
    const pubsub = new RecordingPubSub();
    const agent = makeAgent({ streams: false });
    new Mastra({ agents: { agent }, pubsub, logger: false });

    await run(agent);
    await pubsub.flush();
    expect(pubsub.published).toEqual([]);
    expect(agent.__getStreamBus()).toBeUndefined();
  });

  it('does not publish runs of a standalone agent by default', async () => {
    const pubsub = new RecordingPubSub();
    const agent = makeAgent({ pubsub });

    await run(agent);
    await pubsub.flush();
    expect(pubsub.published).toEqual([]);
  });

  it('publishes runs of a standalone agent with `streams: true` on the agent pubsub', async () => {
    const pubsub = new RecordingPubSub();
    const agent = makeAgent({ pubsub, streams: true });

    const runId = await run(agent);
    await waitForFinish(pubsub, runId);
  });

  it('`streams.pubsub` wins over the agent and Mastra pubsub', async () => {
    const mastraPubsub = new RecordingPubSub();
    const streamsPubsub = new RecordingPubSub();
    const agent = makeAgent({ streams: { pubsub: streamsPubsub } });
    new Mastra({ agents: { agent }, pubsub: mastraPubsub, logger: false });

    const runId = await run(agent);
    await waitForFinish(streamsPubsub, runId);
    expect(mastraPubsub.published).toEqual([]);
  });

  it('`streams: { cache: false }` publishes without a replay cache', async () => {
    const pubsub = new RecordingPubSub();
    const agent = makeAgent({ streams: { cache: false } });
    new Mastra({ agents: { agent }, pubsub, logger: false });

    const runId = await run(agent);
    await waitForFinish(pubsub, runId);
    expect(agent.__getStreamBus()?.cache).toBeNull();
  });

  it('folds `streams` into the DurableAgent created for `durable: true`', async () => {
    const pubsub = new RecordingPubSub();
    const agent = makeAgent({ durable: true, streams: false });
    const mastra = new Mastra({ agents: { agent }, pubsub, logger: false });
    const durable = mastra.getAgent('agent') as any;

    expect(durable).not.toBe(agent);
    // A durable agent always publishes; `streams: false` only drops replay.
    expect(durable.cache).toBeNull();
    // The inner agent never publishes on its own; its wrapper does.
    expect(agent.__getStreamBus()).toBeUndefined();
  });

  describe('observe', () => {
    const collect = async (stream: ReadableStream<any>) => {
      const types: string[] = [];
      let text = '';
      for await (const chunk of stream) {
        types.push(chunk.type);
        if (chunk.type === 'text-delta') text += chunk.payload.text;
      }
      return { types, text };
    };

    it('replays a finished run of a plain agent from the cache', async () => {
      const pubsub = new RecordingPubSub();
      const agent = makeAgent();
      new Mastra({ agents: { agent }, pubsub, logger: false });
      expect(agent.hasResumableStreams()).toBe(true);

      const runId = await run(agent);
      await waitForFinish(pubsub, runId);

      const observed = await agent.observe(runId);
      const { types, text } = await collect(observed.fullStream);
      expect(text).toBe('Hello there.');
      expect(types.at(-1)).toBe('finish');
      expect(await observed.output.text).toBe('Hello there.');
    });

    it('follows a run from an offset', async () => {
      const pubsub = new RecordingPubSub();
      const agent = makeAgent();
      new Mastra({ agents: { agent }, pubsub, logger: false });

      const runId = await run(agent);
      await waitForFinish(pubsub, runId);

      const all = await collect((await agent.observe(runId)).fullStream);
      const tail = await collect((await agent.observe(runId, { offset: 3 })).fullStream);
      expect(tail.types.length).toBeLessThan(all.types.length);
      expect(tail.types.at(-1)).toBe('finish');
    });

    it('keeps throwing for a standalone agent without streams', async () => {
      const agent = makeAgent();
      expect(agent.hasResumableStreams()).toBe(false);
      await expect(agent.observe('missing-run')).rejects.toThrow();
    });
  });
});
