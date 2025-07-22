import { describe, it, expect } from 'vitest';

import { createTestRun } from '../../utils';
import { createKeywordCoverageScorer } from './index';

describe('KeywordCoverageMetric', () => {
  const scorer = createKeywordCoverageScorer();

  it('should return perfect coverage for identical text', async () => {
    const result = await scorer.run(
      createTestRun('The quick brown fox jumps over the lazy dog', 'The quick brown fox jumps over the lazy dog'),
    );
    expect(result.score).toBe(1);
    expect(result.analyzeStepResult?.matchedKeywords).toBe(6);
    expect(result.analyzeStepResult?.totalKeywords).toBe(6);
  });

  it('should handle partial keyword coverage', async () => {
    const result = await scorer.run(
      createTestRun('The quick brown fox jumps over the lazy dog', 'A quick brown fox runs past a sleeping cat'),
    );
    expect(result.score).toBeGreaterThan(0.3);
    expect(result.score).toBeLessThan(0.7);
    const matched = result.analyzeStepResult?.matchedKeywords as number;
    const total = result.analyzeStepResult?.totalKeywords as number;
    expect(matched).toBeLessThan(total);
  });

  it('should ignore common words and stop words', async () => {
    const result = await scorer.run(createTestRun('The quick brown fox', 'A quick brown fox'));
    expect(result.score).toBe(1); // "the" and "a" should be ignored
    const matched = result.analyzeStepResult?.matchedKeywords as number;
    const total = result.analyzeStepResult?.totalKeywords as number;
    expect(matched).toBe(total);
  });

  it('should handle case differences', async () => {
    const result = await scorer.run(createTestRun('The Quick Brown Fox', 'the quick brown fox'));
    expect(result.score).toBe(1);
    const matched = result.analyzeStepResult?.matchedKeywords as number;
    const total = result.analyzeStepResult?.totalKeywords as number;
    expect(matched).toBe(total);
  });

  it('should handle empty strings', async () => {
    const result = await scorer.run(createTestRun('', ''));
    expect(result.score).toBe(1);
    expect(result.analyzeStepResult?.totalKeywords).toBe(0);
    expect(result.analyzeStepResult?.matchedKeywords).toBe(0);
  });

  it('should handle one empty string', async () => {
    const result = await scorer.run(createTestRun('The quick brown fox', ''));
    expect(result.score).toBe(0);
    expect(result.analyzeStepResult?.matchedKeywords).toBe(0);
    expect(result.analyzeStepResult?.totalKeywords).toBeGreaterThan(0);
  });

  it('should ignore numbers by default', async () => {
    const result = await scorer.run(createTestRun('The 123 quick 456 brown fox', 'The quick brown fox'));
    expect(result.score).toBe(1);
  });

  it('should handle special characters', async () => {
    const result = await scorer.run(createTestRun('The quick-brown fox!', 'The quick brown fox'));
    // Hyphenated words are treated as separate keywords
    expect(result.score).toBeGreaterThanOrEqual(0.5);
    expect(result.score).toBeLessThan(1);
  });

  it('should handle completely different content', async () => {
    const result = await scorer.run(
      createTestRun('The quick brown fox jumps over the lazy dog', 'Lorem ipsum dolor sit amet'),
    );
    expect(result.score).toBe(0);
    expect(result.analyzeStepResult?.matchedKeywords).toBe(0);
  });

  it('should include coverage details in result', async () => {
    const result = await scorer.run(createTestRun('quick brown fox', 'quick brown fox'));
    expect(result.analyzeStepResult).toMatchObject({
      totalKeywords: 3,
      matchedKeywords: 3,
    });
  });
});
