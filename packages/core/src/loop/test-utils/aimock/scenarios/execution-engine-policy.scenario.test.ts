import { createOpenAI } from '@ai-sdk/openai-v5';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createDurableAgent, createEventedAgent } from '../../../../agent/durable';
import { hasDurableExecution } from '../../../../agent/streams/execution-capability';
import { createTool } from '../../../../tools';
import { Agent } from '../../../../agent/agent';
import { isDurableAgentLike } from '../../../../agent/types';
import { ConsoleLogger } from '../../../../logger';
import { Mastra } from '../../../../mastra';
import { MastraModelOutput } from '../../../../stream/base/output';
import { createSharedAgent, describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';

// COR-1563 PR 1: accepting policy must not silently change output or enable recovery.
describe('Configured native engines remain native execution', () => {
  const getMock = useLoopScenarioAimock();
  for (const executionEngine of ['durable', 'evented'] as const) {
    for (const method of ['stream', 'generate'] as const) {
      it(`${executionEngine}/${method}: inherits policy without activating wrapper execution`, async () => {
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
        const output = await agent[method]('Where is my order?', {});
        expect(await output.text).toBe('Your order has shipped.');
        if (method === 'stream') expect(output).toBeInstanceOf(MastraModelOutput);
        else expect(output).not.toBeInstanceOf(MastraModelOutput);
        expect(agent.__getExecutionEnginePolicy()).toBe(executionEngine);
        expect(mastra.getAgent('support')).toBe(agent);
        expect(isDurableAgentLike(agent)).toBe(false);
        await expect(agent.recover('unavailable')).rejects.toMatchObject({ id: 'AGENT_DURABLE_METHOD_NOT_AVAILABLE' });
        expect(JSON.stringify(llm.getRequests()[0]?.body)).toContain('Where is my order?');
      });
    }
  }

  it.each(['durable', 'evented'] as const)(
    '%s ownership preserves an already-running native tool loop',
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
      const output = await agent.stream('Where is my order?', { maxSteps: 3 });
      const text = output.text;
      try {
        await started.promise;
        const bus = agent.__getStreamBus();
        const wrap = executionEngine === 'evented' ? createEventedAgent : createDurableAgent;
        const wrapped = wrap({ agent });
        expect(agent.durable).toEqual({ executionEngine: false });
        expect(agent.__getStreamBus()).toBe(bus);
        expect(hasDurableExecution(agent)).toBe(false);
        expect(hasDurableExecution(wrapped)).toBe(true);
        expect(mastra.getAgent('agent')).toBe(agent);
        release.resolve();
        expect(await text).toBe('Your order has shipped.');
        expect(await output.finishReason).toBe('stop');
        expect(llm.getRequests()).toHaveLength(2);
        expect(JSON.stringify(llm.getRequests()[1]?.body)).toContain('shipped');
      } finally {
        release.resolve();
        await output.consumeStream();
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
      new Mastra({ agents: { dynamic: agent }, durable: { executionEngine: 'durable' } });
      const warn = vi.spyOn(ConsoleLogger.prototype, 'warn');
      try {
        for (let turn = 0; turn < 3; turn++) {
          const output = await agent[method]('Ready?', {});
          expect(await output.text).toBe('Ready.');
          expect(
            warn.mock.calls.filter(([message]) => String(message).includes('does not support eagerToolExecution')),
          ).toHaveLength(turn === 0 ? 0 : 1);
        }
        expect(calls).toBe(3);
      } finally {
        warn.mockRestore();
      }
    },
  );
});

// The same registration must not disturb any existing engine's model request/output.
describeForAllEngines('Existing execution survives conflicting host policy registration', engine => {
  const getMock = useLoopScenarioAimock();
  it.each(['stream', 'generate'] as const)('%s retains the existing execution contract', async method => {
    const llm = getMock();
    llm.on({}, { content: 'Your order has shipped.' });
    const { agent } = await createSharedAgent(llm, { engine });
    const mastra = new Mastra({ durable: { executionEngine: 'evented' } });
    mastra.addAgent(agent);
    const result = await agent[method]('Where is my order?', {});
    const output = 'output' in result && result.output instanceof MastraModelOutput ? result.output : result;
    expect(await output.text).toBe('Your order has shipped.');
    expect(mastra.getAgentById(agent.id)).toBe(agent);
    expect(JSON.stringify(llm.getRequests()[0]?.body)).toContain('Where is my order?');
  });
});
