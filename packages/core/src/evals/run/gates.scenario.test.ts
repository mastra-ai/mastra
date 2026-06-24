/**
 * Scenario tests for runEvals gates, thresholds, and verdict.
 *
 * These tests wire gates and threshold-bearing scorers through the full
 * runEvals pipeline with a real Agent backed by AIMock.
 * This validates end-to-end: AIMock scripted responses →
 * OpenAI v6 provider → Agent → runEvals → gates/thresholds → verdict.
 */
import { createOpenAI } from '@ai-sdk/openai-v6';
import { LLMock } from '@copilotkit/aimock';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../agent';
import { createTool } from '../../tools';
import { createScorer } from '../base';
import { runEvals } from '.';

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

function textAgent(response: string) {
  mock.on({ endpoint: 'chat' }, { content: response });

  const openai = createOpenAI({
    apiKey: 'aimock-test-key',
    baseURL: `${mock.url.replace(/\/+$/, '')}/v1`,
  });

  return new Agent({
    id: `gates-text-agent-${++agentCounter}`,
    name: 'Text Agent',
    instructions: 'Respond with the scripted text.',
    model: openai(MODEL_ID),
  });
}

function toolCallingAgent(
  tools: Record<string, ReturnType<typeof createTool>>,
  toolCalls: { name: string; id: string; input: Record<string, unknown> }[],
  finalText: string,
) {
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
  mock.on({ endpoint: 'chat', hasToolResult: true }, { content: finalText });

  const openai = createOpenAI({
    apiKey: 'aimock-test-key',
    baseURL: `${mock.url.replace(/\/+$/, '')}/v1`,
  });

  return new Agent({
    id: `gates-tool-agent-${++agentCounter}`,
    name: 'Tool Agent',
    instructions: 'Call tools and respond.',
    model: openai(MODEL_ID),
    tools,
  });
}

// ─── Scorer fixtures ────────────────────────────────────────────────────────────

/** A gate scorer that always returns 1.0 (pass). */
const passingGate = createScorer({
  id: 'always-pass-gate',
  description: 'Always passes',
  name: 'Always Pass',
}).generateScore(() => 1);

/** A gate scorer that always returns 0 (fail). */
const failingGate = createScorer({
  id: 'always-fail-gate',
  description: 'Always fails',
  name: 'Always Fail',
}).generateScore(() => 0);

/** A scorer that returns a fixed score (for threshold testing). */
function fixedScorer(id: string, score: number) {
  return createScorer({
    id,
    description: `Returns ${score}`,
    name: id,
  }).generateScore(() => score);
}

// ─── Tool fixtures ──────────────────────────────────────────────────────────────

const weatherTool = createTool({
  id: 'get_weather',
  description: 'Get weather for a city',
  inputSchema: z.object({ city: z.string() }),
  outputSchema: z.object({ temperature: z.number(), condition: z.string() }),
  execute: async () => ({ temperature: 72, condition: 'sunny' }),
});

// ─── Scenarios ──────────────────────────────────────────────────────────────────

describe('Gates & Verdict — scenario tests via runEvals + AIMock', () => {
  describe('verdict with gates only', () => {
    it('returns verdict: passed when all gates score 1.0', async () => {
      const agent = textAgent('Sunny and 72°F in Brooklyn.');

      const result = await runEvals({
        data: [{ input: 'What is the weather?' }],
        scorers: [fixedScorer('quality', 0.9)],
        gates: [passingGate],
        target: agent,
      });

      expect(result.verdict).toBe('passed');
      expect(result.gateResults).toHaveLength(1);
      expect(result.gateResults![0]!.passed).toBe(true);
      expect(result.gateResults![0]!.score).toBe(1);
    });

    it('returns verdict: failed when a gate scores below 1.0', async () => {
      const agent = textAgent('Some response.');

      const result = await runEvals({
        data: [{ input: 'Test' }],
        scorers: [fixedScorer('quality', 0.9)],
        gates: [failingGate],
        target: agent,
      });

      expect(result.verdict).toBe('failed');
      expect(result.gateResults).toHaveLength(1);
      expect(result.gateResults![0]!.passed).toBe(false);
      expect(result.gateResults![0]!.score).toBe(0);
    });

    it('returns verdict: failed when any one gate fails among multiple', async () => {
      const agent = textAgent('Some response.');

      const result = await runEvals({
        data: [{ input: 'Test' }],
        scorers: [fixedScorer('filler', 0.5)],
        gates: [passingGate, failingGate],
        target: agent,
      });

      expect(result.verdict).toBe('failed');
      expect(result.gateResults).toHaveLength(2);
      expect(result.gateResults![0]!.passed).toBe(true);
      expect(result.gateResults![1]!.passed).toBe(false);
    });
  });

  describe('verdict with thresholds only', () => {
    it('returns verdict: passed when scorer meets threshold', async () => {
      const agent = textAgent('Good response.');

      const result = await runEvals({
        data: [{ input: 'Test' }],
        scorers: [{ scorer: fixedScorer('quality', 0.85), threshold: 0.7 }],
        target: agent,
      });

      expect(result.verdict).toBe('passed');
      expect(result.thresholdResults).toHaveLength(1);
      expect(result.thresholdResults![0]!.passed).toBe(true);
      expect(result.thresholdResults![0]!.averageScore).toBe(0.85);
      expect(result.thresholdResults![0]!.threshold).toBe(0.7);
    });

    it('returns verdict: scored when scorer misses threshold', async () => {
      const agent = textAgent('Mediocre response.');

      const result = await runEvals({
        data: [{ input: 'Test' }],
        scorers: [{ scorer: fixedScorer('quality', 0.3), threshold: 0.7 }],
        target: agent,
      });

      expect(result.verdict).toBe('scored');
      expect(result.thresholdResults).toHaveLength(1);
      expect(result.thresholdResults![0]!.passed).toBe(false);
      expect(result.thresholdResults![0]!.averageScore).toBe(0.3);
    });
  });

  describe('verdict with gates + thresholds combined', () => {
    it('returns verdict: scored when gates pass but threshold fails', async () => {
      const agent = textAgent('Some response.');

      const result = await runEvals({
        data: [{ input: 'Test' }],
        scorers: [{ scorer: fixedScorer('quality', 0.3), threshold: 0.7 }],
        gates: [passingGate],
        target: agent,
      });

      expect(result.verdict).toBe('scored');
      expect(result.gateResults![0]!.passed).toBe(true);
      expect(result.thresholdResults![0]!.passed).toBe(false);
    });

    it('returns verdict: failed when gate fails even if threshold passes', async () => {
      const agent = textAgent('Some response.');

      const result = await runEvals({
        data: [{ input: 'Test' }],
        scorers: [{ scorer: fixedScorer('quality', 0.9), threshold: 0.7 }],
        gates: [failingGate],
        target: agent,
      });

      expect(result.verdict).toBe('failed');
      expect(result.gateResults![0]!.passed).toBe(false);
      expect(result.thresholdResults![0]!.passed).toBe(true);
    });

    it('returns verdict: passed when gates and thresholds all pass', async () => {
      const agent = textAgent('Great response.');

      const result = await runEvals({
        data: [{ input: 'Test' }],
        scorers: [{ scorer: fixedScorer('quality', 0.9), threshold: 0.7 }],
        gates: [passingGate],
        target: agent,
      });

      expect(result.verdict).toBe('passed');
      expect(result.gateResults![0]!.passed).toBe(true);
      expect(result.thresholdResults![0]!.passed).toBe(true);
    });
  });

  describe('backward compatibility', () => {
    it('omits verdict when no gates or thresholds provided', async () => {
      const agent = textAgent('Hello.');

      const result = await runEvals({
        data: [{ input: 'Greet me' }],
        scorers: [fixedScorer('quality', 0.8)],
        target: agent,
      });

      expect(result.verdict).toBeUndefined();
      expect(result.gateResults).toBeUndefined();
      expect(result.thresholdResults).toBeUndefined();
      expect(result.scores['quality']).toBeDefined();
    });

    it('works with mixed bare scorers and threshold scorers', async () => {
      const agent = textAgent('Mixed test.');

      const result = await runEvals({
        data: [{ input: 'Test' }],
        scorers: [fixedScorer('bare-scorer', 0.75), { scorer: fixedScorer('threshold-scorer', 0.9), threshold: 0.8 }],
        target: agent,
      });

      expect(result.verdict).toBe('passed');
      expect(result.scores['bare-scorer']).toBeDefined();
      expect(result.scores['threshold-scorer']).toBeDefined();
      expect(result.thresholdResults).toHaveLength(1);
      expect(result.thresholdResults![0]!.id).toBe('threshold-scorer');
    });
  });

  describe('gates with tool-calling agents', () => {
    it('gates a tool-calling agent with custom scorers', async () => {
      const agent = toolCallingAgent(
        { get_weather: weatherTool },
        [{ name: 'get_weather', id: 'call-1', input: { city: 'Brooklyn' } }],
        'It is sunny and 72°F in Brooklyn.',
      );

      const result = await runEvals({
        data: [{ input: 'What is the weather in Brooklyn?' }],
        scorers: [{ scorer: fixedScorer('quality', 0.9), threshold: 0.7 }],
        gates: [passingGate],
        target: agent,
      });

      expect(result.verdict).toBe('passed');
      expect(result.gateResults).toHaveLength(1);
      expect(result.gateResults![0]!.passed).toBe(true);
      expect(result.thresholdResults).toHaveLength(1);
      expect(result.thresholdResults![0]!.passed).toBe(true);
    });
  });

  describe('threshold: { min, max } range-based checks', () => {
    it('passes when score is below max threshold (hallucination use case)', async () => {
      const agent = textAgent('Low hallucination response.');

      const result = await runEvals({
        data: [{ input: 'Test' }],
        scorers: [{ scorer: fixedScorer('hallucination', 0.1), threshold: { max: 0.3 } }],
        target: agent,
      });

      expect(result.verdict).toBe('passed');
      expect(result.thresholdResults).toHaveLength(1);
      expect(result.thresholdResults![0]!.passed).toBe(true);
      expect(result.thresholdResults![0]!.averageScore).toBe(0.1);
      expect(result.thresholdResults![0]!.threshold).toEqual({ max: 0.3 });
    });

    it('fails when score exceeds max threshold', async () => {
      const agent = textAgent('High hallucination response.');

      const result = await runEvals({
        data: [{ input: 'Test' }],
        scorers: [{ scorer: fixedScorer('hallucination', 0.8), threshold: { max: 0.3 } }],
        target: agent,
      });

      expect(result.verdict).toBe('scored');
      expect(result.thresholdResults![0]!.passed).toBe(false);
      expect(result.thresholdResults![0]!.averageScore).toBe(0.8);
    });

    it('passes when score is within { min, max } range', async () => {
      const agent = textAgent('Balanced response.');

      const result = await runEvals({
        data: [{ input: 'Test' }],
        scorers: [{ scorer: fixedScorer('balanced-metric', 0.5), threshold: { min: 0.3, max: 0.7 } }],
        target: agent,
      });

      expect(result.verdict).toBe('passed');
      expect(result.thresholdResults![0]!.passed).toBe(true);
    });

    it('fails when score is above { min, max } range', async () => {
      const agent = textAgent('Too high.');

      const result = await runEvals({
        data: [{ input: 'Test' }],
        scorers: [{ scorer: fixedScorer('bounded-metric', 0.9), threshold: { min: 0.3, max: 0.7 } }],
        target: agent,
      });

      expect(result.verdict).toBe('scored');
      expect(result.thresholdResults![0]!.passed).toBe(false);
    });

    it('fails when score is below { min, max } range', async () => {
      const agent = textAgent('Too low.');

      const result = await runEvals({
        data: [{ input: 'Test' }],
        scorers: [{ scorer: fixedScorer('bounded-metric', 0.1), threshold: { min: 0.3, max: 0.7 } }],
        target: agent,
      });

      expect(result.verdict).toBe('scored');
      expect(result.thresholdResults![0]!.passed).toBe(false);
    });

    it('works with gates + max threshold combined', async () => {
      const agent = textAgent('Good response with low hallucination.');

      const result = await runEvals({
        data: [{ input: 'Test' }],
        scorers: [{ scorer: fixedScorer('hallucination', 0.15), threshold: { max: 0.3 } }],
        gates: [passingGate],
        target: agent,
      });

      expect(result.verdict).toBe('passed');
      expect(result.gateResults![0]!.passed).toBe(true);
      expect(result.thresholdResults![0]!.passed).toBe(true);
    });
  });

  describe('multi-item dataset verdict', () => {
    it('averages gate scores across items for verdict', async () => {
      const agent = textAgent('Consistent response.');

      const result = await runEvals({
        data: [{ input: 'Test 1' }, { input: 'Test 2' }, { input: 'Test 3' }],
        scorers: [fixedScorer('quality', 0.8)],
        gates: [passingGate],
        target: agent,
      });

      expect(result.verdict).toBe('passed');
      expect(result.summary.totalItems).toBe(3);
      expect(result.gateResults![0]!.score).toBe(1);
    });
  });
});
