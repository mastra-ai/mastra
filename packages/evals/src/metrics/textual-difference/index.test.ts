import { it, expect } from '@jest/globals';

import { TextualDifferenceMetric } from './index';

describe('TextualDifferenceMetric', () => {
  const metric = new TextualDifferenceMetric();

  it('should return perfect match for identical strings', async () => {
    const result = await metric.measure({
      input: 'The quick brown fox',
      output: 'The quick brown fox',
    });
    expect(result.score).toBe(1);
    expect(result.confidence).toBe(1);
    expect(result.metrics!.changes).toBe(0);
  });

  it('should handle small differences', async () => {
    const result = await metric.measure({
      input: 'The quick brown fox',
      output: 'The quick brown cat',
    });
    expect(result.score).toBeGreaterThan(0.8);
    expect(result.metrics!.changes).toBe(1);
  });

  it('should handle word additions', async () => {
    const result = await metric.measure({
      input: 'The quick brown fox',
      output: 'The very quick brown fox',
    });
    expect(result.score).toBeGreaterThan(0.7);
    expect(result.metrics!.changes).toBe(1);
  });

  it('should handle word deletions', async () => {
    const result = await metric.measure({
      input: 'The quick brown fox jumps',
      output: 'The quick fox jumps',
    });
    expect(result.score).toBeGreaterThan(0.7);
    expect(result.metrics!.changes).toBe(1);
  });

  it('should handle multiple changes', async () => {
    const result = await metric.measure({
      input: 'The quick brown fox jumps over the lazy dog',
      output: 'The slow black fox runs under the active cat',
    });
    expect(result.score).toBeGreaterThan(0.4);
    expect(result.score).toBeLessThan(0.7);
    expect(result.metrics!.changes).toBeGreaterThan(3);
  });

  it('should handle completely different strings', async () => {
    const result = await metric.measure({
      input: 'The quick brown fox',
      output: 'Lorem ipsum dolor sit amet',
    });
    expect(result.score).toBeLessThan(0.3);
    expect(result.metrics!.changes).toBeGreaterThan(3);
  });

  it('should handle empty strings', async () => {
    const result = await metric.measure({
      input: '',
      output: '',
    });
    expect(result.score).toBe(1);
    expect(result.confidence).toBe(1);
    expect(result.metrics!.changes).toBe(0);
    expect(result.metrics!.lengthDiff).toBe(0);
  });

  it('should handle one empty string', async () => {
    const result = await metric.measure({
      input: 'The quick brown fox',
      output: '',
    });
    expect(result.score).toBe(0);
    expect(result.confidence).toBe(0);
    expect(result.metrics!.changes).toBeGreaterThan(0);
    expect(result.metrics!.lengthDiff).toBe(1);
  });

  it('should handle case sensitivity', async () => {
    const result = await metric.measure({
      input: 'The Quick Brown Fox',
      output: 'the quick brown fox',
    });
    expect(result.score).toBeLessThan(1);
    expect(result.metrics!.changes).toBeGreaterThan(0);
  });

  it('should handle whitespace sensitivity', async () => {
    const result = await metric.measure({
      input: 'The   quick\nbrown    fox',
      output: 'The quick brown fox',
    });
    expect(result.score).toBeLessThan(1);
    expect(result.metrics!.changes).toBeGreaterThan(0);
  });

  it('should include difference details in result', async () => {
    const result = await metric.measure({
      input: 'The quick brown fox',
      output: 'The quick brown fox',
    });
    expect(result.details).toBe('Difference score: 100.0% with 0 changes');
    expect(result.metrics!).toEqual({
      ratio: 1,
      changes: 0,
      lengthDiff: 0,
    });
  });
});
