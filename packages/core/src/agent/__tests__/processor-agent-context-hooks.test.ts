/**
 * Every processor hook in the agentic loop receives the running agent.
 *
 * #28443 made chained processor steps carry `agent` forward, but the runners
 * the loop builds for per-step hooks (processInputStep, processLLMRequest,
 * processOutputStream, processOutputStep, processToolResult,
 * processLLMResponse, processOutputResult) were created without it, so every
 * processor in those hooks saw `agent: undefined`. Runs a tool round-trip
 * through a chain of two processors on the regular, durable and evented
 * engines and checks each hook call got the same agent instance.
 */
import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../mastra';
import type { Processor } from '../../processors';
import { InMemoryStore } from '../../storage';
import { Agent } from '../agent';
import { createDurableAgent } from '../durable/create-durable-agent';
import { createEventedAgent } from '../durable/create-evented-agent';

type Call = { processor: string; hook: string; agent: unknown };
type Engine = 'regular' | 'durable' | 'evented';

const PER_STEP_HOOKS = [
  'processInputStep',
  'processLLMRequest',
  'processOutputStream',
  'processOutputStep',
  'processToolResult',
  'processLLMResponse',
  'processOutputResult',
];

let llm: LLMock;

beforeAll(async () => {
  llm = new LLMock({ port: 0 });
  await llm.start();
});

beforeEach(() => {
  llm.clearFixtures();
  llm.clearRequests();
  llm.resetMatchCounts();
  llm.on(
    { endpoint: 'chat', hasToolResult: false },
    { toolCalls: [{ id: 'call_lookup', name: 'lookup', arguments: {} }] },
  );
  llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'done' });
});

afterAll(async () => {
  await llm.stop();
});

function recorder(id: string, calls: Call[]): Processor {
  const record = (hook: string, agent: unknown) => calls.push({ processor: id, hook, agent });
  return {
    id,
    processInput: ({ agent, messages }) => {
      record('processInput', agent);
      return messages;
    },
    processInputStep: ({ agent }) => {
      record('processInputStep', agent);
    },
    processLLMRequest: ({ agent }) => {
      record('processLLMRequest', agent);
    },
    processOutputStream: async ({ agent, part }) => {
      record('processOutputStream', agent);
      return part;
    },
    processOutputStep: ({ agent, messages }) => {
      record('processOutputStep', agent);
      return messages;
    },
    processToolResult: ({ agent }) => {
      record('processToolResult', agent);
    },
    processLLMResponse: ({ agent }) => {
      record('processLLMResponse', agent);
    },
    processOutputResult: ({ agent, messages }) => {
      record('processOutputResult', agent);
      return messages;
    },
  };
}

function buildAgent(calls: Call[]) {
  const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
  return new Agent({
    id: 'hook-agent',
    name: 'hook-agent',
    instructions: 'Use your tools.',
    model: openai.chat('gpt-4o-mini'),
    tools: {
      lookup: {
        id: 'lookup',
        description: 'Looks something up',
        inputSchema: z.object({}),
        execute: async () => ({ ok: true }),
      },
    },
    inputProcessors: [recorder('in-first', calls), recorder('in-second', calls)],
    outputProcessors: [recorder('out-first', calls), recorder('out-second', calls)],
  });
}

async function run(engine: Engine, calls: Call[]) {
  const agent = buildAgent(calls);
  if (engine === 'regular') {
    const output = await agent.stream('Look it up');
    expect(await output.text).toBe('done');
    return agent;
  }
  const wrapped = engine === 'durable' ? createDurableAgent({ agent }) : createEventedAgent({ agent });
  new Mastra({ agents: { hookAgent: wrapped }, storage: new InMemoryStore(), logger: false });
  const output = await wrapped.stream('Look it up');
  let text = '';
  for await (const chunk of output.fullStream) {
    if (chunk.type === 'text-delta') text += chunk.payload.text;
  }
  expect(text).toBe('done');
  return agent;
}

describe.each<Engine>(['regular', 'durable', 'evented'])('%s: processor hooks receive the running agent', engine => {
  it('passes the same agent to every hook of every chained processor', async () => {
    const calls: Call[] = [];
    const agent = await run(engine, calls);

    expect(llm.getRequests()).toHaveLength(2);
    for (const hook of PER_STEP_HOOKS) {
      const processors = new Set(calls.filter(call => call.hook === hook).map(call => call.processor));
      expect(processors.size, `${hook} ran for at least two chained processors`).toBeGreaterThanOrEqual(2);
    }
    const mismatched = calls.filter(call => call.agent !== agent).map(({ processor, hook }) => `${processor}.${hook}`);
    expect([...new Set(mismatched)]).toEqual([]);
  }, 60_000);
});
