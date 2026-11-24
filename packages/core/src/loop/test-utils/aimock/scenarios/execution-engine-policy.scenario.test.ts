import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { UnixSocketPubSub } from '../../../../events/unix-socket-pubsub';
import { InMemoryStore } from '../../../../storage/mock';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createDurableAgent, createEventedAgent } from '../../../../agent/durable';
import { AGENT_CONTROL_TOPIC, AgentControlEventTypes } from '../../../../agent/streams/constants';
import { EventEmitterPubSub } from '../../../../events/event-emitter';
import { hasDurableExecution } from '../../../../agent/streams/execution-capability';
import { AGENT_STREAM_TOPIC } from '../../../../agent/streams/constants';
import { InMemoryServerCache } from '../../../../cache/inmemory';
import { createTool } from '../../../../tools';
import { Agent } from '../../../../agent/agent';
import { isDurableAgentLike } from '../../../../agent/types';
import { Knowledge } from '../../../../knowledge';
import { ConsoleLogger } from '../../../../logger';
import { MockMemory } from '../../../../memory/mock';
import { Mastra } from '../../../../mastra';
import { MastraModelOutput } from '../../../../stream/base/output';
import { createSharedAgent, describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';

// COR-1579: native engine selection must preserve the Agent output contract.
describe('Configured native engines preserve Agent outputs', () => {
  const getMock = useLoopScenarioAimock();

  it.each([false, true])(
    'executes a native evented run on a cold worker (late registration: %s)',
    async lateRegistration => {
      const directory = await mkdtemp(join(tmpdir(), 'native-worker-'));
      const socket = join(directory, 'pubsub.sock');
      const apiPubsub = new UnixSocketPubSub(socket);
      const workerPubsub = new UnixSocketPubSub(socket);
      const storage = new InMemoryStore();
      const llm = getMock();
      llm.on({ endpoint: 'chat' }, { content: 'Your order has shipped.' });
      const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url}/v1` });
      const build = () =>
        new Agent({
          id: 'cold-worker',
          name: 'Cold worker',
          instructions: 'Help with orders.',
          model: openai('gpt-4o'),
        });
      const apiAgent = build();
      const api = new Mastra({
        agents: { support: apiAgent },
        storage,
        pubsub: apiPubsub,
        workers: false,
        durable: { executionEngine: 'evented' },
        logger: false,
      });
      const worker = new Mastra({
        agents: lateRegistration ? {} : { support: build() },
        storage,
        pubsub: workerPubsub,
        durable: { executionEngine: 'evented' },
        logger: false,
      });
      try {
        await worker.startWorkers();
        if (lateRegistration) worker.addAgent(build(), 'support');
        const output = await apiAgent.stream('Where is my order?');
        expect(output).toBeInstanceOf(MastraModelOutput);
        expect(await output.text).toBe('Your order has shipped.');
        expect(JSON.stringify(llm.getRequests()[0]?.body)).toContain('Where is my order?');
      } finally {
        await api.shutdown();
        await worker.shutdown();
        await apiPubsub.close();
        await workerPubsub.close();
        await rm(directory, { recursive: true, force: true });
      }
    },
    15000,
  );

  it.each(['abortRunStream', 'abortThreadStream', '__abortThreadStreamAcrossProcesses'] as const)(
    'sends %s from a cold native Agent to the shared worker transport',
    async method => {
      const directory = await mkdtemp(join(tmpdir(), 'native-abort-'));
      const socket = join(directory, 'pubsub.sock');
      const apiPubsub = new UnixSocketPubSub(socket);
      const workerPubsub = new UnixSocketPubSub(socket);
      const agent = new Agent({
        id: 'cold-abort',
        name: 'Cold abort',
        instructions: 'Help.',
        model: 'openai/gpt-4o',
        durable: { pubsub: new EventEmitterPubSub() },
      });
      const mastra = new Mastra({
        agents: { agent },
        storage: new InMemoryStore(),
        pubsub: apiPubsub,
        workers: false,
        durable: { executionEngine: 'evented' },
        logger: false,
      });
      const requests: string[] = [];
      try {
        await workerPubsub.subscribe(AGENT_CONTROL_TOPIC('remote-run'), async event => {
          if (event.type === AgentControlEventTypes.ABORT_REQUEST) requests.push(event.runId);
        });
        if (method === 'abortRunStream') {
          expect(agent.abortRunStream('remote-run')).toBe(false);
        } else {
          await workerPubsub.acquireLease('resource\u0000thread', 'remote-run', 30_000);
          expect(await agent[method]({ resourceId: 'resource', threadId: 'thread' })).toBe(
            method === '__abortThreadStreamAcrossProcesses',
          );
        }
        await expect.poll(() => requests).toEqual(['remote-run']);
      } finally {
        await mastra.shutdown();
        await apiPubsub.close();
        await workerPubsub.close();
        await rm(directory, { recursive: true, force: true });
      }
    },
  );

  for (const executionEngine of ['default', 'evented'] as const) {
    for (const method of ['resumeStream', 'resumeStreamUntilIdle'] as const) {
      it(`${executionEngine}/${method}: keeps lifecycle controls when resuming a suspended tool`, async () => {
        const llm = getMock();
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [{ id: 'call-confirm', name: 'confirm', arguments: {} }],
          },
        );
        llm.on({ endpoint: 'chat', toolCallId: 'call-confirm', hasToolResult: true }, { content: 'Order confirmed.' });
        const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url}/v1` });
        const confirm = createTool({
          id: 'confirm',
          description: 'Confirm the order',
          inputSchema: z.object({}),
          suspendSchema: z.object({ message: z.string() }),
          resumeSchema: z.object({ confirmed: z.boolean() }),
          execute: async (_input, context) =>
            context?.agent?.resumeData
              ? { confirmed: context.agent.resumeData.confirmed }
              : context?.agent?.suspend({ message: 'Confirm this order' }),
        });
        const agent = new Agent({
          id: 'resume-order',
          name: 'Order support',
          instructions: 'Confirm orders.',
          model: openai('gpt-4o'),
          tools: { confirm },
          memory: new MockMemory(),
          durable: { executionEngine },
        });
        const mastra = new Mastra({ agents: { agent }, logger: false });
        try {
          const first = await agent.generate('Confirm my order', { memory: { thread: 'order', resource: 'customer' } });
          expect(first.finishReason).toBe('suspended');
          const resumed = await agent[method]({ confirmed: true }, { runId: first.runId, toolCallId: 'call-confirm' });
          expect(resumed).toBeInstanceOf(MastraModelOutput);
          expect(resumed.abort).toBeTypeOf('function');
          expect(resumed.cleanup).toBeTypeOf('function');
          expect(resumed.threadId).toBe('order');
          expect(resumed.resourceId).toBe('customer');
          expect(await resumed.text).toBe('Order confirmed.');
          expect(JSON.stringify(llm.getRequests().at(-1)?.body)).toContain('confirmed');
          resumed.cleanup?.();
        } finally {
          await mastra.shutdown();
        }
      });
    }
    for (const method of ['stream', 'generate'] as const) {
      it(`${executionEngine}/${method}: executes inherited policy without replacing the registered Agent`, async () => {
        const llm = getMock();
        llm.on({ endpoint: 'chat' }, { content: 'Your order has shipped.' });
        const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url}/v1` });
        const agent = new Agent({
          id: 'order-support',
          name: 'Order support',
          instructions: 'Help with orders.',
          model: openai('gpt-4o'),
        });
        const mastra = new Mastra({ agents: { support: agent }, durable: { executionEngine } });
        try {
          const output = await agent[method]('Where is my order?', {});
          expect(await output.text).toBe('Your order has shipped.');
          if (method === 'stream') expect(output).toBeInstanceOf(MastraModelOutput);
          else expect(output).not.toBeInstanceOf(MastraModelOutput);
          expect(agent.__getExecutionEnginePolicy()).toBe(executionEngine);
          expect(mastra.getAgent('support')).toBe(agent);
          expect(isDurableAgentLike(agent)).toBe(false);
          expect(hasDurableExecution(agent)).toBe(true);
          await expect(agent.recover('unavailable')).rejects.not.toMatchObject({
            id: 'AGENT_DURABLE_METHOD_NOT_AVAILABLE',
          });
          expect(JSON.stringify(llm.getRequests()[0]?.body)).toContain('Where is my order?');
        } finally {
          await mastra.shutdown();
        }
      });
    }
  }

  // COR-1563: observe() can initialize streams before stored registration supplies host defaults.
  // Wrappers do not inherit these selectors.
  for (const executionEngine of [false, 'default', 'evented'] as const) {
    for (const registration of ['constructor', 'addAgent'] as const) {
      const replayPolicyCase = async (explicit: boolean) => {
        const llm = getMock();
        llm.on({ endpoint: 'chat' }, { content: 'Your order has shipped.' });
        const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url}/v1` });
        const agent = new Agent({
          id: 'observed-replay-policy',
          name: 'Order support',
          instructions: 'Help with orders.',
          model: openai('gpt-4o'),
          durable: explicit ? { shouldCache: () => true } : true,
        });
        const earlyObserver = await agent.observe('before-registration');
        earlyObserver.detach();
        const mastra = new Mastra({
          logger: false,
          serverCache: new InMemoryServerCache(),
          durable: { executionEngine, shouldCache: () => false, cleanupTimeoutMs: 0 },
          ...(registration === 'constructor' ? { agents: { agent } } : {}),
        });
        if (registration === 'addAgent') mastra.addAgent(agent);
        const runId = crypto.randomUUID();
        try {
          const output = await agent.stream('Where is my order?', { runId });
          await output.consumeStream();
          expect(await output.text).toBe('Your order has shipped.');
          const history = await agent.__getStreamBus()!.pubsub.getHistory(AGENT_STREAM_TOPIC(runId));
          if (explicit) expect(history.length).toBeGreaterThan(0);
          else expect(history).toEqual([]);
          // Re-registering the same instance must not discard its retained log.
          const bus = agent.__getStreamBus();
          mastra.addAgent(agent);
          expect(agent.__getStreamBus()).toBe(bus);
          expect(await agent.__getStreamBus()!.pubsub.getHistory(AGENT_STREAM_TOPIC(runId))).toEqual(history);
        } finally {
          await mastra.shutdown();
        }
      };
      const name = `${String(executionEngine)}/${registration}: applies inherited replay policy after observation (explicit=%s)`;
      if (executionEngine === 'evented') {
        it.each([true])(name, replayPolicyCase);
        // Evented workers publish through Mastra's shared pubsub and server cache, so the agent's
        // shouldCache never filters the run log. Legacy EventedAgent behaves the same on main (COR-1631).
        it.fails.each([false])(name, replayPolicyCase);
      } else {
        it.each([false, true])(name, replayPolicyCase);
      }

      it.each([false, true])(
        `${String(executionEngine)}/${registration}: applies inherited replay cleanup after observation (explicit=%s)`,
        async explicit => {
          const llm = getMock();
          llm.on({ endpoint: 'chat' }, { content: 'Your order has shipped.' });
          const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url}/v1` });
          const agent = new Agent({
            id: 'observed-cleanup-policy',
            name: 'Order support',
            instructions: 'Help with orders.',
            model: openai('gpt-4o'),
            durable: explicit ? { cleanupTimeoutMs: 0 } : true,
          });
          const earlyObserver = await agent.observe('before-registration');
          earlyObserver.detach();
          const mastra = new Mastra({
            logger: false,
            serverCache: new InMemoryServerCache(),
            durable: { executionEngine, cleanupTimeoutMs: 100 },
            ...(registration === 'constructor' ? { agents: { agent } } : {}),
          });
          if (registration === 'addAgent') mastra.addAgent(agent);
          const runId = crypto.randomUUID();
          try {
            const output = await agent.stream('Where is my order?', { runId });
            await output.consumeStream();
            expect(await output.text).toBe('Your order has shipped.');
            const pubsub = agent.__getStreamBus()!.pubsub;
            if (explicit) {
              await new Promise(resolve => setTimeout(resolve, 200));
              const observer = await agent.observe(runId);
              try {
                expect(await observer.output.text).toBe('Your order has shipped.');
              } finally {
                observer.detach();
              }
            } else {
              await vi.waitFor(async () => {
                expect(await pubsub.getHistory(AGENT_STREAM_TOPIC(runId))).toEqual([]);
              });
            }
          } finally {
            await mastra.shutdown();
          }
        },
      );
    }
  }

  for (const strategy of ['default', 'evented'] as const) {
    for (const method of ['stream', 'generate'] as const) {
      it.each([
        undefined,
        false,
        { executionEngine: false },
        { executionEngine: 'default' },
        { executionEngine: 'evented' },
      ] as const)(`${strategy}/${method}: wrapping leaves direct runs unchanged with durable=%j`, async durable => {
        const llm = getMock();
        llm.on({ endpoint: 'chat' }, { content: 'Your order has shipped.' });
        const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url}/v1` });
        const agent = new Agent({
          id: 'wrapped-order',
          name: 'Wrapped order',
          instructions: 'Help with orders.',
          model: openai('gpt-4o'),
          durable,
        });
        const wrap = strategy === 'evented' ? createEventedAgent : createDurableAgent;
        const wrapped = wrap({ agent });
        const mastra = new Mastra({ agents: { wrapped }, durable: { executionEngine: 'evented' } });
        try {
          const output = await agent[method]('Where is my order?', {});
          expect(await output.text).toBe('Your order has shipped.');
          expect(agent.durable).toEqual(durable);
          expect(agent.__getExecutionEnginePolicy()).toBe(
            typeof durable === 'object' ? durable.executionEngine : false,
          );
          expect(wrapped.__getExecutionEnginePolicy()).toBe(strategy);
          expect(hasDurableExecution(agent)).toBe(typeof durable === 'object' && durable.executionEngine !== false);
          if (method === 'stream') expect(output).toBeInstanceOf(MastraModelOutput);
          else expect(output).not.toBeInstanceOf(MastraModelOutput);
          expect(JSON.stringify(llm.getRequests()[0]?.body)).toContain('Where is my order?');
        } finally {
          await mastra.shutdown();
        }
      });
    }
  }

  it.each(['default', 'evented'] as const)(
    '%s wrapping preserves an already-running native tool loop',
    async executionEngine => {
      const llm = getMock();
      llm.on(
        { endpoint: 'chat', hasToolResult: false },
        { toolCalls: [{ id: 'lookup-order', name: 'lookupOrder', arguments: {} }] },
      );
      llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Your order has shipped.' });
      const started = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const tool = createTool({
        id: 'lookupOrder',
        description: 'Look up the order status.',
        inputSchema: z.object({}),
        outputSchema: z.object({ status: z.string() }),
        execute: async () => {
          started.resolve();
          await release.promise;
          return { status: 'shipped' };
        },
      });
      const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url}/v1` });
      const agent = new Agent({
        id: 'live-order',
        name: 'Live order',
        instructions: 'Check order status.',
        model: openai('gpt-4o'),
        tools: { lookupOrder: tool },
      });
      const mastra = new Mastra({ agents: { agent }, durable: { executionEngine, cleanupTimeoutMs: 0 } });
      let output: Awaited<ReturnType<typeof agent.stream>> | undefined;
      try {
        output = await agent.stream('Where is my order?', { maxSteps: 3 });
        const text = output.text;
        await started.promise;
        const bus = agent.__getStreamBus();
        const wrap = executionEngine === 'evented' ? createEventedAgent : createDurableAgent;
        const before = agent.durable;
        const wrapped = wrap({ agent });
        expect(agent.durable).toEqual(before);
        expect(agent.__getStreamBus()).toBe(bus);
        expect(hasDurableExecution(agent)).toBe(true);
        expect(hasDurableExecution(wrapped)).toBe(true);
        expect(mastra.getAgent('agent')).toBe(agent);
        release.resolve();
        expect(await text).toBe('Your order has shipped.');
        expect(await output.finishReason).toBe('stop');
        expect(llm.getRequests()).toHaveLength(2);
        expect(JSON.stringify(llm.getRequests()[1]?.body)).toContain('shipped');
      } finally {
        release.resolve();
        await output?.consumeStream();
        await mastra.shutdown();
      }
    },
  );

  it.each(['stream', 'generate'] as const)(
    '%s inspects already-evaluated dynamic defaults on later calls',
    async method => {
      const llm = getMock();
      llm.on({ endpoint: 'chat' }, { content: 'Ready.' });
      const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url}/v1` });
      let calls = 0;
      const agent = new Agent({
        id: 'dynamic',
        name: 'Dynamic',
        instructions: 'Reply briefly.',
        model: openai('gpt-4o'),
        defaultOptions: () => ({ eagerToolExecution: ++calls > 1 }),
      });
      const mastra = new Mastra({ agents: { dynamic: agent }, durable: { executionEngine: 'default' } });
      const warn = vi.spyOn(ConsoleLogger.prototype, 'warn');
      try {
        for (let turn = 0; turn < 3; turn++) {
          if (turn === 0) {
            const output = await agent[method]('Ready?', {});
            expect(await output.text).toBe('Ready.');
          } else {
            await expect(agent[method]('Ready?', {})).rejects.toThrow(
              'eagerToolExecution is not supported by durable agents',
            );
          }
          expect(
            warn.mock.calls.filter(([message]) => String(message).includes('does not support eagerToolExecution')),
          ).toHaveLength(turn === 0 ? 0 : 1);
        }
        expect(calls).toBe(3);
      } finally {
        warn.mockRestore();
        await mastra.shutdown();
      }
    },
  );

  it.each(['default', 'evented'] as const)(
    'recoverResume() reports the %s engine as unsupported instead of a missing suspension',
    async executionEngine => {
      const agent = new Agent({
        id: 'recover-native',
        name: 'Recover native',
        instructions: 'Help.',
        model: 'openai/gpt-4o',
        durable: { executionEngine },
      });
      const mastra = new Mastra({ agents: { agent }, storage: new InMemoryStore(), logger: false });
      try {
        await expect(agent.recoverResume({ runId: 'claimed-run' })).rejects.toMatchObject({
          id: 'AGENT_RECOVER_RESUME_UNSUPPORTED',
        });
      } finally {
        await mastra.shutdown();
      }
    },
  );
});

describe('Wrappers preserve live agent configuration', () => {
  const getMock = useLoopScenarioAimock();

  for (const wrap of [createDurableAgent, createEventedAgent]) {
    it.each([false, true])(
      `${wrap.name}: exposes and updates the configured knowledge (registered key: %s)`,
      async byKey => {
        const llm = getMock();
        const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url}/v1` });
        const knowledge = new Knowledge({ id: 'order-knowledge', scopes: {} });
        const replacement = new Knowledge({ id: 'replacement-knowledge', scopes: {} });
        const inner = new Agent({
          id: 'order-agent',
          name: 'Order agent',
          instructions: 'Help with orders.',
          model: openai('gpt-4o'),
          knowledge: byKey ? 'orders' : knowledge,
        });
        const wrapper = wrap({ agent: inner });
        const mastra = new Mastra({
          agents: { support: wrapper },
          knowledge: { orders: knowledge },
          storage: new InMemoryStore(),
          logger: false,
        });
        try {
          expect(wrapper.getKnowledge()).toBe(knowledge);
          inner.__setKnowledge(replacement);
          expect(wrapper.getKnowledge()).toBe(replacement);
          wrapper.__setKnowledge(knowledge);
          expect(inner.getKnowledge()).toBe(knowledge);
          expect(wrapper.getKnowledge()).toBe(knowledge);
          expect(inner.__getExecutionEnginePolicy()).toBe(false);
        } finally {
          await mastra.shutdown();
        }
      },
    );

    it(`${wrap.name}: executes model-list edits on a fork without changing the original agent`, async () => {
      const llm = getMock();
      llm.on({ endpoint: 'chat' }, { content: 'Order checked.' });
      const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url}/v1` });
      const inner = new Agent({
        id: 'model-list-orders',
        name: 'Model list orders',
        instructions: 'Help with orders.',
        maxRetries: 0,
        model: [
          { id: 'primary', model: openai('gpt-4o') },
          { id: 'fallback', model: openai('gpt-4o-mini') },
        ],
      });
      const wrapper = wrap({ agent: inner });
      const mastra = new Mastra({ agents: { support: wrapper }, storage: new InMemoryStore(), logger: false });
      try {
        const fork = wrapper.__fork();
        expect(fork.reorderModels(['fallback', 'primary'])).toBe(true);
        expect(fork.updateModelInModelList({ id: 'primary', enabled: false })).toBe(true);
        const selection = await fork.__getModelAndModelList();
        expect(selection.modelList?.map(model => model.id)).toEqual(['fallback', 'primary']);
        const result = await fork.stream('Check my order.', { closeOnSuspend: true });
        expect(await result.output.text).toBe('Order checked.');
        expect(llm.getRequests().map(request => request.body?.model)).toEqual(['gpt-4o-mini']);
        expect((await wrapper.getModelList())?.map(model => model.id)).toEqual(['primary', 'fallback']);
        expect(inner.__getExecutionEnginePolicy()).toBe(false);
      } finally {
        await mastra.shutdown();
      }
    });

    it(`${wrap.name}: runs with post-wrap configuration without changing the inner engine or fork identity`, async () => {
      const llm = getMock();
      llm.on({ endpoint: 'chat' }, { content: 'Your order has shipped.' });
      const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url}/v1` });
      const inner = new Agent({
        id: 'live-order-agent',
        name: 'Order agent',
        instructions: 'Old order instructions.',
        model: openai('gpt-4o'),
        memory: new MockMemory(),
        maxRetries: 2,
        maxProcessorRetries: 4,
      });
      const wrapper = wrap({ agent: inner });
      inner.__updateInstructions('Use the updated order policy.');
      const tools = {
        lookupOrder: createTool({
          id: 'lookup-order',
          description: 'Look up the current order status.',
          inputSchema: z.object({ orderId: z.string() }),
          execute: async ({ orderId }) => ({ orderId, status: 'shipped' }),
        }),
      };
      inner.__setTools(tools);
      const mastra = new Mastra({
        agents: { support: wrapper },
        storage: new InMemoryStore(),
        pubsub: new EventEmitterPubSub(),
        logger: false,
      });
      try {
        expect(wrapper.maxRetries).toBe(2);
        expect(wrapper.__getMaxRetriesConfigured()).toBe(true);
        expect(wrapper.__getMaxProcessorRetries()).toBe(4);
        expect(wrapper.__hasFixedMemory()).toBe(true);
        expect(await wrapper.listTools()).toHaveProperty('lookupOrder');
        const fork = wrapper.__fork();
        fork.__updateInstructions('Use the fork-specific order policy.');
        fork.__setTools(tools);
        const result = await fork.stream('Where is my order?', { closeOnSuspend: true });
        const output = 'output' in result ? result.output : result;
        expect(await output.text).toBe('Your order has shipped.');
        const request = JSON.stringify(llm.getRequests()[0]?.body);
        expect(request).toContain('Use the fork-specific order policy.');
        expect(request).toContain('lookupOrder');
        expect(fork.id).toBe(wrapper.id);
        expect(fork.name).toBe(wrapper.name);
        expect(await inner.getInstructions()).toBe('Use the updated order policy.');
        expect(inner.__getExecutionEnginePolicy()).toBe(false);
      } finally {
        await mastra.shutdown();
      }
    });
  }
});

// The same registration must not disturb any existing engine's model request/output.
describeForAllEngines('Existing execution survives conflicting host policy registration', engine => {
  const getMock = useLoopScenarioAimock();
  it.each(['stream', 'generate'] as const)('%s retains the existing execution contract', async method => {
    const llm = getMock();
    llm.on({}, { content: 'Your order has shipped.' });
    const { agent } = await createSharedAgent(llm, { engine });
    const mastra = new Mastra({ durable: { executionEngine: 'evented' } });
    try {
      mastra.addAgent(agent);
      const result = await agent[method]('Where is my order?', {});
      const output = 'output' in result && result.output instanceof MastraModelOutput ? result.output : result;
      expect(await output.text).toBe('Your order has shipped.');
      expect(mastra.getAgentById(agent.id)).toBe(agent);
      expect(JSON.stringify(llm.getRequests()[0]?.body)).toContain('Where is my order?');
    } finally {
      await mastra.shutdown();
    }
  });
});
