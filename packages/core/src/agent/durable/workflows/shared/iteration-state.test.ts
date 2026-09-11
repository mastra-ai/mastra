import { describe, expect, it } from 'vitest';
import { calculateAccumulatedUsage } from './iteration-state';
import type { AccumulatedUsage } from './schemas';

describe('calculateAccumulatedUsage', () => {
  const zeroStart: AccumulatedUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

  it('sums known counts across steps', () => {
    const afterFirst = calculateAccumulatedUsage(zeroStart, {
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
    });
    const afterSecond = calculateAccumulatedUsage(afterFirst, {
      inputTokens: 2,
      outputTokens: 3,
      totalTokens: 5,
    });

    expect(afterSecond).toEqual({ inputTokens: 12, outputTokens: 8, totalTokens: 20 });
  });

  it('marks a counter unknown when a step omits it', () => {
    const result = calculateAccumulatedUsage(zeroStart, { inputTokens: 10 });

    expect(result.inputTokens).toBe(10);
    expect(result.outputTokens).toBeUndefined();
    expect(result.totalTokens).toBeUndefined();
  });

  it('keeps a counter unknown once it becomes unknown (missing then known)', () => {
    const afterMissing = calculateAccumulatedUsage(zeroStart, { outputTokens: 5, totalTokens: 5 });
    expect(afterMissing.inputTokens).toBeUndefined();

    const afterKnown = calculateAccumulatedUsage(afterMissing, {
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
    });

    expect(afterKnown.inputTokens).toBeUndefined();
    expect(afterKnown.outputTokens).toBe(10);
    expect(afterKnown.totalTokens).toBe(20);
  });

  it('marks all counters unknown when every step omits every primary count', () => {
    const result = calculateAccumulatedUsage(zeroStart, {});

    expect(result.inputTokens).toBeUndefined();
    expect(result.outputTokens).toBeUndefined();
    expect(result.totalTokens).toBeUndefined();
  });

  it('preserves measured zero as a known value', () => {
    const result = calculateAccumulatedUsage(zeroStart, {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    });

    expect(result).toEqual({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
  });
});
