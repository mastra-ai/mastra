import { describe, it, expect } from '@jest/globals';

import { ContentSimilarityMetric } from './index';

describe('ContentSimilarityMetric', () => {
  const metric = new ContentSimilarityMetric();

  it('should return perfect similarity for identical strings', async () => {
    const result = await metric.measure({
      input: 'The quick brown fox',
      output: 'The quick brown fox',
    });
    expect(result.score).toBe(1);
    expect(result.confidence).toBe(0.9);
  });

  it('should handle case differences with default options', async () => {
    const result = await metric.measure({
      input: 'The Quick Brown Fox',
      output: 'the quick brown fox',
    });
    expect(result.score).toBe(1);
  });

  it('should handle whitespace differences with default options', async () => {
    const result = await metric.measure({
      input: 'The   quick\nbrown    fox',
      output: 'The quick brown fox',
    });
    expect(result.score).toBe(1);
  });

  it('should be case sensitive when ignoreCase is false', async () => {
    const caseSensitiveMetric = new ContentSimilarityMetric({ ignoreCase: false });
    const result = await caseSensitiveMetric.measure({
      input: 'The Quick Brown FOX',
      output: 'the quick brown fox',
    });
    expect(result.score).toBeLessThan(0.8);
  });

  it('should preserve whitespace differences when ignoreWhitespace is true', async () => {
    const whitespaceMetric = new ContentSimilarityMetric({
      ignoreCase: true,
      ignoreWhitespace: true,
    });
    const result = await whitespaceMetric.measure({
      input: 'The\tquick  brown\n\nfox',
      output: 'The quick brown fox',
    });
    expect(result.score).toBe(1);
  });

  it('should handle both case and whitespace sensitivity', async () => {
    const sensitiveMetric = new ContentSimilarityMetric({
      ignoreCase: false,
      ignoreWhitespace: true,
    });
    const result = await sensitiveMetric.measure({
      input: 'The\tQuick  Brown\n\nFOX',
      output: 'the quick brown fox',
    });
    expect(result.score).toBeLessThan(0.8);
  });

  it('should handle partial similarity', async () => {
    const result = await metric.measure({
      input: 'The quick brown fox jumps over the lazy dog',
      output: 'The quick brown fox runs past the lazy dog',
    });
    expect(result.score).toBeGreaterThan(0.7);
    expect(result.score).toBeLessThan(0.8);
  });

  it('should handle completely different strings', async () => {
    const result = await metric.measure({
      input: 'The quick brown fox',
      output: 'Lorem ipsum dolor sit amet',
    });
    expect(result.score).toBeLessThan(0.3);
  });

  it('should handle empty strings', async () => {
    const result = await metric.measure({
      input: '',
      output: '',
    });
    expect(result.score).toBe(1);
  });

  it('should handle one empty string', async () => {
    const result = await metric.measure({
      input: 'The quick brown fox',
      output: '',
    });
    expect(result.score).toBe(0);
  });

  it('should include similarity details in result', async () => {
    const result = await metric.measure({
      input: 'The quick brown fox',
      output: 'The quick brown fox',
    });
    expect(result.details).toBe('Content similarity: 100.0%');
    expect(result.metrics).toEqual({ similarity: 1 });
  });
});
