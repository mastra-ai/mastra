import { it, expect } from '@jest/globals';

import { KeywordCoverageMetric } from './index';

describe('KeywordCoverageMetric', () => {
  const metric = new KeywordCoverageMetric();

  it('should return perfect coverage for identical text', async () => {
    const result = await metric.measure({
      input: 'The quick brown fox jumps over the lazy dog',
      output: 'The quick brown fox jumps over the lazy dog',
    });
    expect(result.score).toBe(1);
    expect(result.confidence).toBe(0.85);
    const matched = result.metrics?.matchedKeywords as number;
    const total = result.metrics?.totalKeywords as number;
    expect(matched).toBeGreaterThan(0);
    expect(total).toBeGreaterThan(0);
    expect(matched).toBe(total);
  });

  it('should handle partial keyword coverage', async () => {
    const result = await metric.measure({
      input: 'The quick brown fox jumps over the lazy dog',
      output: 'A quick brown fox runs past a sleeping cat',
    });
    expect(result.score).toBeGreaterThan(0.3);
    expect(result.score).toBeLessThan(0.7);
    const matched = result.metrics?.matchedKeywords as number;
    const total = result.metrics?.totalKeywords as number;
    expect(matched).toBeLessThan(total);
  });

  it('should ignore common words and stop words', async () => {
    const result = await metric.measure({
      input: 'The quick brown fox',
      output: 'A quick brown fox',
    });
    expect(result.score).toBe(1); // "the" and "a" should be ignored
    const matched = result.metrics?.matchedKeywords as number;
    const total = result.metrics?.totalKeywords as number;
    expect(matched).toBe(total);
  });

  it('should handle case differences', async () => {
    const result = await metric.measure({
      input: 'The Quick Brown Fox',
      output: 'the quick brown fox',
    });
    expect(result.score).toBe(1);
    const matched = result.metrics?.matchedKeywords as number;
    const total = result.metrics?.totalKeywords as number;
    expect(matched).toBe(total);
  });

  it('should handle empty strings', async () => {
    const result = await metric.measure({
      input: '',
      output: '',
    });
    expect(result.score).toBe(1);
    expect(result.metrics?.totalKeywords).toBe(0);
    expect(result.metrics?.matchedKeywords).toBe(0);
  });

  it('should handle one empty string', async () => {
    const result = await metric.measure({
      input: 'The quick brown fox',
      output: '',
    });
    expect(result.score).toBe(0);
    expect(result.metrics?.matchedKeywords).toBe(0);
    expect(result.metrics?.totalKeywords).toBeGreaterThan(0);
  });

  it('should ignore numbers by default', async () => {
    const result = await metric.measure({
      input: 'The 123 quick 456 brown fox',
      output: 'The quick brown fox',
    });
    expect(result.score).toBe(1);
  });

  it('should handle special characters', async () => {
    const result = await metric.measure({
      input: 'The quick-brown fox!',
      output: 'The quick brown fox',
    });
    // Hyphenated words are treated as separate keywords
    expect(result.score).toBeGreaterThanOrEqual(0.5);
    expect(result.score).toBeLessThan(1);
  });

  it('should handle completely different content', async () => {
    const result = await metric.measure({
      input: 'The quick brown fox jumps over the lazy dog',
      output: 'Lorem ipsum dolor sit amet',
    });
    expect(result.score).toBe(0);
    expect(result.metrics?.matchedKeywords).toBe(0);
  });

  it('should include coverage details in result', async () => {
    const result = await metric.measure({
      input: 'quick brown fox',
      output: 'quick brown fox',
    });
    expect(result.details).toMatch(/Keyword coverage: 100.0% \(3\/3 keywords\)/);
    expect(result.metrics).toEqual({
      totalKeywords: 3,
      matchedKeywords: 3,
    });
  });
});
