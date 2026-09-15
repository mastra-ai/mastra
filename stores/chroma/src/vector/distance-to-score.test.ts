import { describe, expect, it } from 'vitest';

import { distanceToScore } from './distance-to-score';

describe('distanceToScore', () => {
  it('converts cosine distance with 1 - distance', () => {
    expect(distanceToScore(0, 'cosine')).toBe(1);
    expect(distanceToScore(0.25, 'cosine')).toBeCloseTo(0.75);
    expect(distanceToScore(2, 'cosine')).toBe(-1);
  });

  it('maps euclidean (squared L2) distance into a bounded 0..1 score', () => {
    expect(distanceToScore(0, 'euclidean')).toBe(1);
    expect(distanceToScore(1, 'euclidean')).toBeCloseTo(0.5);
    expect(distanceToScore(25, 'euclidean')).toBeCloseTo(1 / 6);
  });

  it('keeps euclidean scores monotonic and never negative', () => {
    const near = distanceToScore(0.5, 'euclidean');
    const far = distanceToScore(25, 'euclidean');
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
  });

  it('recovers the dot product from dotproduct distance with 1 - distance', () => {
    expect(distanceToScore(0.1, 'dotproduct')).toBeCloseTo(0.9);
    expect(distanceToScore(0.7, 'dotproduct')).toBeCloseTo(0.3);
  });
});
