/**
 * A DurableAgent on the default engine publishes its run frames on the Mastra
 * bus once registered, so a second Mastra instance sharing that bus and server
 * cache (standing in for another process) can observe the run: the replay of
 * what was already published plus the live tail through finish. Model traffic
 * goes through AIMock.
 */
import { createOpenAI } from '@ai-sdk/openai-v5';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { InMemoryServerCache } from '../../../cache/inmemory';
import { CachingPubSub } from '../../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { PubSub } from '../../../events/pubsub';
import { useLoopScenarioAimock } from '../../../loop/test-utils/aimock/aimock-scenario';
import { SCENARIO_MODEL_ID } from '../../../loop/test-utils/aimock/types';
import { Mastra } from '../../../mastra';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import type { DurableAgent } from '../../durable';
import { createDurableAgent } from '../../durable/create-durable-agent';

describe('DurableAgent default engine on the shared Mastra bus', () => {
  const getMock = useLoopScenarioAimock();

  const setup = ({ resolveBeforeRegistering = false } = {}) => {
    let toolStarted!: () => void;
    const started = new Promise<void>(resolve => (toolStarted = resolve));
    let release!: () => void;
    const released = new Promise<void>(resolve => (release = resolve));

    getMock().on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'call_1', name: 'lookup', arguments: { q: 'x' } }] },
    );
    getMock().on({ endpoint: 'chat', hasToolResult: true }, { content: 'The answer is FOUND.' });

    const makeAgent = () =>
      new Agent({
        id: 'durable-shared',
        name: 'durable-shared',
        instructions: 'Use the tool.',
        model: createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${getMock().url}/v1` })(SCENARIO_MODEL_ID),
        durable: true,
        tools: {
          lookup: createTool({
            id: 'lookup',
            description: 'Look something up',
            inputSchema: z.object({ q: z.string() }),
            outputSchema: z.object({ value: z.string() }),
            execute: async () => {
              toolStarted();
              await released;
              return { value: 'FOUND' };
            },
          }),
        },
      });

    const pubsub = new EventEmitterPubSub();
    const serverCache = new InMemoryServerCache();
    // Reading the bus before registration resolves it against the agent's own default bus.
    const agentA = resolveBeforeRegistering ? createDurableAgent({ agent: makeAgent() }) : makeAgent();
    if (resolveBeforeRegistering) void (agentA as DurableAgent).pubsub;
    const mastraA = new Mastra({ agents: { agent: agentA }, pubsub, cache: serverCache, logger: false });
    const mastraB = new Mastra({ agents: { agent: makeAgent() }, pubsub, cache: serverCache, logger: false });
    return {
      a: mastraA.getAgent('agent') as unknown as DurableAgent,
      b: mastraB.getAgent('agent') as unknown as DurableAgent,
      pubsub,
      started,
      release,
    };
  };

  it.each([
    ['registered before first use', false],
    ['bus read before registration', true],
  ])(
    'publishes on mastra.pubsub so another instance observes replay plus live tail (%s)',
    { timeout: 15_000 },
    async (_, resolveBeforeRegistering) => {
      const { a, b, pubsub, started, release } = setup({ resolveBeforeRegistering });

      const run = await a.stream('Look it up then answer.', { maxSteps: 3 });
      const consumed = run.output.consumeStream();
      await started;
      await pubsub.flush();

      const observed = await b.observe(run.runId);
      const types: string[] = [];
      const reading = (async () => {
        for await (const chunk of observed.fullStream) types.push(chunk.type);
      })();
      release();

      await consumed;
      await reading;

      // Replay: frames published before the observer subscribed.
      expect(types.slice(0, 1)).toEqual(['start']);
      expect(types).toContain('tool-call');
      // Live tail: the second turn ran after the observer subscribed.
      expect(types).toContain('tool-result');
      expect(types).toContain('text-delta');
      expect(types.at(-1)).toBe('finish');
      expect(await observed.output.text).toBe('The answer is FOUND.');
    },
  );

  it('keeps a user-provided agent pubsub on the default engine and the private bus while unregistered', () => {
    const makeAgent = () =>
      new Agent({
        id: 'durable-bus',
        name: 'durable-bus',
        instructions: 'x',
        model: createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${getMock().url}/v1` })(SCENARIO_MODEL_ID),
      });
    const shared = new EventEmitterPubSub();
    const raw = (bus: PubSub) => (bus instanceof CachingPubSub ? bus.getInner() : bus).__rawBus();

    const standalone = createDurableAgent({ agent: makeAgent() });
    expect(raw(standalone.pubsub)).not.toBe(shared.__rawBus());

    const custom = new EventEmitterPubSub();
    const withCustom = createDurableAgent({ agent: makeAgent(), pubsub: custom });
    const mastra = new Mastra({ agents: { agent: withCustom }, pubsub: shared, logger: false });
    const warn = vi.spyOn(withCustom.logger, 'warn');
    expect(raw((mastra.getAgent('agent') as unknown as DurableAgent).pubsub)).toBe(custom.__rawBus());
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('Evented run frames'));
  });
});
