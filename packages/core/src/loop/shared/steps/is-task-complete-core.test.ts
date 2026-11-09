import { describe, expect, it, vi } from 'vitest';

import { MessageList } from '../../../agent/message-list';
import { evaluateTaskCompletion } from './is-task-complete-core';

/**
 * Pins the per-engine `errorPolicy` split: `'fatal'` is the
 * default in-process engine's released contract (a rejecting scorer run,
 * throwing onComplete callback, or throwing chunk enqueue fails the run),
 * `'best-effort'` is the durable/evented engines' redelivery-safe contract
 * (log and skip / keep the verdict). The errored-iteration skip
 * (#21897) is gated on `engineMode: 'durable'` — it shipped on the durable
 * engine pre-extraction, while the default engine's released contract still
 * grades errored iterations (extending the skip to the default engine is a
 * separate product decision).
 *
 * No module mocking: the real `runStreamCompletionScorers` catches
 * individual scorer throws by design (they surface as errored scorer
 * results, not rejections), so the scorer-failure catch is exercised by making the
 * scorer-run machinery itself reject — a scorers array whose `map` throws.
 * The policy contract under test is "a rejection from the scoring call
 * follows errorPolicy", regardless of how the rejection arises.
 */

/** A real scorer that passes, settling the verdict at complete: true. */
const passingScorer = () => ({
  id: 'pass',
  name: 'pass',
  run: vi.fn(async () => ({ score: 1 })),
});

/** Forces `runStreamCompletionScorers` itself to reject. */
const rejectingScorers = () =>
  ({
    length: 1,
    map: () => {
      throw new Error('scorer boom');
    },
  }) as any;

function makeDeps(
  overrides: Partial<Parameters<typeof evaluateTaskCompletion>[0]> = {},
): Parameters<typeof evaluateTaskCompletion>[0] {
  return {
    policy: { scorers: [passingScorer() as any] },
    errorPolicy: 'fatal' as const,
    engineMode: 'default' as const,
    iteration: 1,
    maxIterations: undefined,
    llmSignaledDone: true,
    stepReason: 'stop',
    backgroundTaskPending: false,
    toolCalls: [],
    toolResults: [],
    currentText: 'done',
    messageList: () => new MessageList(),
    runId: 'run-1',
    emitChunk: vi.fn(),
    logger: { warn: vi.fn() } as any,
    ...overrides,
  };
}

describe('evaluateTaskCompletion — scorer failure policy', () => {
  it('fatal (default engine): a rejecting scorer run rejects the evaluation', async () => {
    const deps = makeDeps({ errorPolicy: 'fatal', policy: { scorers: rejectingScorers() } });
    await expect(evaluateTaskCompletion(deps)).rejects.toThrow('scorer boom');
  });

  it('best-effort (durable): a rejecting scorer run resolves { evaluated: false } and warns', async () => {
    const logger = { warn: vi.fn() } as any;
    const deps = makeDeps({ errorPolicy: 'best-effort', logger, policy: { scorers: rejectingScorers() } });
    const outcome = await evaluateTaskCompletion(deps);
    expect(outcome).toEqual({ evaluated: false });
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});

describe('evaluateTaskCompletion — onComplete failure policy', () => {
  it('fatal (default engine): a throwing onComplete callback rejects', async () => {
    const deps = makeDeps({
      errorPolicy: 'fatal',
      policy: {
        scorers: [passingScorer() as any],
        onComplete: async () => {
          throw new Error('onComplete boom');
        },
      },
    });
    await expect(evaluateTaskCompletion(deps)).rejects.toThrow('onComplete boom');
  });

  it('best-effort (durable): a throwing onComplete keeps the verdict and warns', async () => {
    const logger = { warn: vi.fn() } as any;
    const deps = makeDeps({
      errorPolicy: 'best-effort',
      logger,
      policy: {
        scorers: [passingScorer() as any],
        onComplete: async () => {
          throw new Error('onComplete boom');
        },
      },
    });
    const outcome = await evaluateTaskCompletion(deps);
    expect(outcome).toEqual({ evaluated: true, complete: true });
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});

describe('evaluateTaskCompletion — chunk-emission failure policy', () => {
  it('fatal (default engine): a throwing emitChunk rejects — the stream is broken', async () => {
    const deps = makeDeps({
      errorPolicy: 'fatal',
      emitChunk: () => {
        throw new Error('emit boom');
      },
    });
    await expect(evaluateTaskCompletion(deps)).rejects.toThrow('emit boom');
  });

  it('best-effort (durable): a throwing emitChunk keeps the settled verdict', async () => {
    const deps = makeDeps({
      errorPolicy: 'best-effort',
      emitChunk: () => {
        throw new Error('emit boom');
      },
    });
    const outcome = await evaluateTaskCompletion(deps);
    expect(outcome).toEqual({ evaluated: true, complete: true });
  });
});

describe('evaluateTaskCompletion — errored-iteration grading (per-engine split, #21897)', () => {
  it('durable: stepReason=error skips grading entirely — redelivery must not re-issue a failing request', async () => {
    const scorer = passingScorer();
    const outcome = await evaluateTaskCompletion(
      makeDeps({
        engineMode: 'durable',
        errorPolicy: 'best-effort',
        stepReason: 'error',
        policy: { scorers: [scorer as any] },
      }),
    );
    expect(outcome).toEqual({ evaluated: false });
    expect(scorer.run).not.toHaveBeenCalled();
  });

  it('default: stepReason=error still grades — the released in-process contract invokes scorers on errored iterations', async () => {
    const scorer = passingScorer();
    const outcome = await evaluateTaskCompletion(
      makeDeps({
        engineMode: 'default',
        errorPolicy: 'fatal',
        stepReason: 'error',
        policy: { scorers: [scorer as any] },
      }),
    );
    // Scorer invocation counts are observable API on the released default
    // contract (#21897's skip shipped on durable only).
    expect(scorer.run).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({ evaluated: true, complete: true });
  });
});
