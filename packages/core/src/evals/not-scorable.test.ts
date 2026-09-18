import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { SpanType } from '../observability';
import { createScorer } from './base';
import { isNotScorable, notScorable } from './not-scorable';
import type { NotScorableOutcome } from './not-scorable';

const scoringInput = {
  input: [{ role: 'user', content: 'hello' }],
  output: { role: 'assistant', text: 'hi' },
};

function createJudgeModel(response: string) {
  const doStream = vi.fn(async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    warnings: [],
    stream: convertArrayToReadableStream([
      { type: 'stream-start' as const, warnings: [] },
      { type: 'response-metadata' as const, id: 'judge', modelId: 'judge-model', timestamp: new Date(0) },
      { type: 'text-start' as const, id: 'text-1' },
      { type: 'text-delta' as const, id: 'text-1', delta: response },
      { type: 'text-end' as const, id: 'text-1' },
      {
        type: 'finish' as const,
        finishReason: 'stop' as const,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      },
    ]),
  }));

  const model = new MockLanguageModelV2({
    doGenerate: async () => {
      throw new Error('Unexpected non-streaming judge call');
    },
    doStream,
  });

  return { model, doStream };
}

function createMockSpan(traceId: string, type: SpanType) {
  const span: any = {
    id: `${type}-${Math.random().toString(36).slice(2)}`,
    traceId,
    type,
    isValid: true,
    isInternal: false,
    parent: undefined,
    end: vi.fn(),
    update: vi.fn(),
    error: vi.fn(),
    executeInContext: async (fn: () => Promise<unknown>) => fn(),
    findParent: vi.fn((targetType: SpanType) => {
      let current = span.parent;
      while (current) {
        if (current.type === targetType) return current;
        current = current.parent;
      }
      return undefined;
    }),
  };
  span.createChildSpan = vi.fn((options: { type: SpanType }) => {
    const child = createMockSpan(traceId, options.type);
    child.parent = span;
    return child;
  });
  return span;
}

function createMockMastra(startSpan?: () => unknown) {
  return {
    observability: {
      addScore: vi.fn().mockResolvedValue(undefined),
      getSelectedInstance: vi
        .fn()
        .mockReturnValue(startSpan ? { startSpan: vi.fn().mockImplementation(startSpan) } : undefined),
    },
    getLogger: vi.fn().mockReturnValue({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trackException: vi.fn() }),
  };
}

describe('notScorable()', () => {
  it('creates a value recognised by isNotScorable', () => {
    expect(isNotScorable(notScorable())).toBe(true);
    expect(isNotScorable(notScorable('no refund tool call'))).toBe(true);
    expect(notScorable('no refund tool call').reason).toBe('no refund tool call');
    expect(notScorable()).not.toHaveProperty('reason');
  });

  it('does not match plain objects, nulls, or a user object that happens to have a reason', () => {
    expect(isNotScorable({ reason: 'looks similar' })).toBe(false);
    expect(isNotScorable(null)).toBe(false);
    expect(isNotScorable(undefined)).toBe(false);
    expect(isNotScorable('not_scorable')).toBe(false);
  });

  it('is recognised across duplicate module copies via Symbol.for', () => {
    const foreign = { [Symbol.for('mastra.evals.notScorable')]: true, reason: 'from another copy' };
    expect(isNotScorable(foreign)).toBe(true);
  });
});

describe('scorer pipeline with notScorable()', () => {
  it('stops after preprocess, skips the judge, and returns no score', async () => {
    const { model, doStream } = createJudgeModel(JSON.stringify({ verdict: 'good' }));
    const analyze = vi.fn();
    const generateScore = vi.fn(() => 1);

    const scorer = createScorer({
      id: 'refund-judge',
      description: 'Judges refund handling',
      judge: { model, instructions: 'You judge refund handling.' },
    })
      .preprocess(({ run }) => {
        const text = (run.output as { text: string }).text;
        return text.includes('refund') ? { relevant: true } : notScorable('refundCustomer was not called');
      })
      .analyze({
        description: 'Assess the refund',
        outputSchema: z.object({ verdict: z.enum(['good', 'bad']) }),
        createPrompt: ctx => {
          analyze(ctx);
          return 'Was the refund handled well?';
        },
      })
      .generateScore(generateScore);

    const result = await scorer.run(scoringInput);

    expect(result.notScorable).toEqual({ step: 'preprocess', reason: 'refundCustomer was not called' });
    expect(result).not.toHaveProperty('score');
    expect(result.preprocessStepResult).toBeUndefined();
    expect(result.analyzeStepResult).toBeUndefined();
    expect(doStream).not.toHaveBeenCalled();
    expect(analyze).not.toHaveBeenCalled();
    expect(generateScore).not.toHaveBeenCalled();
    expect(result.runId).toEqual(expect.any(String));
  });

  it('runs the full pipeline when preprocess returns a regular value', async () => {
    const { model, doStream } = createJudgeModel(JSON.stringify({ verdict: 'good' }));

    const scorer = createScorer({
      id: 'refund-judge',
      description: 'Judges refund handling',
      judge: { model, instructions: 'You judge refund handling.' },
    })
      .preprocess(({ run }) => {
        const text = (run.output as { text: string }).text;
        return text.includes('refund') ? { relevant: true } : notScorable('refundCustomer was not called');
      })
      .analyze({
        description: 'Assess the refund',
        outputSchema: z.object({ verdict: z.enum(['good', 'bad']) }),
        createPrompt: () => 'Was the refund handled well?',
      })
      .generateScore(({ results }) => (results.analyzeStepResult.verdict === 'good' ? 1 : 0));

    const result = await scorer.run({ ...scoringInput, output: { role: 'assistant', text: 'refund issued' } });

    expect(result.notScorable).toBeUndefined();
    expect(result.score).toBe(1);
    expect(result.preprocessStepResult).toEqual({ relevant: true });
    expect(result.analyzeStepResult).toEqual({ verdict: 'good' });
    expect(doStream).toHaveBeenCalledTimes(1);
  });

  it('keeps results from steps that completed before generateScore returned notScorable()', async () => {
    const generateReason = vi.fn(() => 'unused');
    const scorer = createScorer({ id: 'late-bail', description: 'Bails in generateScore' })
      .preprocess(() => ({ tokens: 3 }))
      .analyze(() => ({ ok: false }))
      .generateScore(({ results }) => (results.analyzeStepResult.ok ? 1 : notScorable('nothing to score')))
      .generateReason(generateReason);

    const result = await scorer.run(scoringInput);

    expect(result.notScorable).toEqual({ step: 'generateScore', reason: 'nothing to score' });
    expect(result).not.toHaveProperty('score');
    expect(result.preprocessStepResult).toEqual({ tokens: 3 });
    expect(result.analyzeStepResult).toEqual({ ok: false });
    expect(result.reason).toBeUndefined();
    expect(generateReason).not.toHaveBeenCalled();
  });

  it('omits the reason when none is given', async () => {
    const scorer = createScorer({ id: 'no-reason', description: 'Bails without a reason' })
      .preprocess(() => notScorable())
      .generateScore(() => 1);

    const result = await scorer.run(scoringInput);

    expect(result.notScorable).toEqual({ step: 'preprocess' });
  });

  it('supports async steps returning notScorable()', async () => {
    const scorer = createScorer({ id: 'async-bail', description: 'Async preprocess' })
      .preprocess(async () => notScorable('async skip'))
      .generateScore(() => 1);

    const result = await scorer.run(scoringInput);

    expect(result.notScorable).toEqual({ step: 'preprocess', reason: 'async skip' });
  });

  it('does not emit a score to observability and records the outcome on the scorer-run span', async () => {
    const runSpan = createMockSpan('trace-1', SpanType.SCORER_RUN);
    const mastra = createMockMastra(() => runSpan);

    const scorer = createScorer({ id: 'traced-bail', description: 'Traced not-scorable run' })
      .preprocess(() => notScorable('nothing to judge'))
      .generateScore(() => 1);
    scorer.__registerMastra(mastra as any);

    const result = await scorer.run({ ...scoringInput, scoreSource: 'live', targetTraceId: 'target-trace' });

    expect(result.notScorable).toEqual({ step: 'preprocess', reason: 'nothing to judge' });
    expect(mastra.observability.addScore).not.toHaveBeenCalled();
    expect(runSpan.end).toHaveBeenCalledWith({
      output: {
        success: true,
        score: null,
        reason: null,
        notScorable: { step: 'preprocess', reason: 'nothing to judge' },
      },
    });

    const stepSpan = runSpan.createChildSpan.mock.results
      .map((call: { value: any }) => call.value)
      .find((span: any) => span.type === SpanType.SCORER_STEP);
    expect(stepSpan.end).toHaveBeenCalledWith({
      output: { notScorable: { step: 'preprocess', reason: 'nothing to judge' } },
    });
  });

  it('leaves scorers that never return notScorable() unchanged', async () => {
    const scorer = createScorer({ id: 'plain', description: 'Plain scorer' })
      .preprocess(() => ({ length: 2 }))
      .generateScore(({ results }) => results.preprocessStepResult.length / 4)
      .generateReason(({ score }) => `score ${score}`);

    const result = await scorer.run(scoringInput);

    expect(result).not.toHaveProperty('notScorable');
    expect(result.score).toBe(0.5);
    expect(result.reason).toBe('score 0.5');
    expectTypeOf(result.score).toEqualTypeOf<number>();
    expectTypeOf(result.notScorable).toEqualTypeOf<undefined>();
  });

  it('narrows the result type on notScorable and excludes the sentinel from later step results', async () => {
    const scorer = createScorer({ id: 'typed', description: 'Typed scorer' })
      .preprocess(({ run }) => ((run.output as { text: string }).text ? { ok: true } : notScorable()))
      .generateScore(({ results }) => {
        expectTypeOf(results.preprocessStepResult).toEqualTypeOf<{ ok: boolean }>();
        return 1;
      });

    const result = await scorer.run(scoringInput);

    if (result.notScorable) {
      expectTypeOf(result.notScorable).toEqualTypeOf<NotScorableOutcome>();
      expectTypeOf(result.score).toEqualTypeOf<undefined>();
    } else {
      expectTypeOf(result.score).toEqualTypeOf<number>();
    }
  });
});
