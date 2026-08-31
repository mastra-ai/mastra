import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { createScorer } from '@mastra/core/evals';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { EvalFailedError, evalTest, runEvalCase } from './eval-test';

function createMockAgent(response = 'The capital of France is Paris.') {
  const model = new MockLanguageModelV2({
    doGenerate: async () => ({
      content: [{ type: 'text', text: response }],
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
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

  return new Agent({ id: 'mockAgent', name: 'mockAgent', instructions: 'Mock agent', model });
}

const fixedScorer = (id: string, score: number) =>
  createScorer({ id, name: id, description: 'Fixed score' }).generateScore(() => score);

describe('runEvalCase', () => {
  it('returns the result and a serializable meta projection', async () => {
    const { result, meta } = await runEvalCase({
      target: createMockAgent(),
      data: [{ input: 'What is the capital of France?' }],
      scorers: [fixedScorer('quality', 0.9)],
    });

    expect(result.scores.quality).toBe(0.9);
    expect(meta).toEqual({ scores: { quality: 0.9 }, totalItems: 1 });
  });

  it('reports a passed verdict when gates pass', async () => {
    const { result, meta } = await runEvalCase({
      target: createMockAgent(),
      data: [{ input: 'What is the capital of France?' }],
      gates: [fixedScorer('safety', 1)],
    });

    expect(result.verdict).toBe('passed');
    expect(meta.verdict).toBe('passed');
    expect(meta.gateResults).toEqual([{ id: 'safety', passed: true, score: 1 }]);
  });

  it('throws EvalFailedError with a readable message when a gate fails', async () => {
    const promise = runEvalCase({
      target: createMockAgent(),
      data: [{ input: 'What is the capital of France?' }],
      gates: [fixedScorer('safety', 0)],
    });

    await expect(promise).rejects.toThrowError(EvalFailedError);
    await expect(promise).rejects.toThrowError(/Failed gates:[\s\S]*✗ safety \(score: 0\)/);
  });

  it('reports a scored verdict (not a failure) when a scorer threshold fails', async () => {
    const { result, meta } = await runEvalCase({
      target: createMockAgent(),
      data: [{ input: 'What is the capital of France?' }],
      scorers: [{ scorer: fixedScorer('quality', 0.3), threshold: 0.5 }],
    });

    expect(result.verdict).toBe('scored');
    expect(meta.thresholdResults).toEqual([{ id: 'quality', passed: false, averageScore: 0.3, threshold: 0.5 }]);
  });
});

describe('evalTest', () => {
  const metas: unknown[] = [];

  evalTest('populates task.meta.mastraEval', {
    target: createMockAgent(),
    data: [{ input: 'What is the capital of France?' }],
    scorers: [fixedScorer('quality', 0.9)],
    gates: [fixedScorer('safety', 1)],
  });

  it('exposes skip and only variants', () => {
    expect(typeof evalTest.skip).toBe('function');
    expect(typeof evalTest.only).toBe('function');
  });

  evalTest.skip('skipped evals are not executed', {
    target: createMockAgent(),
    data: [{ input: 'unused' }],
    gates: [fixedScorer('always-fails', 0)],
  });

  afterEach(({ task }) => {
    if (task.name === 'populates task.meta.mastraEval') {
      metas.push(task.meta.mastraEval);
      expect(task.meta.mastraEval).toMatchObject({
        scores: { quality: 0.9 },
        totalItems: 1,
        verdict: 'passed',
      });
    }
  });

  afterAll(() => {
    expect(metas).toHaveLength(1);
  });
});
