/**
 * The `durable` option on a plain Agent: when its runs are published on
 * `agent.stream.<runId>`, and on which bus. Model traffic goes through AIMock.
 */
import { createOpenAI } from '@ai-sdk/openai-v5';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Event } from '../../../events/types';
import { useLoopScenarioAimock } from '../../../loop/test-utils/aimock/aimock-scenario';
import { SCENARIO_MODEL_ID } from '../../../loop/test-utils/aimock/types';
import { Mastra } from '../../../mastra';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '../../../request-context';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../../durable/create-durable-agent';
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

describe('Agent durable resumable streams option', () => {
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

  it.each(['stream', 'generate'] as const)(
    'durable: true publishes %s runs without enabling checkpoint execution',
    async method => {
      const pubsub = new RecordingPubSub();
      const storage = new InMemoryStore();
      const agent = makeAgent({ durable: true });
      const mastra = new Mastra({ agents: { agent }, pubsub, storage, logger: false });

      expect(mastra.getAgent('agent')).toBe(agent);
      const output = await agent[method]('Say hello.');
      if ('consumeStream' in output) await output.consumeStream();
      expect(await output.text).toBe('Hello there.');
      await waitForFinish(pubsub, output.runId);
      const workflows = await storage.getStore('workflows');
      for (const workflowName of ['durable-agentic-loop', 'durable-agentic-execution']) {
        expect(await workflows!.loadWorkflowSnapshot({ workflowName, runId: output.runId })).toBeNull();
      }
      await expect(agent.recover(output.runId)).rejects.toThrow('createDurableAgent');
    },
  );

  it('publishes runs of an agent registered on Mastra on mastra.pubsub by default', async () => {
    const pubsub = new RecordingPubSub();
    const agent = makeAgent();
    new Mastra({ agents: { agent }, pubsub, logger: false });

    const runId = await run(agent);
    await waitForFinish(pubsub, runId);
    expect(agent.__getStreamBus()?.cache).toBeDefined();
  });

  it('does not publish runs of a registered agent with `durable: false`', async () => {
    const pubsub = new RecordingPubSub();
    const agent = makeAgent({ durable: false });
    new Mastra({ agents: { agent }, pubsub, logger: false });

    await run(agent);
    await pubsub.flush();
    expect(pubsub.published).toEqual([]);
    expect(agent.__getStreamBus()).toBeUndefined();
  });

  it.each(['stream', 'generate'] as const)(
    'keeps direct %s runs unpublished when a durable wrapper shares a disabled Agent bus',
    async method => {
      const pubsub = new RecordingPubSub();
      const agent = makeAgent({ durable: false, pubsub });
      const durable = createDurableAgent({ agent });
      new Mastra({ agents: { agent: durable }, pubsub, logger: false });

      const output = await agent[method]('Say hello.');
      if ('consumeStream' in output) await output.consumeStream();
      expect(await output.text).toBe('Hello there.');
      await pubsub.flush();
      expect(pubsub.published).toEqual([]);
      expect(await agent.__getRunRecord(output.runId)).toBeUndefined();

      const result = await durable.stream('Say hello.');
      await result.output.consumeStream();
      await waitForFinish(pubsub, result.runId);
      expect(await result.output.text).toBe('Hello there.');
    },
  );

  it('does not publish runs of a standalone agent by default', async () => {
    const pubsub = new RecordingPubSub();
    const agent = makeAgent({ pubsub });

    await run(agent);
    await pubsub.flush();
    expect(pubsub.published).toEqual([]);
  });

  it('publishes runs of a standalone agent with `durable: true` on the agent pubsub', async () => {
    const pubsub = new RecordingPubSub();
    const agent = makeAgent({ pubsub, durable: true });

    const runId = await run(agent);
    await waitForFinish(pubsub, runId);
  });

  it('`durable.pubsub` wins over the agent and Mastra pubsub', async () => {
    const mastraPubsub = new RecordingPubSub();
    const streamsPubsub = new RecordingPubSub();
    const agent = makeAgent({ durable: { pubsub: streamsPubsub } });
    new Mastra({ agents: { agent }, pubsub: mastraPubsub, logger: false });

    const runId = await run(agent);
    await waitForFinish(streamsPubsub, runId);
    expect(mastraPubsub.published).toEqual([]);
  });

  it('`durable: { cache: false }` publishes without a replay cache', async () => {
    const pubsub = new RecordingPubSub();
    const agent = makeAgent({ durable: { cache: false } });
    new Mastra({ agents: { agent }, pubsub, logger: false });

    const runId = await run(agent);
    await waitForFinish(pubsub, runId);
    expect(agent.__getStreamBus()?.cache).toBeNull();
  });

  it('explicit durable execution publishes without replay when cache is false', async () => {
    const pubsub = new RecordingPubSub();
    const agent = makeAgent({ durable: false });
    const durable = createDurableAgent({ agent, cache: false });
    const mastra = new Mastra({ agents: { agent: durable }, pubsub, logger: false });
    expect(mastra.getAgent('agent')).toBe(durable);
    const result = await durable.stream('Say hello.');
    await result.output.consumeStream();
    await waitForFinish(pubsub, result.runId);
    expect(durable.cache).toBeNull();
    expect(agent.__getStreamBus()).toBe(durable.__getStreamBus());
  });

  it('keeps the run owner while the run is replayable and drops it once the topic is cleared', async () => {
    const pubsub = new RecordingPubSub();
    const agent = makeAgent({ durable: { cleanupTimeoutMs: 200 } });
    new Mastra({ agents: { agent }, pubsub, logger: false });

    const output = await agent.stream('Say hello.', {
      requestContext: new RequestContext([[MASTRA_RESOURCE_ID_KEY, 'user-1']]),
    });
    await output.consumeStream();
    await waitForFinish(pubsub, output.runId);

    // Finished but still replayable: observers must still be authorizable.
    await vi.waitFor(async () =>
      expect(await agent.__getRunRecord(output.runId)).toMatchObject({ resourceId: 'user-1', status: 'finished' }),
    );
    await vi.waitFor(async () => expect(await agent.__getRunRecord(output.runId)).toBeUndefined(), { timeout: 2000 });
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

    it.each([
      ['at the next index', (last: number) => last + 1],
      ['far past the end', () => 100],
    ])('closes a finished run resumed %s', async (_label, offsetFor) => {
      const pubsub = new RecordingPubSub();
      const agent = makeAgent();
      new Mastra({ agents: { agent }, pubsub, logger: false });

      const runId = await run(agent);
      await waitForFinish(pubsub, runId);

      const indexes: number[] = [];
      for await (const chunk of (await agent.observe(runId)).fullStream) {
        if (chunk.index !== undefined) indexes.push(chunk.index);
      }

      const observed = await agent.observe(runId, { offset: offsetFor(indexes.at(-1)!) });
      const timeout = new Promise<'hung'>(resolve => setTimeout(() => resolve('hung'), 2_000).unref());
      const result = await Promise.race([collect(observed.fullStream), timeout]);
      expect(result).toEqual({ types: [], text: '' });
    });

    it('returns a resumed observation while the past-end history read is still pending', async () => {
      const pubsub = new RecordingPubSub();
      const agent = makeAgent();
      new Mastra({ agents: { agent }, pubsub, logger: false });

      const runId = await run(agent);
      await waitForFinish(pubsub, runId);

      // A cache that lost its connection queues reads until it reconnects.
      vi.spyOn(agent.__getStreamBus()!.pubsub, 'getHistory').mockReturnValue(new Promise(() => {}));
      const timeout = new Promise<'hung'>(resolve => setTimeout(() => resolve('hung'), 2_000).unref());
      const observed = await Promise.race([agent.observe(runId, { offset: 100 }), timeout]);
      expect(observed).not.toBe('hung');
      if (observed !== 'hung') observed.detach();
    });

    it.each([
      ['at the next index', (last: number) => last + 1],
      ['far past the end', () => 100],
    ])('closes a run that ended in an error event when resumed %s', async (_label, offsetFor) => {
      const pubsub = new RecordingPubSub();
      // Throwing mid-stream ends the run without a finish, so its log ends in an error event.
      const agent = makeAgent({
        outputProcessors: [
          {
            id: 'boom',
            processOutputStream: () => {
              throw new Error('PROCESSOR_BOOM');
            },
          },
        ],
      });
      new Mastra({ agents: { agent }, pubsub, logger: false });

      const output = await agent.stream('Say hello.');
      await output.consumeStream().catch(() => {});
      await vi.waitFor(() => expect(pubsub.types(output.runId)).toContain(AgentStreamEventTypes.ERROR));
      const log = await agent.__getStreamBus()!.pubsub.getHistory(AGENT_STREAM_TOPIC(output.runId), 0);
      expect(log.at(-1)?.type).toBe(AgentStreamEventTypes.ERROR);

      const observed = await agent.observe(output.runId, { offset: offsetFor(log.at(-1)!.index!) });
      const timeout = new Promise<'hung'>(resolve => setTimeout(() => resolve('hung'), 2_000).unref());
      const result = await Promise.race([collect(observed.fullStream), timeout]);
      expect(result).toEqual({ types: [], text: '' });
    });

    it('stays open across a tool-approval suspension and follows the approved run to its finish', async () => {
      const pubsub = new RecordingPubSub();
      getMock().on(
        { endpoint: 'chat', hasToolResult: false },
        { toolCalls: [{ id: 'call-1', name: 'lookup', arguments: JSON.stringify({ q: 'x' }) }] },
      );
      getMock().on({ endpoint: 'chat', hasToolResult: true }, { content: 'Looked it up.' });
      const lookup = createTool({
        id: 'lookup',
        description: 'Look something up.',
        inputSchema: z.object({ q: z.string() }),
        requireApproval: true,
        execute: async () => ({ ok: true }),
      });
      const agent = makeAgent({ tools: { lookup } });
      new Mastra({ agents: { agent }, pubsub, storage: new InMemoryStore(), logger: false });

      const output = await agent.stream('Look up x.');
      await output.consumeStream();
      await vi.waitFor(() => expect(pubsub.types(output.runId)).toContain(AgentStreamEventTypes.SUSPENDED));

      const onSuspended = vi.fn();
      const observed = await agent.observe(output.runId, { onSuspended });
      let ended = false;
      const collecting = collect(observed.fullStream).finally(() => {
        ended = true;
      });
      // Suspension is an event, not the end of the run.
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(ended).toBe(false);
      expect(onSuspended).toHaveBeenCalledWith(expect.objectContaining({ type: 'approval', toolName: 'lookup' }));

      const resumed = await agent.approveToolCall({ runId: output.runId, toolCallId: 'call-1' });
      await resumed.consumeStream();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const { types, text } = await Promise.race([
        collecting,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('observe() did not follow the approved run to its finish')), 5_000);
        }),
      ]).finally(() => clearTimeout(timer));
      expect(types).toContain('tool-call-approval');
      expect(types.at(-1)).toBe('finish');
      expect(text).toBe('Looked it up.');
      expect(onSuspended).toHaveBeenCalledTimes(1);
    });

    it('keeps throwing for a standalone agent without streams', async () => {
      const agent = makeAgent();
      expect(agent.hasResumableStreams()).toBe(false);
      await expect(agent.observe('missing-run')).rejects.toThrow();
    });
  });
});
