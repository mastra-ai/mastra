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

  const setup = ({
    resolveBeforeRegistering = false,
    agentPubsub,
    streamPubsub,
  }: {
    resolveBeforeRegistering?: boolean;
    agentPubsub?: PubSub;
    streamPubsub?: PubSub;
  } = {}) => {
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
        pubsub: agentPubsub,
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
    const agentA = createDurableAgent({ agent: makeAgent(), pubsub: streamPubsub });
    if (resolveBeforeRegistering) void (agentA as DurableAgent).pubsub;
    const mastraA = new Mastra({ agents: { agent: agentA }, pubsub, cache: serverCache, logger: false });
    const mastraB = new Mastra({
      agents: { agent: createDurableAgent({ agent: makeAgent(), pubsub: streamPubsub }) },
      pubsub: agentPubsub ? new EventEmitterPubSub() : pubsub,
      cache: serverCache,
      logger: false,
    });
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

  // Agent-level pubsub must also carry thread coordination, not just run frames (#29882).
  it.each([
    { fork: false, sharedFrames: false },
    { fork: true, sharedFrames: false },
    { fork: false, sharedFrames: true },
    { fork: true, sharedFrames: true },
  ])(
    'shares thread runs, leases, subscriptions and Stop through the agent bus ($fork, sharedFrames=$sharedFrames)',
    { timeout: 15_000 },
    async ({ fork, sharedFrames }) => {
      const custom = new EventEmitterPubSub();
      const { a, b, started, release } = setup({
        agentPubsub: custom,
        streamPubsub: sharedFrames ? custom : undefined,
      });
      const runner = fork ? a.__fork() : a;
      const threadId = `custom-thread-${fork}`;
      const resourceId = 'custom-resource';
      const subscription = await b.subscribeToThread({ threadId, resourceId });
      const events: string[] = [];
      const reading = (async () => {
        for await (const chunk of subscription.stream) events.push(chunk.type);
      })();
      const run = await runner.stream('Look it up then answer.', {
        maxSteps: 3,
        memory: { thread: threadId, resource: resourceId },
      });
      const consumed = run.output.consumeStream();
      try {
        await started;
        await custom.flush();
        expect(await custom.getLeaseOwner(`${resourceId}\u0000${threadId}`)).toContain(run.runId);
        expect(b.listActiveThreadRuns().map(run => run.runId)).toContain(run.runId);
        await vi.waitFor(() => expect(events).toContain('tool-call'));
        if (sharedFrames) expect(await b.__abortThreadStreamAcrossProcesses({ threadId, resourceId })).toBe(true);
      } finally {
        release();
        await consumed;
        subscription.unsubscribe();
        await reading;
      }
      expect(await run.output.finishReason).toBe(sharedFrames ? 'aborted' : 'stop');
      await vi.waitFor(async () =>
        expect(await custom.getLeaseOwner(`${resourceId}\u0000${threadId}`)).toBeUndefined(),
      );
      expect(getMock().getRequests()).toHaveLength(sharedFrames ? 1 : 2);
    },
  );

  it.each(['plain', 'durable'] as const)(
    'preserves owned and injected coordination buses on %s forks without owning inherited buses',
    kind => {
      const makeAgent = (pubsub?: PubSub) =>
        new Agent({
          id: 'coordination-bus',
          name: 'coordination-bus',
          instructions: 'x',
          model: 'openai/gpt-4.1-mini',
          pubsub,
        });
      const owned = new EventEmitterPubSub();
      const injected = new EventEmitterPubSub();
      const transport = new EventEmitterPubSub();
      for (const source of ['owned', 'injected', 'mastra'] as const) {
        const inner = makeAgent(source === 'owned' ? owned : undefined);
        const agent = kind === 'durable' ? createDurableAgent({ agent: inner, pubsub: transport }) : inner;
        expect(agent.getPubSub()).toBe(source === 'owned' ? owned : undefined);
        expect(agent.__fork().getPubSub()).toBe(source === 'owned' ? owned : undefined);
        const mastra = new Mastra({ agents: { agent }, logger: false });
        if (source !== 'mastra') agent.__setPubSub(injected);
        const expected = source === 'owned' ? owned : source === 'injected' ? injected : mastra.pubsub;
        for (const candidate of [inner, agent, agent.__fork()]) {
          expect(candidate.getPubSub()?.__rawBus()).toBe(expected.__rawBus());
          expect(candidate.hasOwnPubSub()).toBe(source === 'owned');
        }
      }
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
