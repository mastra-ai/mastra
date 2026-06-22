import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { createDurableAgent } from '../../../../agent/durable';
import type { DurableAgent } from '../../../../agent/durable';
import { Mastra } from '../../../../mastra';
import { MockMemory } from '../../../../memory/mock';
import type { Processor } from '../../../../processors';
import { RequestContext } from '../../../../request-context';
import { InMemoryStore } from '../../../../storage';
import type { MastraModelOutput } from '../../../../stream/base/output';
import type { ChunkType } from '../../../../stream/types';
import { createTool } from '../../../../tools';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * AIMock loop scenarios executed with the **DurableAgent** execution path.
 *
 * DurableAgent wraps a regular Agent with durable execution capabilities:
 * - The agentic loop runs inside a workflow (with steps)
 * - Stream events flow through PubSub for distribution
 * - Results are delivered via a CachingPubSub subscriber stream
 *
 * This serialisation/pubsub boundary can surface regressions that the default
 * (direct) engine hides:
 *
 * - Tool results must survive the workflow step → PubSub → subscriber path.
 * - Cross-turn message ordering must be preserved after workflow execution.
 * - The DurableAgent stream adapter must faithfully reconstruct chunks.
 * - Error objects must survive the workflow boundary.
 * - Concurrent tool execution correctness under workflow step dispatch.
 *
 * Each scenario mirrors an existing default-engine scenario to confirm the
 * durable path produces identical results where behaviour is shared.
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

let scenarioCounter = 0;

interface DurableScenarioOptions {
  llm: LLMock;
  fixtures: (llm: LLMock) => void;
  prompt: string;
  tools?: Record<string, any>;
  instructions?: string;

  maxSteps?: number;
  structuredOutput?: any;
  memory?: MockMemory;
  threadId?: string;
  resourceId?: string;
  memoryOptions?: { lastMessages?: number | false; semanticRecall?: boolean };
  requestContext?: RequestContext<any>;

  collectChunks?: boolean;
  modelSettings?: any;
}

interface DurableScenarioResult {
  output: MastraModelOutput<unknown>;
  requests: any[];
  llm: LLMock;
  chunks?: ChunkType[];
  durableAgent: DurableAgent;
  mastra: any;
}

async function runDurableLoopScenario(opts: DurableScenarioOptions): Promise<DurableScenarioResult> {
  opts.fixtures(opts.llm);

  const openai = createOpenAI({
    apiKey: 'aimock-test-key',
    baseURL: `${opts.llm.url.replace(/\/+$/, '')}/v1`,
  });

  const agentId = `durable-scenario-agent-${++scenarioCounter}`;

  const baseAgent = new Agent({
    id: agentId,
    name: 'DurableAgent Loop Scenario Agent',
    instructions: opts.instructions ?? 'You are a test agent driven by scripted AIMock responses.',
    model: openai(SCENARIO_MODEL_ID),
    ...(opts.tools ? { tools: opts.tools } : {}),
    ...(opts.memory ? { memory: opts.memory } : {}),
  });

  const durableAgent = createDurableAgent({ agent: baseAgent });

  const mastra = new Mastra({
    agents: { [agentId]: durableAgent as any },
    logger: false,
    storage: new InMemoryStore(),
  });

  const registeredAgent = mastra.getAgent(agentId) as unknown as DurableAgent;

  const memoryOption =
    opts.memory && opts.threadId
      ? {
          memory: {
            thread: opts.threadId,
            ...(opts.resourceId ? { resource: opts.resourceId } : {}),
            ...(opts.memoryOptions ? { options: opts.memoryOptions } : {}),
          },
        }
      : {};

  const streamOptions = {
    ...(opts.maxSteps ? { maxSteps: opts.maxSteps } : {}),
    ...(opts.structuredOutput ? { structuredOutput: opts.structuredOutput } : {}),
    ...(opts.requestContext ? { requestContext: opts.requestContext } : {}),

    ...(opts.modelSettings ? { modelSettings: opts.modelSettings } : {}),
    ...memoryOption,
  };

  const result = await registeredAgent.stream(opts.prompt, streamOptions);
  const output = result.output as unknown as MastraModelOutput<unknown>;

  let chunks: ChunkType[] | undefined;
  if (opts.collectChunks) {
    chunks = [];
    for await (const chunk of result.fullStream as AsyncIterable<ChunkType>) {
      chunks.push(chunk);
    }
  } else {
    for await (const _chunk of result.fullStream as AsyncIterable<any>) {
      // drain
    }
  }

  result.cleanup();

  return {
    output,
    requests: opts.llm.getRequests(),
    llm: opts.llm,
    ...(chunks ? { chunks } : {}),
    durableAgent: registeredAgent,
    mastra,
  };
}

// ── Test Suites ───────────────────────────────────────────────────────────────

describe('AIMock loop scenarios (DurableAgent)', () => {
  // ── Core tool loop ──────────────────────────────────────────────────

  describe('multi-step tool loop', () => {
    let mock: LLMock;

    beforeAll(async () => {
      mock = new LLMock({ port: 0 });
      await mock.start();
    });

    afterEach(() => {
      mock.clearFixtures();
      mock.clearRequests();
      mock.resetMatchCounts();
    });

    afterAll(async () => {
      await mock.stop();
    });

    it('feeds the turn-1 tool result into the turn-2 model request', async () => {
      const lookupTool = createTool({
        id: 'lookup_status',
        description: 'Look up a status payload for a query.',
        inputSchema: z.object({ query: z.string() }),
        outputSchema: z.object({ status: z.string() }),
        execute: async ({ query }) => ({ status: `STATUS_OK:${query}` }),
      });

      const { output, requests } = await runDurableLoopScenario({
        llm: mock,
        prompt: 'Look up the status for query alpha.',
        tools: { lookup_status: lookupTool },
        maxSteps: 5,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_lookup_alpha', name: 'lookup_status', arguments: { query: 'alpha' } }] },
          );
          llm.on(
            { endpoint: 'chat', toolCallId: 'call_lookup_alpha', hasToolResult: true },
            { content: 'The status for alpha is STATUS_OK:alpha.' },
          );
        },
      });

      expect(requests).toHaveLength(2);
      const text = await output.text;
      expect(text).toContain('STATUS_OK:alpha');

      const toolResults = await output.toolResults;
      expect(toolResults).toHaveLength(1);
      expect(toolResults[0]?.payload.toolName).toBe('lookup_status');

      const turn2Messages = requests[1]?.body?.messages ?? [];
      expect(JSON.stringify(turn2Messages)).toContain('STATUS_OK:alpha');

      const toolMessage = turn2Messages.find((m: any) => m.role === 'tool') as { tool_call_id?: string } | undefined;
      expect(toolMessage?.tool_call_id).toBe('call_lookup_alpha');
    });

    it('handles a long tool chain capped by maxSteps through durable dispatch', async () => {
      let executionCount = 0;

      const incrementTool = createTool({
        id: 'increment',
        description: 'Increments a counter',
        inputSchema: z.object({}),
        execute: async () => {
          executionCount++;
          return { count: executionCount };
        },
      });

      const { requests } = await runDurableLoopScenario({
        llm: mock,
        prompt: 'Keep incrementing',
        tools: { increment: incrementTool },
        maxSteps: 5,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_inc_1', name: 'increment', arguments: {} }] },
          );
          llm.on(
            { endpoint: 'chat', hasToolResult: true },
            { toolCalls: [{ id: 'call_inc_more', name: 'increment', arguments: {} }] },
          );
        },
      });

      expect(requests).toHaveLength(5);
      expect(executionCount).toBe(5);
    });
  });

  // ── Cross-turn message ordering ─────────────────────────────────────

  describe('cross-turn message ordering', () => {
    let mock: LLMock;

    beforeAll(async () => {
      mock = new LLMock({ port: 0 });
      await mock.start();
    });

    afterEach(() => {
      mock.clearFixtures();
      mock.clearRequests();
      mock.resetMatchCounts();
    });

    afterAll(async () => {
      await mock.stop();
    });

    it('round-trips multiple parallel tool results with correct ids', async () => {
      const getCity = createTool({
        id: 'get_city',
        description: 'Return a city name.',
        inputSchema: z.object({}),
        outputSchema: z.object({ city: z.string() }),
        execute: async () => ({ city: 'CITY_PARIS' }),
      });

      const getTemp = createTool({
        id: 'get_temp',
        description: 'Return a temperature.',
        inputSchema: z.object({}),
        outputSchema: z.object({ temp: z.string() }),
        execute: async () => ({ temp: 'TEMP_21C' }),
      });

      const { requests, output } = await runDurableLoopScenario({
        llm: mock,
        prompt: 'Get the city and temperature.',
        tools: { get_city: getCity, get_temp: getTemp },
        maxSteps: 5,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            {
              toolCalls: [
                { id: 'call_city', name: 'get_city', arguments: {} },
                { id: 'call_temp', name: 'get_temp', arguments: {} },
              ],
            },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done: CITY_PARIS at TEMP_21C.' });
        },
      });

      expect(requests).toHaveLength(2);

      const turn2Messages = requests[1]?.body?.messages ?? [];
      const toolMessages = turn2Messages.filter((m: any) => m.role === 'tool') as Array<{
        tool_call_id?: string;
        content?: unknown;
      }>;

      const idsToResults = new Map(toolMessages.map(m => [m.tool_call_id, JSON.stringify(m.content)] as const));
      expect(idsToResults.has('call_city')).toBe(true);
      expect(idsToResults.has('call_temp')).toBe(true);
      expect(idsToResults.get('call_city')).toContain('CITY_PARIS');
      expect(idsToResults.get('call_temp')).toContain('TEMP_21C');

      const text = await output.text;
      expect(text).toContain('CITY_PARIS');
      expect(text).toContain('TEMP_21C');
    });
  });

  // ── Tool execution errors ──────────────────────────────────────────

  describe('tool execution errors', () => {
    let mock: LLMock;

    beforeAll(async () => {
      mock = new LLMock({ port: 0 });
      await mock.start();
    });

    afterEach(() => {
      mock.clearFixtures();
      mock.clearRequests();
      mock.resetMatchCounts();
    });

    afterAll(async () => {
      await mock.stop();
    });

    it('emits a tool-error chunk when a tool throws in the durable boundary', async () => {
      const flakyTool = createTool({
        id: 'flaky',
        description: 'A tool that always throws.',
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.boolean() }),
        execute: async () => {
          throw new Error('DURABLE_TOOL_BOOM');
        },
      });

      const { chunks, requests } = await runDurableLoopScenario({
        llm: mock,
        prompt: 'Call the flaky tool.',
        tools: { flaky: flakyTool },
        maxSteps: 5,
        collectChunks: true,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_flaky', name: 'flaky', arguments: {} }] },
          );
          llm.on(
            { endpoint: 'chat', toolCallId: 'call_flaky', hasToolResult: true },
            { content: 'The tool failed, so I recovered gracefully.' },
          );
        },
      });

      // DurableAgent terminates the loop when all tool calls in a turn error
      // (only ToolNotFoundError allows continuation). The error is emitted as a chunk.
      expect(chunks).toBeDefined();
      const toolErrorChunks = chunks!.filter(c => c.type === 'tool-error');
      expect(toolErrorChunks.length).toBeGreaterThan(0);
      expect(JSON.stringify(toolErrorChunks[0])).toMatch(/DURABLE_TOOL_BOOM/i);

      // The first request should have asked for the tool call
      expect(requests.length).toBeGreaterThanOrEqual(1);
    });

    it('rejects an unknown tool and reports it back through the durable boundary', async () => {
      const realTool = createTool({
        id: 'real_tool',
        description: 'A real registered tool.',
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.boolean() }),
        execute: async () => ({ ok: true }),
      });

      const { output, requests } = await runDurableLoopScenario({
        llm: mock,
        prompt: 'Call a tool.',
        tools: { real_tool: realTool },
        maxSteps: 5,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_ghost', name: 'nonexistent_tool', arguments: {} }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'That tool does not exist.' });
        },
      });

      expect(requests).toHaveLength(2);
      const turn2Messages = requests[1]?.body?.messages ?? [];
      const toolMessage = turn2Messages.find((m: any) => m.role === 'tool') as { tool_call_id?: string } | undefined;
      expect(toolMessage?.tool_call_id).toBe('call_ghost');

      const text = await output.text;
      expect(text).toContain('does not exist');
    });
  });

  // ── Structured output ───────────────────────────────────────────────

  describe('structured output', () => {
    let mock: LLMock;

    beforeAll(async () => {
      mock = new LLMock({ port: 0 });
      await mock.start();
    });

    afterEach(() => {
      mock.clearFixtures();
      mock.clearRequests();
      mock.resetMatchCounts();
    });

    afterAll(async () => {
      await mock.stop();
    });

    it('plumbs tool result into structured turn through durable execution', async () => {
      const lookupTool = createTool({
        id: 'lookup_status',
        description: 'Look up a status payload for a query.',
        inputSchema: z.object({ query: z.string() }),
        outputSchema: z.object({ status: z.string() }),
        execute: async ({ query }) => ({ status: `STATUS_OK:${query}` }),
      });

      const { output, requests } = await runDurableLoopScenario({
        llm: mock,
        prompt: 'Look up alpha and report the structured result.',
        tools: { lookup_status: lookupTool },
        maxSteps: 5,
        structuredOutput: { schema: z.object({ query: z.string(), status: z.string() }) },
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_lookup_alpha', name: 'lookup_status', arguments: { query: 'alpha' } }] },
          );
          llm.on(
            { endpoint: 'chat', hasToolResult: true },
            { content: JSON.stringify({ query: 'alpha', status: 'STATUS_OK:alpha' }) },
          );
        },
      });

      expect(requests.length).toBeGreaterThanOrEqual(2);

      const turn2Messages = (requests[1]?.body as any)?.messages ?? [];
      const toolMessage = turn2Messages.find((m: any) => m.role === 'tool');
      expect(JSON.stringify(toolMessage?.content)).toContain('STATUS_OK:alpha');

      // The structured text result should contain the JSON
      const text = await output.text;
      expect(text).toContain('STATUS_OK:alpha');
    });
  });

  // ── Text streaming fidelity ─────────────────────────────────────────

  describe('text streaming fidelity', () => {
    let mock: LLMock;

    beforeAll(async () => {
      mock = new LLMock({ port: 0 });
      await mock.start();
    });

    afterEach(() => {
      mock.clearFixtures();
      mock.clearRequests();
      mock.resetMatchCounts();
    });

    afterAll(async () => {
      await mock.stop();
    });

    it('reassembles multi-delta text in order through the durable pipeline', async () => {
      const scriptedText = 'The durable agent preserves delta ordering through pubsub dispatch.';

      const { output, chunks } = await runDurableLoopScenario({
        llm: mock,
        prompt: 'Write a sentence.',
        maxSteps: 2,
        collectChunks: true,
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: scriptedText });
        },
      });

      expect(chunks).toBeDefined();

      const textDeltas = chunks!.filter(
        (c): c is Extract<ChunkType, { type: 'text-delta' }> => c.type === 'text-delta',
      );
      expect(textDeltas.length).toBeGreaterThan(0);

      for (const delta of textDeltas) {
        expect(delta.payload).toBeTruthy();
        expect(typeof delta.payload.text).toBe('string');
        expect(delta.payload.text.length).toBeGreaterThan(0);
      }

      const reassembled = textDeltas.map(d => d.payload.text).join('');
      const finalText = await (output as unknown as { text: Promise<string> }).text;
      expect(reassembled).toBe(finalText);
      expect(finalText).toBe(scriptedText);
    });

    it('emits text-delta chunks and finishes with a finish chunk', async () => {
      const { chunks } = await runDurableLoopScenario({
        llm: mock,
        prompt: 'Test lifecycle ordering.',
        maxSteps: 2,
        collectChunks: true,
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: 'Lifecycle test.' });
        },
      });

      expect(chunks).toBeDefined();
      const types = chunks!.map(c => c.type);

      // DurableAgent stream adapter reconstructs chunks from PubSub events.
      // step-start is not emitted as a chunk in the durable path (it's a control event).
      // Key invariants: text-delta present, finish is last.
      expect(types[types.length - 1]).toBe('finish');

      const firstTextDelta = types.indexOf('text-delta');
      expect(firstTextDelta).toBeGreaterThanOrEqual(0);
      expect(types.includes('response-metadata')).toBe(true);
    });
  });

  // ── Memory and conversation history ─────────────────────────────────

  describe('memory conversation history', () => {
    let mock: LLMock;

    beforeAll(async () => {
      mock = new LLMock({ port: 0 });
      await mock.start();
    });

    afterEach(() => {
      mock.clearFixtures();
      mock.clearRequests();
      mock.resetMatchCounts();
    });

    afterAll(async () => {
      await mock.stop();
    });

    it('recalls prior thread messages into the next request', async () => {
      const memory = new MockMemory();
      const threadId = 'durable-memory-thread';
      const resourceId = 'durable-memory-resource';

      await memory.saveThread({
        thread: {
          id: threadId,
          title: 'Durable History Thread',
          resourceId,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await runDurableLoopScenario({
        llm: mock,
        prompt: 'My favorite number is DURABLE_42.',
        memory,
        threadId,
        resourceId,
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: 'Got it, I will remember that.' });
        },
      });

      mock.clearRequests();
      mock.clearFixtures();
      mock.resetMatchCounts();

      const { requests, output } = await runDurableLoopScenario({
        llm: mock,
        prompt: 'What is my favorite number?',
        memory,
        threadId,
        resourceId,
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: 'Your favorite number is DURABLE_42.' });
        },
      });

      expect(requests).toHaveLength(1);

      const serialized = JSON.stringify(requests[0]?.body?.messages ?? []);
      expect(serialized).toContain('DURABLE_42');
      expect(serialized).toContain('What is my favorite number?');

      const text = await output.text;
      expect(text).toContain('DURABLE_42');
    });
  });

  // ── Stop conditions ─────────────────────────────────────────────────

  describe('stop conditions', () => {
    let mock: LLMock;

    beforeAll(async () => {
      mock = new LLMock({ port: 0 });
      await mock.start();
    });

    afterEach(() => {
      mock.clearFixtures();
      mock.clearRequests();
      mock.resetMatchCounts();
    });

    afterAll(async () => {
      await mock.stop();
    });

    it('respects maxSteps boundary with durable dispatch', async () => {
      let executionCount = 0;

      const counter = createTool({
        id: 'counter',
        description: 'Counts up.',
        inputSchema: z.object({}),
        execute: async () => {
          executionCount++;
          return { count: executionCount };
        },
      });

      const { requests } = await runDurableLoopScenario({
        llm: mock,
        prompt: 'Count three times.',
        tools: { counter },
        maxSteps: 3,
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { toolCalls: [{ id: 'call_cnt', name: 'counter', arguments: {} }] });
        },
      });

      // maxSteps limits the number of LLM steps
      expect(requests).toHaveLength(3);
      expect(executionCount).toBe(3);
    });

    it('model finishes before maxSteps is reached', async () => {
      const { output, requests } = await runDurableLoopScenario({
        llm: mock,
        prompt: 'Say hello.',
        maxSteps: 10,
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: 'Hello world.' });
        },
      });

      expect(requests).toHaveLength(1);
      const text = await output.text;
      expect(text).toBe('Hello world.');
    });
  });

  // ── Provider error handling ─────────────────────────────────────────

  describe('provider errors', () => {
    let mock: LLMock;

    beforeAll(async () => {
      mock = new LLMock({ port: 0 });
      await mock.start();
    });

    afterEach(() => {
      mock.clearFixtures();
      mock.clearRequests();
      mock.resetMatchCounts();
    });

    afterAll(async () => {
      await mock.stop();
    });

    it('surfaces a provider 500 through the durable pipeline output', async () => {
      const openai = createOpenAI({
        apiKey: 'aimock-test-key',
        baseURL: `${mock.url.replace(/\/+$/, '')}/v1`,
      });

      const agentId = `durable-provider-error-agent-${++scenarioCounter}`;
      const baseAgent = new Agent({
        id: agentId,
        name: 'DurableAgent Provider Error Agent',
        instructions: 'You are a test agent.',
        model: openai(SCENARIO_MODEL_ID),
      });

      const durableAgent = createDurableAgent({ agent: baseAgent });

      const mastra = new Mastra({
        agents: { [agentId]: durableAgent as any },
        logger: false,
        storage: new InMemoryStore(),
      });

      const registeredAgent = mastra.getAgent(agentId) as unknown as DurableAgent;

      mock.on({ endpoint: 'chat' }, { error: { message: 'DURABLE_PROVIDER_ERROR' }, status: 500 });

      const result = await registeredAgent.stream('Trigger a provider error.', {
        maxSteps: 2,
      });

      // DurableAgent surfaces provider errors by erroring the ReadableStream controller.
      // This makes output.text reject with the error.
      let caughtError: Error | undefined;
      try {
        await result.output.text;
      } catch (e) {
        caughtError = e as Error;
      }

      try {
        result.cleanup();
      } catch {
        // cleanup may fail after stream error
      }

      expect(caughtError).toBeDefined();
      expect(caughtError!.message).toContain('DURABLE_PROVIDER_ERROR');
    }, 15_000);
  });

  // ── Input processors ────────────────────────────────────────────────

  describe('input processors', () => {
    let mock: LLMock;

    beforeAll(async () => {
      mock = new LLMock({ port: 0 });
      await mock.start();
    });

    afterEach(() => {
      mock.clearFixtures();
      mock.clearRequests();
      mock.resetMatchCounts();
    });

    afterAll(async () => {
      await mock.stop();
    });

    it('redacts the user message before it reaches the model request', async () => {
      const redactInput: Processor = {
        id: 'redact-input-secret',
        processInput({ messages }) {
          return messages.map(message => {
            if (message.role !== 'user') return message;
            return {
              ...message,
              content: {
                ...message.content,
                parts: message.content.parts?.map(part => {
                  if (part.type === 'text' && 'text' in part && typeof part.text === 'string') {
                    return { ...part, text: part.text.replace(/DURABLE_SECRET/g, '[REDACTED]') };
                  }
                  return part;
                }),
              },
            };
          });
        },
      };

      // For DurableAgent, input processors must be configured on the Agent constructor
      const openai = createOpenAI({
        apiKey: 'aimock-test-key',
        baseURL: `${mock.url.replace(/\/+$/, '')}/v1`,
      });

      const agentId = `durable-input-proc-agent-${++scenarioCounter}`;
      const baseAgent = new Agent({
        id: agentId,
        name: 'DurableAgent Input Processor Agent',
        instructions: 'You are a test agent driven by scripted AIMock responses.',
        model: openai(SCENARIO_MODEL_ID),
        inputProcessors: [redactInput],
      });

      const durableAgent = createDurableAgent({ agent: baseAgent });

      const mastra = new Mastra({
        agents: { [agentId]: durableAgent as any },
        logger: false,
        storage: new InMemoryStore(),
      });

      const registeredAgent = mastra.getAgent(agentId) as unknown as DurableAgent;

      mock.on({ endpoint: 'chat' }, { content: 'Acknowledged.' });

      const result = await registeredAgent.stream('My password is DURABLE_SECRET, please acknowledge.');
      for await (const _chunk of result.fullStream as AsyncIterable<any>) {
        // drain
      }
      try {
        result.cleanup();
      } catch {
        // cleanup may race with TTLCache dispose
      }

      const requests = mock.getRequests();
      expect(requests).toHaveLength(1);
      const serialized = JSON.stringify(requests[0]?.body?.messages ?? []);
      expect(serialized).toContain('[REDACTED]');
      expect(serialized).not.toContain('DURABLE_SECRET');

      const text = await result.output.text;
      expect(text).toContain('Acknowledged.');
    });
  });

  // ── Request context passthrough ─────────────────────────────────────

  describe('request context passthrough', () => {
    let mock: LLMock;

    beforeAll(async () => {
      mock = new LLMock({ port: 0 });
      await mock.start();
    });

    afterEach(() => {
      mock.clearFixtures();
      mock.clearRequests();
      mock.resetMatchCounts();
    });

    afterAll(async () => {
      await mock.stop();
    });

    it('requestContext passes through to tool execute in durable mode', async () => {
      let capturedUserId: string | undefined;
      let capturedRole: string | undefined;

      const getUserData = createTool({
        id: 'get_user_data',
        description: 'Get user data based on request context',
        inputSchema: z.object({}),
        outputSchema: z.object({ userId: z.string(), role: z.string() }),
        execute: async (_input, context) => {
          capturedUserId = context?.requestContext?.get('userId');
          capturedRole = context?.requestContext?.get('role');
          return {
            userId: capturedUserId || 'unknown',
            role: capturedRole || 'unknown',
          };
        },
      });

      const requestContext = new RequestContext();
      requestContext.set('userId', 'durable-user-123');
      requestContext.set('role', 'admin');

      const { output, requests } = await runDurableLoopScenario({
        llm: mock,
        prompt: 'Get my user data.',
        tools: { get_user_data: getUserData },
        maxSteps: 5,
        requestContext,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_user', name: 'get_user_data', arguments: {} }] },
          );
          llm.on(
            { endpoint: 'chat', hasToolResult: true },
            { content: 'Your user ID is durable-user-123 and your role is admin.' },
          );
        },
      });

      expect(capturedUserId).toBe('durable-user-123');
      expect(capturedRole).toBe('admin');
      expect(requests).toHaveLength(2);

      const text = await output.text;
      expect(text).toContain('durable-user-123');
    });
  });

  // ── Empty/no-tool turns ─────────────────────────────────────────────

  describe('empty/no-tool turns', () => {
    let mock: LLMock;

    beforeAll(async () => {
      mock = new LLMock({ port: 0 });
      await mock.start();
    });

    afterEach(() => {
      mock.clearFixtures();
      mock.clearRequests();
      mock.resetMatchCounts();
    });

    afterAll(async () => {
      await mock.stop();
    });

    it('completes immediately when model returns text without tool calls', async () => {
      const unusedTool = createTool({
        id: 'unused_tool',
        description: 'A tool that should not be called',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async () => ({}),
      });

      const { requests, output } = await runDurableLoopScenario({
        llm: mock,
        prompt: 'Say hello',
        tools: { unused_tool: unusedTool },
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: 'Hello! How can I help you?' });
        },
      });

      expect(requests).toHaveLength(1);
      const text = await output.text;
      expect(text).toContain('Hello');
    });

    it('handles empty string response gracefully in durable mode', async () => {
      const { requests, output } = await runDurableLoopScenario({
        llm: mock,
        prompt: 'Return empty',
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: '' });
        },
      });

      expect(requests).toHaveLength(1);
      const text = await output.text;
      expect(text).toBe('');
    });
  });

  // ── Durable-specific: tool result serialisation fidelity ────────────

  describe('durable-specific: serialisation fidelity', () => {
    let mock: LLMock;

    beforeAll(async () => {
      mock = new LLMock({ port: 0 });
      await mock.start();
    });

    afterEach(() => {
      mock.clearFixtures();
      mock.clearRequests();
      mock.resetMatchCounts();
    });

    afterAll(async () => {
      await mock.stop();
    });

    it('tool results with complex nested objects survive durable execution', async () => {
      const complexResultTool = createTool({
        id: 'complex_result',
        description: 'Returns a complex nested result.',
        inputSchema: z.object({}),
        outputSchema: z.object({
          data: z.object({
            users: z.array(
              z.object({
                id: z.number(),
                name: z.string(),
                tags: z.array(z.string()),
              }),
            ),
            metadata: z.object({
              total: z.number(),
              page: z.number(),
            }),
          }),
        }),
        execute: async () => ({
          data: {
            users: [
              { id: 1, name: 'Alice', tags: ['admin', 'active'] },
              { id: 2, name: 'Bob', tags: ['user'] },
            ],
            metadata: { total: 2, page: 1 },
          },
        }),
      });

      const { output, requests } = await runDurableLoopScenario({
        llm: mock,
        prompt: 'Get complex data.',
        tools: { complex_result: complexResultTool },
        maxSteps: 5,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_complex', name: 'complex_result', arguments: {} }] },
          );
          llm.on(
            { endpoint: 'chat', hasToolResult: true },
            { content: 'Found 2 users: Alice (admin, active) and Bob (user).' },
          );
        },
      });

      expect(requests).toHaveLength(2);

      const turn2Serialized = JSON.stringify(requests[1]?.body?.messages ?? []);
      expect(turn2Serialized).toContain('Alice');
      expect(turn2Serialized).toContain('Bob');
      expect(turn2Serialized).toContain('admin');

      const text = await output.text;
      expect(text).toContain('Alice');
    });

    it('tool results with special characters survive durable serialisation', async () => {
      const specialCharTool = createTool({
        id: 'special_chars',
        description: 'Returns text with special characters.',
        inputSchema: z.object({}),
        outputSchema: z.object({ text: z.string() }),
        execute: async () => ({
          text: 'Line1\nLine2\tTabbed "quoted" \'single\' <html>&amp; backslash\\path',
        }),
      });

      const { requests } = await runDurableLoopScenario({
        llm: mock,
        prompt: 'Get special text.',
        tools: { special_chars: specialCharTool },
        maxSteps: 5,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_special', name: 'special_chars', arguments: {} }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Got the special text.' });
        },
      });

      expect(requests).toHaveLength(2);
      const turn2Serialized = JSON.stringify(requests[1]?.body?.messages ?? []);
      expect(turn2Serialized).toContain('Line1');
      expect(turn2Serialized).toContain('Line2');
      expect(turn2Serialized).toContain('quoted');
      expect(turn2Serialized).toContain('backslash');
    });
  });

  // ── Durable-specific: concurrent tool execution ─────────────────────

  describe('durable-specific: concurrent tool execution', () => {
    let mock: LLMock;

    beforeAll(async () => {
      mock = new LLMock({ port: 0 });
      await mock.start();
    });

    afterEach(() => {
      mock.clearFixtures();
      mock.clearRequests();
      mock.resetMatchCounts();
    });

    afterAll(async () => {
      await mock.stop();
    });

    it('parallel tool calls in a single turn all execute and produce results', async () => {
      const executionOrder: string[] = [];

      const toolA = createTool({
        id: 'tool_a',
        description: 'Tool A.',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        execute: async () => {
          executionOrder.push('A');
          return { result: 'RESULT_A' };
        },
      });

      const toolB = createTool({
        id: 'tool_b',
        description: 'Tool B.',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        execute: async () => {
          executionOrder.push('B');
          return { result: 'RESULT_B' };
        },
      });

      const toolC = createTool({
        id: 'tool_c',
        description: 'Tool C.',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        execute: async () => {
          executionOrder.push('C');
          return { result: 'RESULT_C' };
        },
      });

      const { output, requests } = await runDurableLoopScenario({
        llm: mock,
        prompt: 'Call all three tools.',
        tools: { tool_a: toolA, tool_b: toolB, tool_c: toolC },
        maxSteps: 5,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            {
              toolCalls: [
                { id: 'call_a', name: 'tool_a', arguments: {} },
                { id: 'call_b', name: 'tool_b', arguments: {} },
                { id: 'call_c', name: 'tool_c', arguments: {} },
              ],
            },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'All tools returned results.' });
        },
      });

      expect(requests).toHaveLength(2);

      expect(new Set(executionOrder)).toEqual(new Set(['A', 'B', 'C']));

      const turn2Serialized = JSON.stringify(requests[1]?.body?.messages ?? []);
      expect(turn2Serialized).toContain('RESULT_A');
      expect(turn2Serialized).toContain('RESULT_B');
      expect(turn2Serialized).toContain('RESULT_C');

      const text = await output.text;
      expect(text).toContain('All tools returned results');
    });

    it('mixed success/failure in parallel tools: all results fed back to the model', async () => {
      const successTool = createTool({
        id: 'success_tool',
        description: 'Always succeeds.',
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.boolean() }),
        execute: async () => ({ ok: true }),
      });

      const failTool = createTool({
        id: 'fail_tool',
        description: 'Always fails.',
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.boolean() }),
        execute: async () => {
          throw new Error('DURABLE_PARALLEL_FAIL');
        },
      });

      const { requests } = await runDurableLoopScenario({
        llm: mock,
        prompt: 'Call both tools.',
        tools: { success_tool: successTool, fail_tool: failTool },
        maxSteps: 5,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            {
              toolCalls: [
                { id: 'call_success', name: 'success_tool', arguments: {} },
                { id: 'call_fail', name: 'fail_tool', arguments: {} },
              ],
            },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'One succeeded, one failed.' });
        },
      });

      expect(requests).toHaveLength(2);

      const turn2Messages = requests[1]?.body?.messages ?? [];
      const toolMessages = turn2Messages.filter((m: any) => m.role === 'tool') as Array<{
        tool_call_id?: string;
        content?: unknown;
      }>;

      const ids = toolMessages.map(m => m.tool_call_id);
      expect(ids).toContain('call_success');
      expect(ids).toContain('call_fail');

      const successMsg = toolMessages.find(m => m.tool_call_id === 'call_success');
      expect(JSON.stringify(successMsg?.content)).toContain('true');

      const failMsg = toolMessages.find(m => m.tool_call_id === 'call_fail');
      expect(JSON.stringify(failMsg?.content)).toMatch(/error|fail/i);
    });
  });

  // ── Durable-specific: multi-turn state persistence ──────────────────

  describe('durable-specific: multi-turn state persistence', () => {
    let mock: LLMock;

    beforeAll(async () => {
      mock = new LLMock({ port: 0 });
      await mock.start();
    });

    afterEach(() => {
      mock.clearFixtures();
      mock.clearRequests();
      mock.resetMatchCounts();
    });

    afterAll(async () => {
      await mock.stop();
    });

    it('sequential tool calls accumulate results across turns', async () => {
      const fetchTool = createTool({
        id: 'fetch_data',
        description: 'Fetch data by key.',
        inputSchema: z.object({ key: z.string() }),
        outputSchema: z.object({ value: z.string() }),
        execute: async ({ key }) => ({ value: `VALUE_${key.toUpperCase()}` }),
      });

      const { requests } = await runDurableLoopScenario({
        llm: mock,
        prompt: 'Fetch data for keys alpha and beta.',
        tools: { fetch_data: fetchTool },
        maxSteps: 10,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_alpha', name: 'fetch_data', arguments: { key: 'alpha' } }] },
          );
          llm.on(
            { endpoint: 'chat', toolCallId: 'call_alpha', hasToolResult: true },
            { toolCalls: [{ id: 'call_beta', name: 'fetch_data', arguments: { key: 'beta' } }] },
          );
          llm.on(
            { endpoint: 'chat', toolCallId: 'call_beta', hasToolResult: true },
            { content: 'Alpha is VALUE_ALPHA, Beta is VALUE_BETA.' },
          );
        },
      });

      expect(requests).toHaveLength(3);

      expect(JSON.stringify(requests[1]?.body?.messages ?? [])).toContain('VALUE_ALPHA');

      const turn3Serialized = JSON.stringify(requests[2]?.body?.messages ?? []);
      expect(turn3Serialized).toContain('VALUE_BETA');
      expect(turn3Serialized).toContain('VALUE_ALPHA');
    });
  });

  // ── Durable-specific: model settings passthrough ────────────────────

  describe('durable-specific: model settings', () => {
    let mock: LLMock;

    beforeAll(async () => {
      mock = new LLMock({ port: 0 });
      await mock.start();
    });

    afterEach(() => {
      mock.clearFixtures();
      mock.clearRequests();
      mock.resetMatchCounts();
    });

    afterAll(async () => {
      await mock.stop();
    });

    it('modelSettings survive durable dispatch and land in the request body', async () => {
      const { requests } = await runDurableLoopScenario({
        llm: mock,
        prompt: 'Test settings.',
        maxSteps: 2,
        modelSettings: { temperature: 0.5 },
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: 'Done.' });
        },
      });

      expect(requests).toHaveLength(1);
      expect((requests[0]?.body as any)?.temperature).toBe(0.5);
    });
  });
});
