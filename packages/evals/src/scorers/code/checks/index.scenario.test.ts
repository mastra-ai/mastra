/**
 * Scenario tests for Quick Checks.
 *
 * Unlike the unit tests (index.test.ts) which call `scorer.run()` directly
 * with hand-crafted MastraDBMessage arrays, these tests wire checks through
 * the full `runEvals` pipeline with a real Agent backed by AIMock.
 * This validates that checks work end-to-end: AIMock scripted responses →
 * OpenAI v6 provider → Agent → runEvals → checks score correctly.
 */
import { createOpenAI } from '@ai-sdk/openai-v6';
import { LLMock } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { runEvals } from '@mastra/core/evals';
import { createTool } from '@mastra/core/tools';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { checks } from './index';

// ─── AIMock lifecycle ───────────────────────────────────────────────────────────

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

// ─── Helpers ────────────────────────────────────────────────────────────────────

const MODEL_ID = 'gpt-4o-mini';
let agentCounter = 0;

/** Build a text-only agent backed by AIMock that returns the scripted content. */
function textAgent(response: string) {
  mock.on({ endpoint: 'chat' }, { content: response });

  const openai = createOpenAI({
    apiKey: 'aimock-test-key',
    baseURL: `${mock.url.replace(/\/+$/, '')}/v1`,
  });

  return new Agent({
    id: `text-agent-${++agentCounter}`,
    name: 'Text Agent',
    instructions: 'Respond with the scripted text.',
    model: openai(MODEL_ID),
  });
}

/**
 * Build a tool-calling agent backed by AIMock: first request triggers a tool
 * call, second request (after tool result) returns final text.
 */
function toolCallingAgent(
  tools: Record<string, ReturnType<typeof createTool>>,
  toolCalls: { name: string; id: string; input: Record<string, unknown> }[],
  finalText: string,
) {
  // First request: model calls tool(s)
  mock.on(
    { endpoint: 'chat', hasToolResult: false },
    {
      toolCalls: toolCalls.map(tc => ({
        id: tc.id,
        name: tc.name,
        arguments: tc.input,
      })),
    },
  );

  // Second request: after tool results, model returns text
  mock.on({ endpoint: 'chat', hasToolResult: true }, { content: finalText });

  const openai = createOpenAI({
    apiKey: 'aimock-test-key',
    baseURL: `${mock.url.replace(/\/+$/, '')}/v1`,
  });

  return new Agent({
    id: `tool-agent-${++agentCounter}`,
    name: 'Tool Agent',
    instructions: 'Call tools and respond.',
    model: openai(MODEL_ID),
    tools,
  });
}

/**
 * Build a multi-tool-calling agent backed by AIMock: calls tools in sequence
 * (one per turn), then returns final text.
 */
function multiToolCallingAgent(
  tools: Record<string, ReturnType<typeof createTool>>,
  toolSequence: { name: string; id: string; input: Record<string, unknown> }[],
  finalText: string,
) {
  // Each tool call response is matched by its preceding tool result id
  for (let i = 0; i < toolSequence.length; i++) {
    const tc = toolSequence[i]!;
    if (i === 0) {
      // First request: no tool results yet
      mock.on(
        { endpoint: 'chat', hasToolResult: false },
        { toolCalls: [{ id: tc.id, name: tc.name, arguments: tc.input }] },
      );
    } else {
      // After previous tool result, call next tool
      mock.on(
        { endpoint: 'chat', toolCallId: toolSequence[i - 1]!.id, hasToolResult: true },
        { toolCalls: [{ id: tc.id, name: tc.name, arguments: tc.input }] },
      );
    }
  }

  // After last tool result, return final text
  mock.on(
    { endpoint: 'chat', toolCallId: toolSequence[toolSequence.length - 1]!.id, hasToolResult: true },
    { content: finalText },
  );

  const openai = createOpenAI({
    apiKey: 'aimock-test-key',
    baseURL: `${mock.url.replace(/\/+$/, '')}/v1`,
  });

  return new Agent({
    id: `multi-tool-agent-${++agentCounter}`,
    name: 'Multi Tool Agent',
    instructions: 'Call tools in sequence and respond.',
    model: openai(MODEL_ID),
    tools,
  });
}

// ─── Tool fixtures ──────────────────────────────────────────────────────────────

const weatherTool = createTool({
  id: 'get_weather',
  description: 'Get weather for a city',
  inputSchema: z.object({ city: z.string() }),
  outputSchema: z.object({ temperature: z.number(), condition: z.string() }),
  execute: async () => ({ temperature: 72, condition: 'sunny' }),
});

const searchTool = createTool({
  id: 'search',
  description: 'Search the web',
  inputSchema: z.object({ query: z.string() }),
  outputSchema: z.object({ results: z.array(z.string()) }),
  execute: async () => ({ results: ['result1', 'result2'] }),
});

const summarizeTool = createTool({
  id: 'summarize',
  description: 'Summarize text',
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ summary: z.string() }),
  execute: async () => ({ summary: 'A brief summary.' }),
});

// ─── Scenarios ──────────────────────────────────────────────────────────────────

describe('Quick Checks — scenario tests via runEvals + AIMock', () => {
  describe('text output checks with a text-only agent', () => {
    it('includes, excludes, similarity, matches all score correctly on a weather response', async () => {
      const agent = textAgent('It is sunny and 72°F in Brooklyn today.');

      const result = await runEvals({
        data: [{ input: 'What is the weather in Brooklyn?' }],
        scorers: [
          checks.includes('sunny'),
          checks.includes('Brooklyn'),
          checks.excludes('error'),
          checks.excludes('rainy'),
          checks.similarity('Sunny and 72°F in Brooklyn', { threshold: 0.5 }),
          checks.matches(/\d+°F/),
        ],
        target: agent,
      });

      expect(result.scores['check-includes']).toBe(1);
      expect(result.scores['check-excludes']).toBe(1);
      expect(result.scores['check-similarity']).toBe(1);
      expect(result.scores['check-matches']).toBe(1);
    });

    it('equals passes when agent response is exact match', async () => {
      const agent = textAgent('Hello, world!');

      const result = await runEvals({
        data: [{ input: 'Greet me' }],
        scorers: [checks.equals('Hello, world!')],
        target: agent,
      });

      expect(result.scores['check-equals']).toBe(1);
    });

    it('includes scores 0 when expected text is missing', async () => {
      const agent = textAgent('The sky is clear and warm.');

      const result = await runEvals({
        data: [{ input: 'Weather?' }],
        scorers: [checks.includes('rainy')],
        target: agent,
      });

      expect(result.scores['check-includes']).toBe(0);
    });

    it('excludes scores 0 when unwanted text is present', async () => {
      const agent = textAgent('An error occurred while fetching weather data.');

      const result = await runEvals({
        data: [{ input: 'Weather?' }],
        scorers: [checks.excludes('error')],
        target: agent,
      });

      expect(result.scores['check-excludes']).toBe(0);
    });
  });

  describe('tool call checks with a tool-calling agent', () => {
    it('calledTool, noToolErrors, and maxToolCalls pass for a well-behaved agent', async () => {
      const agent = toolCallingAgent(
        { get_weather: weatherTool },
        [{ name: 'get_weather', id: 'call-1', input: { city: 'Brooklyn' } }],
        'It is sunny and 72°F in Brooklyn.',
      );

      const result = await runEvals({
        data: [{ input: 'What is the weather in Brooklyn?' }],
        scorers: [
          checks.calledTool('get_weather'),
          checks.noToolErrors(),
          checks.maxToolCalls(3),
          checks.includes('sunny'),
        ],
        target: agent,
      });

      expect(result.scores['check-called-tool']).toBe(1);
      expect(result.scores['check-no-tool-errors']).toBe(1);
      expect(result.scores['check-max-tool-calls']).toBe(1);
      expect(result.scores['check-includes']).toBe(1);
    });

    it('toolOrder verifies multi-tool sequence through runEvals', async () => {
      const agent = multiToolCallingAgent(
        { search: searchTool, summarize: summarizeTool },
        [
          { name: 'search', id: 'call-s1', input: { query: 'AI trends' } },
          { name: 'summarize', id: 'call-s2', input: { text: 'search results' } },
        ],
        'Here is a summary of AI trends.',
      );

      const result = await runEvals({
        data: [{ input: 'Research AI trends' }],
        scorers: [
          checks.calledTool('search'),
          checks.calledTool('summarize'),
          checks.toolOrder(['search', 'summarize']),
          checks.maxToolCalls(5),
        ],
        target: agent,
      });

      expect(result.scores['check-called-tool']).toBe(1);
      expect(result.scores['check-tool-order']).toBe(1);
      expect(result.scores['check-max-tool-calls']).toBe(1);
    });

    it('didNotCall and usedNoTools work on a text-only agent through runEvals', async () => {
      const agent = textAgent('I can help with general questions.');

      const result = await runEvals({
        data: [{ input: 'Tell me a joke' }],
        scorers: [checks.didNotCall('delete_user'), checks.usedNoTools()],
        target: agent,
      });

      expect(result.scores['check-did-not-call']).toBe(1);
      expect(result.scores['check-used-no-tools']).toBe(1);
    });

    it('calledTool scores 0 when the expected tool was not called', async () => {
      const agent = toolCallingAgent(
        { search: searchTool, get_weather: weatherTool },
        [{ name: 'search', id: 'call-1', input: { query: 'news' } }],
        'Here are the results.',
      );

      const result = await runEvals({
        data: [{ input: 'Find news' }],
        scorers: [checks.calledTool('get_weather')],
        target: agent,
      });

      expect(result.scores['check-called-tool']).toBe(0);
    });

    it('maxToolCalls scores 0 when agent exceeds the limit', async () => {
      const agent = multiToolCallingAgent(
        { search: searchTool, summarize: summarizeTool },
        [
          { name: 'search', id: 'call-1', input: { query: 'a' } },
          { name: 'summarize', id: 'call-2', input: { text: 'b' } },
        ],
        'Done.',
      );

      const result = await runEvals({
        data: [{ input: 'Do research' }],
        scorers: [checks.maxToolCalls(1)],
        target: agent,
      });

      expect(result.scores['check-max-tool-calls']).toBe(0);
    });
  });

  describe('mixed text + tool checks compose in a single runEvals call', () => {
    it('combines text and tool checks for a weather agent scenario', async () => {
      const agent = toolCallingAgent(
        { get_weather: weatherTool },
        [{ name: 'get_weather', id: 'call-w1', input: { city: 'Brooklyn' } }],
        'The weather in Brooklyn is sunny, 72°F.',
      );

      const result = await runEvals({
        data: [{ input: 'What is the weather in Brooklyn?' }],
        scorers: [
          checks.includes('sunny'),
          checks.includes('Brooklyn'),
          checks.excludes('error'),
          checks.matches(/\d+°F/),
          checks.calledTool('get_weather'),
          checks.didNotCall('delete_user'),
          checks.noToolErrors(),
          checks.maxToolCalls(3),
        ],
        target: agent,
      });

      expect(result.scores['check-includes']).toBe(1);
      expect(result.scores['check-excludes']).toBe(1);
      expect(result.scores['check-matches']).toBe(1);
      expect(result.scores['check-called-tool']).toBe(1);
      expect(result.scores['check-did-not-call']).toBe(1);
      expect(result.scores['check-no-tool-errors']).toBe(1);
      expect(result.scores['check-max-tool-calls']).toBe(1);
    });
  });

  describe('multi-item dataset with checks', () => {
    it('computes average scores across multiple data items', async () => {
      const agent = textAgent('The answer is 42.');

      const result = await runEvals({
        data: [{ input: 'What is the answer?' }, { input: 'What is the answer?' }],
        scorers: [checks.includes('42'), checks.excludes('error')],
        target: agent,
      });

      expect(result.scores['check-includes']).toBe(1);
      expect(result.scores['check-excludes']).toBe(1);
      expect(result.summary.totalItems).toBe(2);
    });
  });
});
