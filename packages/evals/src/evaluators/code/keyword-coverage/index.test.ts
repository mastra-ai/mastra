import { describe, it, expect } from 'vitest';

import { KeywordCoverage } from './index';

describe('KeywordCoverage', () => {
  const evaluator = new KeywordCoverage();

  it('should return perfect coverage for identical text', async () => {
    const result = await evaluator.score({
      input: 'The quick brown fox jumps over the lazy dog',
      output: 'The quick brown fox jumps over the lazy dog',
    });
    expect(result.score).toBe(1);
    expect(result.info?.matchedKeywords).toBe(6);
    expect(result.info?.totalKeywords).toBe(6);
  });

  it('should handle partial keyword coverage', async () => {
    const result = await evaluator.score({
      input: 'The quick brown fox jumps over the lazy dog',
      output: 'A quick brown fox runs past a sleeping cat',
    });
    expect(result.score).toBeGreaterThan(0.3);
    expect(result.score).toBeLessThan(0.7);
    const matched = result.info?.matchedKeywords as number;
    const total = result.info?.totalKeywords as number;
    expect(matched).toBeLessThan(total);
  });

  it('should ignore common words and stop words', async () => {
    const result = await evaluator.score({
      input: 'The quick brown fox',
      output: 'A quick brown fox',
    });
    expect(result.score).toBe(1); // "the" and "a" should be ignored
    const matched = result.info?.matchedKeywords as number;
    const total = result.info?.totalKeywords as number;
    expect(matched).toBe(total);
  });

  it('should handle case differences', async () => {
    const result = await evaluator.score({
      input: 'The Quick Brown Fox',
      output: 'the quick brown fox',
    });
    expect(result.score).toBe(1);
    const matched = result.info?.matchedKeywords as number;
    const total = result.info?.totalKeywords as number;
    expect(matched).toBe(total);
  });

  it('should handle empty strings', async () => {
    const result = await evaluator.score({
      input: '',
      output: '',
    });
    expect(result.score).toBe(1);
    expect(result.info?.totalKeywords).toBe(0);
    expect(result.info?.matchedKeywords).toBe(0);
  });

  it('should handle one empty string', async () => {
    const result = await evaluator.score({
      input: 'The quick brown fox',
      output: '',
    });
    expect(result.score).toBe(0);
    expect(result.info?.matchedKeywords).toBe(0);
    expect(result.info?.totalKeywords).toBeGreaterThan(0);
  });

  it('should ignore numbers by default', async () => {
    const result = await evaluator.score({
      input: 'The 123 quick 456 brown fox',
      output: 'The quick brown fox',
    });
    expect(result.score).toBe(1);
  });

  it('should handle special characters', async () => {
    const result = await evaluator.score({
      input: 'The quick-brown fox!',
      output: 'The quick brown fox',
    });
    // Hyphenated words are treated as separate keywords
    expect(result.score).toBeGreaterThanOrEqual(0.5);
    expect(result.score).toBeLessThan(1);
  });

  it('should handle completely different content', async () => {
    const result = await evaluator.score({
      input: 'The quick brown fox jumps over the lazy dog',
      output: 'Lorem ipsum dolor sit amet',
    });
    expect(result.score).toBe(0);
    expect(result.info?.matchedKeywords).toBe(0);
  });

  it('should include coverage details in result', async () => {
    const result = await evaluator.score({
      input: 'quick brown fox',
      output: 'quick brown fox',
    });
    expect(result.info?.totalKeywords).toBe(3);
    expect(result.info?.matchedKeywords).toBe(3);
  });
});
