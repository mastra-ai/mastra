import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { CompletionContext, CompletionRunResult, StreamCompletionContext } from './validation';
import {
  runCompletionScorers,
  formatCompletionFeedback,
  runStreamCompletionScorers,
  formatStreamCompletionFeedback,
} from './validation';

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

  it.each([true, false])('releases the completion deadline after scoring (parallel=%s)', async parallel => {
    vi.useFakeTimers();
    try {
      const result = await runCompletionScorers([createMockScorer('complete', 1)], createMockContext(), { parallel });
      expect(result.complete).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
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

    it('flags a thrown scorer with errored:true to distinguish failure from a legitimate score 0', async () => {
      const errorScorer = {
        id: 'error-scorer',
        name: 'Error Scorer',
        run: vi.fn().mockRejectedValue(new Error('judge crashed')),
      };
      const okScorer = {
        id: 'ok-scorer',
        name: 'OK Scorer',
        run: vi.fn().mockResolvedValue({ score: 0, reason: 'keep working' }),
      };
      const context = createMockContext();

      const result = await runCompletionScorers([errorScorer, okScorer], context);

      const errored = result.scorers.find(s => s.scorerId === 'error-scorer');
      const ok = result.scorers.find(s => s.scorerId === 'ok-scorer');
      // The thrown scorer is flagged; a legitimate score-0 scorer is not — both
      // report score 0, so `errored` is the only reliable discriminator.
      expect(errored?.errored).toBe(true);
      expect(errored?.score).toBe(0);
      expect(ok?.errored).toBeFalsy();
      expect(ok?.score).toBe(0);
    });

    it('preserves a null rejection as an explicit scorer failure', async () => {
      const nullScorer = {
        id: 'null-scorer',
        name: 'Null Scorer',
        run: vi.fn().mockRejectedValue(null),
      };
      const context = createMockContext();

      const result = await runCompletionScorers([nullScorer], context);

      expect(result.complete).toBe(false);
      expect(result.scorers[0].passed).toBe(false);
      expect(result.scorers[0].errored).toBe(true);
      expect(result.scorers[0].reason).toContain('Scorer threw an error');
    });

    it('preserves an undefined rejection as an explicit scorer failure', async () => {
      const undefinedScorer = {
        id: 'undefined-scorer',
        name: 'Undefined Scorer',
        run: vi.fn().mockRejectedValue(undefined),
      };
      const context = createMockContext();

      const result = await runCompletionScorers([undefinedScorer], context);

      expect(result.scorers[0].passed).toBe(false);
      expect(result.scorers[0].errored).toBe(true);
    });

    it('preserves the text of a string rejection', async () => {
      const stringScorer = {
        id: 'string-scorer',
        name: 'String Scorer',
        run: vi.fn().mockRejectedValue('boom happened'),
      };
      const context = createMockContext();

      const result = await runCompletionScorers([stringScorer], context);

      expect(result.scorers[0].passed).toBe(false);
      expect(result.scorers[0].errored).toBe(true);
      expect(result.scorers[0].reason).toContain('boom happened');
    });

    it('preserves the message of a plain-object rejection', async () => {
      const objectScorer = {
        id: 'object-scorer',
        name: 'Object Scorer',
        run: vi.fn().mockRejectedValue({ message: 'plain object failure' }),
      };
      const context = createMockContext();

      const result = await runCompletionScorers([objectScorer], context);

      expect(result.scorers[0].passed).toBe(false);
      expect(result.scorers[0].reason).toContain('plain object failure');
    });

    it('does not crash when a rejection has a throwing message getter', async () => {
      const hostile = {};
      Object.defineProperty(hostile, 'message', {
        get() {
          throw new Error('hostile getter');
        },
      });
      const hostileScorer = {
        id: 'hostile-scorer',
        name: 'Hostile Scorer',
        run: vi.fn().mockRejectedValue(hostile),
      };
      const context = createMockContext();

      const result = await runCompletionScorers([hostileScorer], context);

      expect(result.scorers[0].passed).toBe(false);
      expect(result.scorers[0].errored).toBe(true);
    });
  });

  describe('timeout enforcement', () => {
    it('returns promptly at the deadline instead of waiting for a slow passing scorer', async () => {
      // Scorer resolves a PASS after 150ms; timeout is 10ms. Must not wait ~150ms
      // and must not report complete:true from the late pass.
      const slowPass = createMockScorer('slow-pass', 1, 'Passed', 150);
      const context = createMockContext();

      const start = Date.now();
      const result = await runCompletionScorers([slowPass], context, { timeout: 10 });
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100);
      expect(result.timedOut).toBe(true);
      expect(result.complete).toBe(false);
      expect(result.scorers[0].errored).toBe(true);
      expect(result.scorers[0].passed).toBe(false);
    });

    it('resolves even when a scorer never settles', async () => {
      const neverSettles = {
        id: 'never',
        name: 'Never Scorer',
        run: vi.fn().mockImplementation(() => new Promise(() => {})),
      };
      const context = createMockContext();

      const result = await runCompletionScorers([neverSettles], context, { timeout: 10 });

      expect(result.timedOut).toBe(true);
      expect(result.complete).toBe(false);
      expect(result.scorers[0].errored).toBe(true);
    });

    it('does not let a late passing scorer flip the verdict in parallel mode', async () => {
      const fastFail = createMockScorer('fast-fail', 0, 'Failed', 1);
      const slowPass = createMockScorer('slow-pass', 1, 'Passed', 150);
      const context = createMockContext();

      const result = await runCompletionScorers([fastFail, slowPass], context, {
        strategy: 'any',
        timeout: 20,
      });

      expect(result.timedOut).toBe(true);
      expect(result.complete).toBe(false);
    });

    it('bounds an overrunning scorer in sequential mode', async () => {
      const slowPass = createMockScorer('slow-pass', 1, 'Passed', 150);
      const secondScorer = createMockScorer('second', 1, 'Passed');
      const context = createMockContext();

      const result = await runCompletionScorers([slowPass, secondScorer], context, {
        parallel: false,
        timeout: 20,
      });

      expect(result.timedOut).toBe(true);
      expect(result.complete).toBe(false);
      // The second scorer must never run once the deadline is hit.
      expect(secondScorer.run).not.toHaveBeenCalled();
    });

    it('clears the timeout timer after a successful run', async () => {
      vi.useFakeTimers();
      try {
        const scorer = createMockScorer('fast', 1, 'Passed');
        const context = createMockContext();

        // The scorer resolves synchronously (delay 0), so the run completes
        // without advancing timers. Asserting the count before advancing any
        // timers proves the deadline timer was cleared rather than merely fired.
        await runCompletionScorers([scorer], context, { timeout: 600000 });

        // No lingering default 10-minute timer should remain.
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        vi.useRealTimers();
      }
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

    const feedback = formatCompletionFeedback(result, false);

    expect(feedback).toContain('#### Completion Check Results');
    expect(feedback).toContain('✅ COMPLETE');
    expect(feedback).toContain('Duration: 150ms');
    expect(feedback).toContain('###### Test Scorer (test-scorer)');
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

    const feedback = formatCompletionFeedback(result, false);

    expect(feedback).toContain('❌ NOT COMPLETE');
    expect(feedback).toContain('Score: 0 ❌');
    expect(feedback).toContain('Reason: Test failed');
    expect(feedback).toContain('🔄 Will continue working on the task.');
  });

  it('formats max iterations reached result', () => {
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

    const feedback = formatCompletionFeedback(result, true);

    expect(feedback).toContain('❌ NOT COMPLETE');
    expect(feedback).toContain('Score: 0 ❌');
    expect(feedback).toContain('Reason: Test failed');
    expect(feedback).toContain('⚠️ Max iterations reached');
  });

  it('formats timeout indication', () => {
    const result: CompletionRunResult = {
      complete: false,
      scorers: [],
      totalDuration: 600000,
      timedOut: true,
    };

    const feedback = formatCompletionFeedback(result, false);

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

    const feedback = formatCompletionFeedback(result, false);

    expect(feedback).toContain('##### Scorer One (scorer-1)');
    expect(feedback).toContain('##### Scorer Two (scorer-2)');
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

    const feedback = formatCompletionFeedback(result, false);

    expect(feedback).toContain('Score: 1 ✅');
    // Should not have "Reason:" line since no reason provided
    expect(feedback).not.toContain('Reason:');
  });
});

// ============================================================================
// Stream Completion Scoring Tests
// ============================================================================

// Helper to create a mock stream completion context
function createMockStreamContext(overrides: Partial<StreamCompletionContext> = {}): StreamCompletionContext {
  return {
    iteration: 1,
    maxIterations: 10,
    originalTask: 'Test task',
    currentText: 'Current output text',
    toolCalls: [],
    toolResults: [],
    runId: 'test-run-id',
    messages: [],
    ...overrides,
  };
}

describe('runStreamCompletionScorers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('strategy: all (default)', () => {
    it('returns complete when all scorers pass', async () => {
      const scorer1 = createMockScorer('scorer-1', 1, 'Passed');
      const scorer2 = createMockScorer('scorer-2', 1, 'Passed');
      const context = createMockStreamContext();

      const result = await runStreamCompletionScorers([scorer1, scorer2] as any, context);

      expect(result.complete).toBe(true);
      expect(result.scorers).toHaveLength(2);
      expect(result.scorers.every(s => s.passed)).toBe(true);
    });

    it('returns incomplete when any scorer fails', async () => {
      const scorer1 = createMockScorer('scorer-1', 1, 'Passed');
      const scorer2 = createMockScorer('scorer-2', 0, 'Failed');
      const context = createMockStreamContext();

      const result = await runStreamCompletionScorers([scorer1, scorer2] as any, context);

      expect(result.complete).toBe(false);
      expect(result.scorers.some(s => !s.passed)).toBe(true);
    });

    it('returns incomplete when all scorers fail', async () => {
      const scorer1 = createMockScorer('scorer-1', 0, 'Failed');
      const scorer2 = createMockScorer('scorer-2', 0, 'Failed');
      const context = createMockStreamContext();

      const result = await runStreamCompletionScorers([scorer1, scorer2] as any, context);

      expect(result.complete).toBe(false);
      expect(result.scorers.every(s => !s.passed)).toBe(true);
    });
  });

  describe('strategy: any', () => {
    it('returns complete when at least one scorer passes', async () => {
      const scorer1 = createMockScorer('scorer-1', 0, 'Failed');
      const scorer2 = createMockScorer('scorer-2', 1, 'Passed');
      const context = createMockStreamContext();

      const result = await runStreamCompletionScorers([scorer1, scorer2] as any, context, { strategy: 'any' });

      expect(result.complete).toBe(true);
    });

    it('returns incomplete when all scorers fail', async () => {
      const scorer1 = createMockScorer('scorer-1', 0, 'Failed');
      const scorer2 = createMockScorer('scorer-2', 0, 'Failed');
      const context = createMockStreamContext();

      const result = await runStreamCompletionScorers([scorer1, scorer2] as any, context, { strategy: 'any' });

      expect(result.complete).toBe(false);
    });
  });

  describe('context adaptation', () => {
    it('adapts stream context to completion context for scorers', async () => {
      const scorer = createMockScorer('scorer-1', 1);
      const context = createMockStreamContext({
        originalTask: 'Custom stream task',
        currentText: 'Stream output text',
        runId: 'stream-run-id',
        agentId: 'my-agent',
        agentName: 'My Agent',
        toolCalls: [{ name: 'fetchData', args: { url: 'https://example.com' } }],
        toolResults: [{ name: 'fetchData', result: { data: 'test' } }],
      });

      await runStreamCompletionScorers([scorer] as any, context);

      expect(scorer.run).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'stream-run-id',
          input: expect.objectContaining({
            originalTask: 'Custom stream task',
            primitiveResult: 'Stream output text',
            selectedPrimitive: { id: 'stream', type: 'agent' },
            networkName: 'My Agent',
          }),
          output: 'Stream output text',
          requestContext: expect.objectContaining({
            toolCalls: [{ name: 'fetchData', args: { url: 'https://example.com' } }],
            toolResults: [{ name: 'fetchData', result: { data: 'test' } }],
            agentId: 'my-agent',
            agentName: 'My Agent',
          }),
        }),
      );
    });

    it('uses agentId as networkName when agentName is not provided', async () => {
      const scorer = createMockScorer('scorer-1', 1);
      const context = createMockStreamContext({
        agentId: 'my-agent-id',
        agentName: undefined,
      });

      await runStreamCompletionScorers([scorer] as any, context);

      expect(scorer.run).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            networkName: 'my-agent-id',
          }),
        }),
      );
    });

    it('uses "stream" as default networkName when neither agentId nor agentName provided', async () => {
      const scorer = createMockScorer('scorer-1', 1);
      const context = createMockStreamContext({
        agentId: undefined,
        agentName: undefined,
      });

      await runStreamCompletionScorers([scorer] as any, context);

      expect(scorer.run).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            networkName: 'stream',
          }),
        }),
      );
    });
  });

  describe('error handling', () => {
    it('handles scorer that throws an error', async () => {
      const errorScorer = {
        id: 'error-scorer',
        name: 'Error Scorer',
        run: vi.fn().mockRejectedValue(new Error('Scorer crashed')),
      };
      const context = createMockStreamContext();

      const result = await runStreamCompletionScorers([errorScorer] as any, context);

      expect(result.complete).toBe(false);
      expect(result.scorers[0].passed).toBe(false);
      expect(result.scorers[0].reason).toContain('Scorer threw an error');
      expect(result.scorers[0].reason).toContain('Scorer crashed');
    });
  });

  describe('sequential execution', () => {
    it('short-circuits on failure with all strategy', async () => {
      const scorer1 = createMockScorer('scorer-1', 0, 'Failed');
      const scorer2 = createMockScorer('scorer-2', 1, 'Passed');
      const context = createMockStreamContext();

      const result = await runStreamCompletionScorers([scorer1, scorer2] as any, context, {
        parallel: false,
        strategy: 'all',
      });

      expect(result.complete).toBe(false);
      expect(scorer1.run).toHaveBeenCalledTimes(1);
      expect(scorer2.run).not.toHaveBeenCalled();
    });

    it('short-circuits on success with any strategy', async () => {
      const scorer1 = createMockScorer('scorer-1', 1, 'Passed');
      const scorer2 = createMockScorer('scorer-2', 0, 'Failed');
      const context = createMockStreamContext();

      const result = await runStreamCompletionScorers([scorer1, scorer2] as any, context, {
        parallel: false,
        strategy: 'any',
      });

      expect(result.complete).toBe(true);
      expect(scorer1.run).toHaveBeenCalledTimes(1);
      expect(scorer2.run).not.toHaveBeenCalled();
    });
  });

  describe('empty scorers', () => {
    it('returns complete with empty scorers array and all strategy', async () => {
      const context = createMockStreamContext();
      const result = await runStreamCompletionScorers([], context, { strategy: 'all' });

      expect(result.complete).toBe(true);
      expect(result.scorers).toHaveLength(0);
    });

    it('returns incomplete with empty scorers array and any strategy', async () => {
      const context = createMockStreamContext();
      const result = await runStreamCompletionScorers([], context, { strategy: 'any' });

      expect(result.complete).toBe(false);
      expect(result.scorers).toHaveLength(0);
    });
  });
});

describe('formatStreamCompletionFeedback', () => {
  it('formats complete result with stream-specific messaging', () => {
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

    const feedback = formatStreamCompletionFeedback(result, false);

    expect(feedback).toContain('#### Completion Check Results');
    expect(feedback).toContain('✅ COMPLETE');
    expect(feedback).toContain('Duration: 150ms');
    expect(feedback).toContain('**Test Scorer** (test-scorer)');
    expect(feedback).toContain('Score: 1 ✅');
    expect(feedback).toContain('Reason: Test passed');
    expect(feedback).toContain('✅ The task is complete');
  });

  it('formats incomplete result with continuation message', () => {
    const result: CompletionRunResult = {
      complete: false,
      completionReason: 'Check failed',
      scorers: [
        {
          score: 0,
          passed: false,
          reason: 'Validation failed',
          scorerId: 'test-scorer',
          scorerName: 'Test Scorer',
          duration: 100,
        },
      ],
      totalDuration: 150,
      timedOut: false,
    };

    const feedback = formatStreamCompletionFeedback(result, false);

    expect(feedback).toContain('❌ NOT COMPLETE');
    expect(feedback).toContain('Score: 0 ❌');
    expect(feedback).toContain('Reason: Validation failed');
    expect(feedback).toContain('🔄 The task is not yet complete');
    expect(feedback).toContain('continue working');
  });

  it('formats max iterations reached message', () => {
    const result: CompletionRunResult = {
      complete: false,
      completionReason: 'Check failed',
      scorers: [
        {
          score: 0,
          passed: false,
          reason: 'Still in progress',
          scorerId: 'test-scorer',
          scorerName: 'Test Scorer',
          duration: 100,
        },
      ],
      totalDuration: 150,
      timedOut: false,
    };

    const feedback = formatStreamCompletionFeedback(result, true);

    expect(feedback).toContain('❌ NOT COMPLETE');
    expect(feedback).toContain('⚠️ Max iterations reached');
  });

  it('formats timeout indication', () => {
    const result: CompletionRunResult = {
      complete: false,
      scorers: [],
      totalDuration: 600000,
      timedOut: true,
    };

    const feedback = formatStreamCompletionFeedback(result, false);

    expect(feedback).toContain('⚠️ Scoring timed out');
  });

  it('formats multiple scorers with bold names', () => {
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

    const feedback = formatStreamCompletionFeedback(result, false);

    expect(feedback).toContain('**Scorer One** (scorer-1)');
    expect(feedback).toContain('**Scorer Two** (scorer-2)');
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

    const feedback = formatStreamCompletionFeedback(result, false);

    expect(feedback).toContain('Score: 1 ✅');
    expect(feedback).not.toContain('Reason:');
  });
});
