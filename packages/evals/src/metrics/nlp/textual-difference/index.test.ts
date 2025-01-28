import { describe, it, expect } from 'vitest';

import { TextualDifferenceMetric } from './index';

describe('TextualDifferenceMetric', () => {
  const metric = new TextualDifferenceMetric();

  it('should return perfect match for identical strings', async () => {
    const result = await metric.measure('The quick brown fox', 'The quick brown fox');
    expect(result.score).toBe(1);
    expect(result.info).toEqual({
      confidence: 1,
      ratio: 1,
      changes: 0,
      lengthDiff: 0,
    });
  });

  it('should handle small differences', async () => {
    const result = await metric.measure('The quick brown fox', 'The quick brown cat');
    expect(result.score).toBeGreaterThan(0.8);
    expect(result.info?.changes).toBe(1);
  });

  it('should handle word additions', async () => {
    const result = await metric.measure('The quick brown fox', 'The very quick brown fox');
    expect(result.score).toBeGreaterThan(0.7);
    expect(result.info?.changes).toBe(1);
  });

  it('should handle word deletions', async () => {
    const result = await metric.measure('The quick brown fox jumps', 'The quick fox jumps');
    expect(result.score).toBeGreaterThan(0.7);
    expect(result.info?.changes).toBe(1);
  });

  it('should handle multiple changes', async () => {
    const result = await metric.measure(
      'The quick brown fox jumps over the lazy dog',
      'The slow black fox runs under the active cat',
    );
    expect(result.score).toBeGreaterThan(0.4);
    expect(result.score).toBeLessThan(0.7);
    expect(result.info?.changes).toBeGreaterThan(3);
  });

  it('should handle completely different strings', async () => {
    const result = await metric.measure('The quick brown fox', 'Lorem ipsum dolor sit amet');
    expect(result.score).toBeLessThan(0.3);
    expect(result.info?.changes).toBeGreaterThan(3);
  });

  it('should handle empty strings', async () => {
    const result = await metric.measure('', '');
    expect(result.score).toBe(1);
    expect(result.info?.changes).toBe(0);
    expect(result.info?.lengthDiff).toBe(0);
  });

  it('should handle one empty string', async () => {
    const result = await metric.measure('The quick brown fox', '');
    expect(result.score).toBe(0);
    expect(result.info?.changes).toBeGreaterThan(0);
    expect(result.info?.lengthDiff).toBe(1);
  });

  it('should handle case sensitivity', async () => {
    const result = await metric.measure('The Quick Brown Fox', 'the quick brown fox');
    expect(result.score).toBeLessThan(1);
    expect(result.info?.changes).toBeGreaterThan(0);
  });

  it('should handle whitespace sensitivity', async () => {
    const result = await metric.measure('The   quick\nbrown    fox', 'The quick brown fox');
    expect(result.score).toBeLessThan(1);
    expect(result.info?.changes).toBeGreaterThan(0);
  });

  it('should include difference details in result', async () => {
    const result = await metric.measure('The quick brown fox', 'The quick brown fox');
    expect(result.info).toEqual({
      confidence: 1,
      ratio: 1,
      changes: 0,
      lengthDiff: 0,
    });
  });
});
