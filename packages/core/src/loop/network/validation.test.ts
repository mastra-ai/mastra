import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { CompletionContext, CompletionRunResult } from './validation';
import { runCompletionScorers, formatCompletionFeedback } from './validation';

// Helper to create a mock scorer
function createMockScorer(id: string, score: number, reason?: string, delay = 0) {
  return {
    id,
    name: `${id} Scorer`,
    run: vi.fn().mockImplementation(async () => {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      return { score, reason };
    }),
  };
}

// Helper to create a mock context
function createMockContext(overrides: Partial<CompletionContext> = {}): CompletionContext {
  return {
    iteration: 1,
    maxIterations: 10,
    messages: [],
    originalTask: 'Test task',
    selectedPrimitive: { id: 'test-agent', type: 'agent' },
    primitivePrompt: 'Do something',
    primitiveResult: 'Done',
    networkName: 'test-network',
    runId: 'test-run-id',
    ...overrides,
  };
}

describe('runCompletionScorers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('strategy: all (default)', () => {
    it('returns complete when all scorers pass', async () => {
      const scorer1 = createMockScorer('scorer-1', 1, 'Passed');
      const scorer2 = createMockScorer('scorer-2', 1, 'Passed');
      const context = createMockContext();

      const result = await runCompletionScorers([scorer1, scorer2], context);

      expect(result.complete).toBe(true);
      expect(result.scorers).toHaveLength(2);
      expect(result.scorers.every(s => s.passed)).toBe(true);
      expect(scorer1.run).toHaveBeenCalledTimes(1);
      expect(scorer2.run).toHaveBeenCalledTimes(1);
    });

    it('returns incomplete when any scorer fails', async () => {
      const scorer1 = createMockScorer('scorer-1', 1, 'Passed');
      const scorer2 = createMockScorer('scorer-2', 0, 'Failed');
      const context = createMockContext();

      const result = await runCompletionScorers([scorer1, scorer2], context);

      expect(result.complete).toBe(false);
      expect(result.scorers.some(s => !s.passed)).toBe(true);
    });

    it('returns incomplete when all scorers fail', async () => {
      const scorer1 = createMockScorer('scorer-1', 0, 'Failed');
      const scorer2 = createMockScorer('scorer-2', 0, 'Failed');
      const context = createMockContext();

      const result = await runCompletionScorers([scorer1, scorer2], context);

      expect(result.complete).toBe(false);
      expect(result.scorers.every(s => !s.passed)).toBe(true);
    });
  });

  describe('strategy: any', () => {
    it('returns complete when at least one scorer passes', async () => {
      const scorer1 = createMockScorer('scorer-1', 0, 'Failed');
      const scorer2 = createMockScorer('scorer-2', 1, 'Passed');
      const context = createMockContext();

      const result = await runCompletionScorers([scorer1, scorer2], context, { strategy: 'any' });

      expect(result.complete).toBe(true);
    });

    it('returns incomplete when all scorers fail', async () => {
      const scorer1 = createMockScorer('scorer-1', 0, 'Failed');
      const scorer2 = createMockScorer('scorer-2', 0, 'Failed');
      const context = createMockContext();

      const result = await runCompletionScorers([scorer1, scorer2], context, { strategy: 'any' });

      expect(result.complete).toBe(false);
    });
  });

  describe('error handling', () => {
    it('handles scorer that throws an error', async () => {
      const errorScorer = {
        id: 'error-scorer',
        name: 'Error Scorer',
        run: vi.fn().mockRejectedValue(new Error('Scorer crashed')),
      };
      const context = createMockContext();

      const result = await runCompletionScorers([errorScorer], context);

      expect(result.complete).toBe(false);
      expect(result.scorers[0].passed).toBe(false);
      expect(result.scorers[0].reason).toContain('Scorer threw an error');
      expect(result.scorers[0].reason).toContain('Scorer crashed');
    });
  });

  describe('sequential execution', () => {
    it('runs scorers sequentially when parallel: false', async () => {
      const executionOrder: string[] = [];
      const scorer1 = {
        id: 'scorer-1',
        name: 'Scorer 1',
        run: vi.fn().mockImplementation(async () => {
          executionOrder.push('scorer-1-start');
          await new Promise(resolve => setTimeout(resolve, 10));
          executionOrder.push('scorer-1-end');
          return { score: 1 };
        }),
      };
      const scorer2 = {
        id: 'scorer-2',
        name: 'Scorer 2',
        run: vi.fn().mockImplementation(async () => {
          executionOrder.push('scorer-2-start');
          await new Promise(resolve => setTimeout(resolve, 10));
          executionOrder.push('scorer-2-end');
          return { score: 1 };
        }),
      };
      const context = createMockContext();

      await runCompletionScorers([scorer1, scorer2], context, { parallel: false });

      // Sequential: scorer-1 should complete before scorer-2 starts
      expect(executionOrder).toEqual(['scorer-1-start', 'scorer-1-end', 'scorer-2-start', 'scorer-2-end']);
    });

    it('short-circuits on failure with all strategy', async () => {
      const scorer1 = createMockScorer('scorer-1', 0, 'Failed');
      const scorer2 = createMockScorer('scorer-2', 1, 'Passed');
      const context = createMockContext();

      const result = await runCompletionScorers([scorer1, scorer2], context, {
        parallel: false,
        strategy: 'all',
      });

      expect(result.complete).toBe(false);
      expect(scorer1.run).toHaveBeenCalledTimes(1);
      // scorer2 should not be called due to short-circuit
      expect(scorer2.run).not.toHaveBeenCalled();
    });

    it('short-circuits on success with any strategy', async () => {
      const scorer1 = createMockScorer('scorer-1', 1, 'Passed');
      const scorer2 = createMockScorer('scorer-2', 0, 'Failed');
      const context = createMockContext();

      const result = await runCompletionScorers([scorer1, scorer2], context, {
        parallel: false,
        strategy: 'any',
      });

      expect(result.complete).toBe(true);
      expect(scorer1.run).toHaveBeenCalledTimes(1);
      // scorer2 should not be called due to short-circuit
      expect(scorer2.run).not.toHaveBeenCalled();
    });
  });

  describe('context passing', () => {
    it('passes context to scorers correctly', async () => {
      const scorer = createMockScorer('scorer-1', 1);
      const context = createMockContext({
        originalTask: 'Custom task',
        primitiveResult: 'Custom result',
        runId: 'custom-run-id',
      });

      await runCompletionScorers([scorer], context);

      expect(scorer.run).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'custom-run-id',
          input: expect.objectContaining({
            originalTask: 'Custom task',
            primitiveResult: 'Custom result',
          }),
          output: 'Custom result',
        }),
      );
    });
  });

  describe('result structure', () => {
    it('returns correct result structure', async () => {
      const scorer = createMockScorer('test-scorer', 1, 'Test reason');
      const context = createMockContext();

      const result = await runCompletionScorers([scorer], context);

      expect(result).toMatchObject({
        complete: true,
        completionReason: 'Test reason',
        timedOut: false,
      });
      expect(result.scorers[0]).toMatchObject({
        score: 1,
        passed: true,
        reason: 'Test reason',
        scorerId: 'test-scorer',
        scorerName: 'test-scorer Scorer',
      });
      expect(typeof result.totalDuration).toBe('number');
      expect(typeof result.scorers[0].duration).toBe('number');
    });
  });

  describe('empty scorers', () => {
    it('returns complete with empty scorers array and all strategy', async () => {
      const context = createMockContext();
      const result = await runCompletionScorers([], context, { strategy: 'all' });

      // Empty array with 'all' strategy: vacuously true (all of nothing passed)
      expect(result.complete).toBe(true);
      expect(result.scorers).toHaveLength(0);
    });

    it('returns incomplete with empty scorers array and any strategy', async () => {
      const context = createMockContext();
      const result = await runCompletionScorers([], context, { strategy: 'any' });

      // Empty array with 'any' strategy: false (none passed)
      expect(result.complete).toBe(false);
      expect(result.scorers).toHaveLength(0);
    });
  });
});

describe('formatCompletionFeedback', () => {
  it('formats complete result', () => {
    const result: CompletionRunResult = {
      complete: true,
      completionReason: 'All checks passed',
      scorers: [
        {
          score: 1,
          passed: true,
          reason: 'Test passed',
          scorerId: 'test-scorer',
          scorerName: 'Test Scorer',
          duration: 100,
        },
      ],
      totalDuration: 150,
      timedOut: false,
    };

    const feedback = formatCompletionFeedback(result);

    expect(feedback).toContain('## Completion Check Results');
    expect(feedback).toContain('✅ COMPLETE');
    expect(feedback).toContain('Duration: 150ms');
    expect(feedback).toContain('### Test Scorer (test-scorer)');
    expect(feedback).toContain('Score: 1 ✅');
    expect(feedback).toContain('Reason: Test passed');
    expect(feedback).not.toContain('timed out');
  });

  it('formats incomplete result', () => {
    const result: CompletionRunResult = {
      complete: false,
      completionReason: 'Check failed',
      scorers: [
        {
          score: 0,
          passed: false,
          reason: 'Test failed',
          scorerId: 'test-scorer',
          scorerName: 'Test Scorer',
          duration: 100,
        },
      ],
      totalDuration: 150,
      timedOut: false,
    };

    const feedback = formatCompletionFeedback(result);

    expect(feedback).toContain('❌ NOT COMPLETE');
    expect(feedback).toContain('Score: 0 ❌');
    expect(feedback).toContain('Reason: Test failed');
  });

  it('formats timeout indication', () => {
    const result: CompletionRunResult = {
      complete: false,
      scorers: [],
      totalDuration: 600000,
      timedOut: true,
    };

    const feedback = formatCompletionFeedback(result);

    expect(feedback).toContain('⚠️ Scoring timed out');
  });

  it('formats multiple scorers', () => {
    const result: CompletionRunResult = {
      complete: false,
      scorers: [
        {
          score: 1,
          passed: true,
          reason: 'First passed',
          scorerId: 'scorer-1',
          scorerName: 'Scorer One',
          duration: 50,
        },
        {
          score: 0,
          passed: false,
          reason: 'Second failed',
          scorerId: 'scorer-2',
          scorerName: 'Scorer Two',
          duration: 75,
        },
      ],
      totalDuration: 125,
      timedOut: false,
    };

    const feedback = formatCompletionFeedback(result);

    expect(feedback).toContain('### Scorer One (scorer-1)');
    expect(feedback).toContain('### Scorer Two (scorer-2)');
    expect(feedback).toContain('First passed');
    expect(feedback).toContain('Second failed');
  });

  it('handles scorer without reason', () => {
    const result: CompletionRunResult = {
      complete: true,
      scorers: [
        {
          score: 1,
          passed: true,
          scorerId: 'test-scorer',
          scorerName: 'Test Scorer',
          duration: 100,
        },
      ],
      totalDuration: 100,
      timedOut: false,
    };

    const feedback = formatCompletionFeedback(result);

    expect(feedback).toContain('Score: 1 ✅');
    // Should not have "Reason:" line since no reason provided
    expect(feedback).not.toContain('Reason:');
  });
});
