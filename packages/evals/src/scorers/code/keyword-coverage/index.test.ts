import { describe, it, expect } from 'vitest';

import { createAgentTestRun, createUIMessage } from '../../utils';
import { createKeywordCoverageScorer } from './index';

describe('KeywordCoverageMetric', () => {
  const scorer = createKeywordCoverageScorer();

  it('should return perfect coverage for identical text', async () => {
    const inputMessages = [
      createUIMessage({ content: 'The quick brown fox jumps over the lazy dog', role: 'user', id: 'test-input' }),
    ];
    const output = [
      createUIMessage({ content: 'The quick brown fox jumps over the lazy dog', role: 'assistant', id: 'test-output' }),
    ];

    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBe(1);
    expect(result.analyzeStepResult?.matchedKeywordsLength).toBe(6);
    expect(result.analyzeStepResult?.totalKeywordsLength).toBe(6);
  });

  it('should handle partial keyword coverage', async () => {
    const inputMessages = [
      createUIMessage({ content: 'The quick brown fox jumps over the lazy dog', role: 'user', id: 'test-input' }),
    ];
    const output = [
      createUIMessage({ content: 'A quick brown fox runs past a sleeping cat', role: 'assistant', id: 'test-output' }),
    ];

    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBeGreaterThan(0.3);
    expect(result.score).toBeLessThan(0.7);
    const matched = result.analyzeStepResult?.matchedKeywordsLength;
    const total = result.analyzeStepResult?.totalKeywordsLength!;
    expect(matched).toBeLessThan(total);
  });

  it('should ignore common words and stop words', async () => {
    const inputMessages = [createUIMessage({ content: 'The quick brown fox', role: 'user', id: 'test-input' })];
    const output = [createUIMessage({ content: 'A quick brown fox', role: 'assistant', id: 'test-output' })];

    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBe(1); // "the" and "a" should be ignored
    const matched = result.analyzeStepResult?.matchedKeywordsLength;
    const total = result.analyzeStepResult?.totalKeywordsLength;
    expect(matched).toBe(total);
  });

  it('should handle case differences', async () => {
    const inputMessages = [createUIMessage({ content: 'The Quick Brown Fox', role: 'user', id: 'test-input' })];
    const output = [createUIMessage({ content: 'the quick brown fox', role: 'assistant', id: 'test-output' })];

    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBe(1);
    const matched = result.analyzeStepResult?.matchedKeywordsLength;
    const total = result.analyzeStepResult?.totalKeywordsLength;
    expect(matched).toBe(total);
  });

  it('should handle empty strings', async () => {
    const inputMessages = [createUIMessage({ content: '', role: 'user', id: 'test-input' })];
    const output = [createUIMessage({ content: '', role: 'assistant', id: 'test-output' })];

    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBe(1);
    expect(result.analyzeStepResult?.totalKeywordsLength).toBe(0);
    expect(result.analyzeStepResult?.matchedKeywordsLength).toBe(0);
  });

  it('should handle one empty string', async () => {
    const inputMessages = [createUIMessage({ content: 'The quick brown fox', role: 'user', id: 'test-input' })];
    const output = [createUIMessage({ content: '', role: 'assistant', id: 'test-output' })];

    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBe(0);
    expect(result.analyzeStepResult?.matchedKeywordsLength).toBe(0);
    expect(result.analyzeStepResult?.totalKeywordsLength).toBeGreaterThan(0);
  });

  it('should ignore numbers by default', async () => {
    const inputMessages = [createUIMessage({ content: 'The 123 quick 456 brown fox', role: 'user', id: 'test-input' })];
    const output = [createUIMessage({ content: 'The quick brown fox', role: 'assistant', id: 'test-output' })];

    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBe(1);
  });

  it('should handle special characters', async () => {
    const inputMessages = [createUIMessage({ content: 'The quick-brown fox!', role: 'user', id: 'test-input' })];
    const output = [createUIMessage({ content: 'The quick brown fox', role: 'assistant', id: 'test-output' })];

    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    // Hyphenated words are treated as separate keywords
    expect(result.score).toBeGreaterThanOrEqual(0.5);
    expect(result.score).toBeLessThan(1);
  });

  it('should handle completely different content', async () => {
    const inputMessages = [
      createUIMessage({ content: 'The quick brown fox jumps over the lazy dog', role: 'user', id: 'test-input' }),
    ];
    const output = [createUIMessage({ content: 'Lorem ipsum dolor sit amet', role: 'assistant', id: 'test-output' })];

    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBe(0);
    expect(result.analyzeStepResult?.matchedKeywordsLength).toBe(0);
  });

  it('should include coverage details in result', async () => {
    const inputMessages = [createUIMessage({ content: 'quick brown fox', role: 'user', id: 'test-input' })];
    const output = [createUIMessage({ content: 'quick brown fox', role: 'assistant', id: 'test-output' })];

    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.analyzeStepResult).toMatchObject({
      totalKeywordsLength: 3,
      matchedKeywordsLength: 3,
    });
  });
});
