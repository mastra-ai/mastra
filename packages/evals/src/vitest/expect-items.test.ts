import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { createScorer } from '@mastra/core/evals';
import { afterEach, describe, expect, it, test } from 'vitest';

import { EvalPassRateError, expectItem, expectItems } from './expect-items';

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

/** Passes (1) only when the run's groundTruth is "pass". */
const groundTruthGate = createScorer({
  id: 'ground-truth-gate',
  name: 'ground-truth-gate',
  description: 'Passes when groundTruth is "pass"',
}).generateScore(({ run }) => (run.groundTruth === 'pass' ? 1 : 0));

describe('expectItems', () => {
  it('resolves with the RunEvalsResult when all gates pass', async () => {
    const result = await expectItems({
      target: createMockAgent(),
      data: [{ input: 'q1', groundTruth: 'pass' }],
      gates: [groundTruthGate],
      scorers: [fixedScorer('quality', 0.9)],
    }).toPass();

    expect(result.verdict).toBe('passed');
    expect(result.scores.quality).toBe(0.9);
  });

  it('passes when the gate pass rate meets minPassRate', async () => {
    const result = await expectItems({
      target: createMockAgent(),
      data: [
        { input: 'q1', groundTruth: 'pass' },
        { input: 'q2', groundTruth: 'pass' },
        { input: 'q3', groundTruth: 'fail' },
      ],
      gates: [groundTruthGate],
    }).toPass(0.5);

    const gate = result.gateResults?.find(g => g.id === 'ground-truth-gate');
    expect(gate?.score).toBeCloseTo(2 / 3);
  });

  it('rejects when the gate pass rate is below minPassRate', async () => {
    const promise = expectItems({
      target: createMockAgent(),
      data: [
        { input: 'q1', groundTruth: 'pass' },
        { input: 'q2', groundTruth: 'pass' },
        { input: 'q3', groundTruth: 'fail' },
      ],
      gates: [groundTruthGate],
    }).toPass(0.8);

    await expect(promise).rejects.toThrowError(EvalPassRateError);
    await expect(promise).rejects.toThrowError(/gate ground-truth-gate: pass rate 66\.7% < required 80%/);
  });

  it('rejects when a scorer threshold fails, regardless of minPassRate', async () => {
    const promise = expectItems({
      target: createMockAgent(),
      data: [{ input: 'q1' }],
      scorers: [{ scorer: fixedScorer('quality', 0.3), threshold: 0.5 }],
    }).toPass(0);

    await expect(promise).rejects.toThrowError(/threshold quality: average score 0\.3/);
  });

  it('rejects out-of-range minPassRate', async () => {
    await expect(
      expectItems({
        target: createMockAgent(),
        data: [{ input: 'q1' }],
        gates: [fixedScorer('g', 1)],
      }).toPass(1.5),
    ).rejects.toThrowError(/must be within \[0, 1\]/);
  });

  test('attaches meta to the current test for the reporter', async ({ task }) => {
    await expectItems({
      target: createMockAgent(),
      data: [{ input: 'q1', groundTruth: 'pass' }],
      gates: [groundTruthGate],
    }).toPass();

    expect(task.meta.mastraEval).toMatchObject({
      verdict: 'passed',
      totalItems: 1,
      gateResults: [{ id: 'ground-truth-gate', passed: true, score: 1 }],
    });
  });

  afterEach(({ task }) => {
    if (task.name === 'attaches meta to the current test for the reporter') {
      expect(task.meta.mastraEval).toBeDefined();
    }
  });
});

describe('expectItem', () => {
  it('runs a single data item and resolves when it passes', async () => {
    const result = await expectItem({
      target: createMockAgent(),
      data: { input: 'q1', groundTruth: 'pass' },
      gates: [groundTruthGate],
      scorers: [fixedScorer('quality', 0.9)],
    }).toPass();

    expect(result.verdict).toBe('passed');
    expect(result.summary.totalItems).toBe(1);
  });

  it('rejects when the item fails a gate', async () => {
    const promise = expectItem({
      target: createMockAgent(),
      data: { input: 'q1', groundTruth: 'fail' },
      gates: [groundTruthGate],
    }).toPass();

    await expect(promise).rejects.toThrowError(EvalPassRateError);
    await expect(promise).rejects.toThrowError(/gate ground-truth-gate: pass rate 0%/);
  });

  describe('matrix testing with test.for', () => {
    test.for([
      { input: 'q1', groundTruth: 'pass' },
      { input: 'q2', groundTruth: 'pass' },
    ])('item $input passes and gets its own reporter entry', async (item, { task }) => {
      await expectItem({
        target: createMockAgent(),
        data: item,
        gates: [groundTruthGate],
      }).toPass();

      expect(task.meta.mastraEval).toMatchObject({ verdict: 'passed', totalItems: 1 });
    });
  });
});
