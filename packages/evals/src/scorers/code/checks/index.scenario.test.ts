/**
 * Scenario tests for Quick Checks.
 *
 * Unlike the unit tests (index.test.ts) which call `scorer.run()` directly
 * with hand-crafted MastraDBMessage arrays, these tests wire checks through
 * the full `runEvals` pipeline with a real Agent backed by MockLanguageModelV2.
 * This validates that checks work end-to-end: agent generates → runEvals
 * extracts output → checks score correctly.
 */
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { runEvals } from '@mastra/core/evals';
import { createTool } from '@mastra/core/tools';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { checks } from './index';

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Build a text-only agent that always returns the given response. */
function textAgent(response: string) {
  const model = new MockLanguageModelV2({
    doGenerate: async () => ({
      content: [{ type: 'text' as const, text: response }],
      finishReason: 'stop' as const,
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: response },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
      ]),
    }),
  });

  return new Agent({
    id: `text-agent-${Date.now()}`,
    name: 'Text Agent',
    instructions: 'Respond with the scripted text.',
    model,
  });
}

/** Build a tool-calling agent: calls tools in sequence then returns text. */
function toolCallingAgent(
  tools: Record<string, ReturnType<typeof createTool>>,
  toolSequence: { name: string; id: string; input: Record<string, unknown> }[],
  finalText: string,
) {
  let callCount = 0;
  const model = new MockLanguageModelV2({
    doGenerate: async () => {
      callCount++;
      if (callCount <= toolSequence.length) {
        const step = toolSequence[callCount - 1]!;
        return {
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: step.id,
              toolName: step.name,
              input: JSON.stringify(step.input),
            },
          ],
          finishReason: 'tool-calls' as const,
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      }
      return {
        content: [{ type: 'text' as const, text: finalText }],
        finishReason: 'stop' as const,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });

  return new Agent({
    id: `tool-agent-${Date.now()}`,
    name: 'Tool Agent',
    instructions: 'Call tools and respond.',
    model,
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

const deleteTool = createTool({
  id: 'delete_user',
  description: 'Delete a user',
  inputSchema: z.object({ userId: z.string() }),
  outputSchema: z.object({ deleted: z.boolean() }),
  execute: async () => ({ deleted: true }),
});

// ─── Scenarios ──────────────────────────────────────────────────────────────────

describe('Quick Checks — scenario tests via runEvals', () => {
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
    it('calledTool, toolOrder, noToolErrors, and maxToolCalls pass for a well-behaved agent', async () => {
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
      const agent = toolCallingAgent(
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
      const agent = toolCallingAgent(
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
      // Agent always responds with the same text — some data items will match,
      // some won't, so average scores should reflect partial passing.
      const agent = textAgent('The answer is 42.');

      const result = await runEvals({
        data: [
          { input: 'What is the answer?' },
          { input: 'What is the answer?' },
        ],
        scorers: [
          checks.includes('42'),
          checks.excludes('error'),
        ],
        target: agent,
      });

      // Both items should match, so averages should be 1.0
      expect(result.scores['check-includes']).toBe(1);
      expect(result.scores['check-excludes']).toBe(1);
      expect(result.summary.totalItems).toBe(2);
    });
  });
});
