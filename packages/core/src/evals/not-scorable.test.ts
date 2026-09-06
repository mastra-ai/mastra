import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod/v4';
import { createScorer } from './base';
import { notScorable, isNotScorable } from './not-scorable';

const runInput = {
  input: [{ role: 'user', content: 'please help' }],
  output: { role: 'assistant', text: 'done' },
};

describe('notScorable', () => {
  it('creates a marker that isNotScorable recognizes', () => {
    expect(isNotScorable(notScorable())).toBe(true);
    expect(isNotScorable(notScorable('no refund call'))).toBe(true);
    expect(isNotScorable({ reason: 'no refund call' })).toBe(false);
    expect(isNotScorable(undefined)).toBe(false);
    expect(isNotScorable(0.5)).toBe(false);
  });

  it('skips all remaining steps when preprocess returns notScorable', async () => {
    const analyze = vi.fn(() => ({ verdict: 'irrelevant' }));
    const generateScore = vi.fn(() => 1);
    const generateReason = vi.fn(() => 'why');

    const scorer = createScorer({
      id: 'refund-judge',
      description: 'judges refund handling',
    })
      .preprocess(() => notScorable('refundCustomer was not called'))
      .analyze(analyze)
      .generateScore(generateScore)
      .generateReason(generateReason);

    const result = await scorer.run(runInput);

    expect(analyze).not.toHaveBeenCalled();
    expect(generateScore).not.toHaveBeenCalled();
    expect(generateReason).not.toHaveBeenCalled();
    expect(result.notScorable).toEqual({ reason: 'refundCustomer was not called' });
    expect(result.score).toBeUndefined();
    expect(result.preprocessStepResult).toBeUndefined();
    expect(result.runId).toBeDefined();
  });

  it('runs the full pipeline when preprocess returns a normal value', async () => {
    const scorer = createScorer({
      id: 'refund-judge',
      description: 'judges refund handling',
    })
      .preprocess(() => ({ calls: 1 }))
      .analyze(({ results }) => ({ calls: results.preprocessStepResult.calls }))
      .generateScore(({ results }) => (results.analyzeStepResult.calls > 0 ? 1 : 0));

    const result = await scorer.run(runInput);

    expect(result.notScorable).toBeUndefined();
    expect(result.score).toBe(1);
    expect(result.preprocessStepResult).toEqual({ calls: 1 });
  });

  it('supports notScorable from analyze and keeps earlier step results', async () => {
    const generateScore = vi.fn(() => 1);

    const scorer = createScorer({
      id: 'refund-judge',
      description: 'judges refund handling',
    })
      .preprocess(() => ({ calls: 0 }))
      .analyze(({ results }) => (results.preprocessStepResult.calls === 0 ? notScorable() : { ok: true }))
      .generateScore(generateScore);

    const result = await scorer.run(runInput);

    expect(generateScore).not.toHaveBeenCalled();
    expect(result.notScorable).toEqual({});
    expect(result.preprocessStepResult).toEqual({ calls: 0 });
    expect(result.analyzeStepResult).toBeUndefined();
  });

  it('never invokes the judge model when preprocess declares the run not scorable', async () => {
    const doStream = vi.fn(async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: '{"verdict":"good"}' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }));
    const judgeModel = new MockLanguageModelV2({ doStream });

    const scorer = createScorer({
      id: 'refund-judge',
      description: 'judges refund handling',
      judge: { model: judgeModel, instructions: 'Judge the refund.' },
    })
      .preprocess(() => notScorable('nothing to judge'))
      .analyze({
        description: 'judge the refund handling',
        outputSchema: z.object({ verdict: z.string() }),
        createPrompt: () => 'Was the refund handled well?',
      })
      .generateScore(({ results }) => (results.analyzeStepResult.verdict === 'good' ? 1 : 0));

    const result = await scorer.run(runInput);

    expect(doStream).not.toHaveBeenCalled();
    expect(result.notScorable).toEqual({ reason: 'nothing to judge' });
    expect(result.score).toBeUndefined();
  });
});
