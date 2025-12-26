import { describe, it, expect } from 'vitest';
import { computeCompositeScore, validateScorerCoverage } from './composite';
import type { ScorerResult } from '../types';

describe('computeCompositeScore', () => {
  it('should compute weighted average of scores', () => {
    const results: ScorerResult[] = [
      { scorerId: 'quality', score: 0.8 },
      { scorerId: 'helpfulness', score: 0.6 },
    ];

    const score = computeCompositeScore(results, {
      weights: { quality: 0.7, helpfulness: 0.3 },
    });

    // 0.8 * 0.7 + 0.6 * 0.3 = 0.56 + 0.18 = 0.74
    expect(score).toBeCloseTo(0.74);
  });

  it('should handle equal weights', () => {
    const results: ScorerResult[] = [
      { scorerId: 'a', score: 0.5 },
      { scorerId: 'b', score: 0.5 },
    ];

    const score = computeCompositeScore(results, {
      weights: { a: 1, b: 1 },
    });

    expect(score).toBeCloseTo(0.5);
  });

  it('should handle missing scorers gracefully', () => {
    const results: ScorerResult[] = [{ scorerId: 'quality', score: 0.8 }];

    const score = computeCompositeScore(results, {
      weights: { quality: 0.5, missing: 0.5 },
    });

    // Only quality is present, so we normalize by applied weight
    expect(score).toBeCloseTo(0.8);
  });

  it('should clamp scores to 0-1 range', () => {
    const results: ScorerResult[] = [
      { scorerId: 'a', score: 1.5 }, // Above 1
      { scorerId: 'b', score: -0.5 }, // Below 0
    ];

    const score = computeCompositeScore(results, {
      weights: { a: 1, b: 1 },
    });

    // Clamped: 1.0 and 0.0, average = 0.5
    expect(score).toBeCloseTo(0.5);
  });

  it('should return 0 for empty weights', () => {
    const results: ScorerResult[] = [{ scorerId: 'quality', score: 0.8 }];

    const score = computeCompositeScore(results, { weights: {} });

    expect(score).toBe(0);
  });
});

describe('validateScorerCoverage', () => {
  it('should return valid when all scorers are present', () => {
    const results: ScorerResult[] = [
      { scorerId: 'a', score: 0.8 },
      { scorerId: 'b', score: 0.6 },
    ];

    const { valid, missing } = validateScorerCoverage(results, {
      weights: { a: 1, b: 1 },
    });

    expect(valid).toBe(true);
    expect(missing).toHaveLength(0);
  });

  it('should return missing scorers', () => {
    const results: ScorerResult[] = [{ scorerId: 'a', score: 0.8 }];

    const { valid, missing } = validateScorerCoverage(results, {
      weights: { a: 1, b: 1, c: 1 },
    });

    expect(valid).toBe(false);
    expect(missing).toContain('b');
    expect(missing).toContain('c');
  });

  it('should ignore zero-weight scorers', () => {
    const results: ScorerResult[] = [{ scorerId: 'a', score: 0.8 }];

    const { valid, missing } = validateScorerCoverage(results, {
      weights: { a: 1, b: 0 },
    });

    expect(valid).toBe(true);
    expect(missing).toHaveLength(0);
  });
});
