import { describe, it, expect } from 'vitest';

import { createAgentTestRun, createUIMessage } from '../../utils';
import { createContentSimilarityScorer } from './index';

describe('ContentSimilarityMetric', () => {
  const scorer = createContentSimilarityScorer();

  it('should return perfect similarity for identical strings', async () => {
    const inputMessages = [createUIMessage({ content: 'The quick brown fox', role: 'user', id: 'test-input' })];
    const output = [createUIMessage({ content: 'The quick brown fox', role: 'assistant', id: 'test-output' })];
    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBe(1);
  });

  it('should handle case differences with default options', async () => {
    const inputMessages = [createUIMessage({ content: 'The Quick Brown Fox', role: 'user', id: 'test-input' })];
    const output = [createUIMessage({ content: 'the quick brown fox', role: 'assistant', id: 'test-output' })];
    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBe(1);
  });

  it('should handle whitespace differences with default options', async () => {
    const inputMessages = [createUIMessage({ content: 'The   quick\nbrown    fox', role: 'user', id: 'test-input' })];
    const output = [createUIMessage({ content: 'The quick brown fox', role: 'assistant', id: 'test-output' })];
    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBe(1);
  });

  it('should handle case differences with default options', async () => {
    const inputMessages = [createUIMessage({ content: 'The Quick Brown Fox', role: 'user', id: 'test-input' })];
    const output = [createUIMessage({ content: 'the quick brown fox', role: 'assistant', id: 'test-output' })];
    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBe(1);
  });

  it('should handle whitespace differences with default options', async () => {
    const inputMessages = [createUIMessage({ content: 'The   quick\nbrown    fox', role: 'user', id: 'test-input' })];
    const output = [createUIMessage({ content: 'The quick brown fox', role: 'assistant', id: 'test-output' })];
    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBe(1);
  });

  it('should be case sensitive when ignoreCase is false', async () => {
    const caseSensitiveMetric = createContentSimilarityScorer({ ignoreCase: false });
    const inputMessages = [createUIMessage({ content: 'The Quick Brown FOX', role: 'user', id: 'test-input' })];
    const output = [createUIMessage({ content: 'the quick brown fox', role: 'assistant', id: 'test-output' })];
    const result = await caseSensitiveMetric.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBeLessThan(0.8);
  });

  it('should preserve whitespace differences when ignoreWhitespace is true', async () => {
    const whitespaceMetric = createContentSimilarityScorer({
      ignoreCase: true,
      ignoreWhitespace: true,
    });
    const inputMessages = [createUIMessage({ content: 'The\tquick  brown\n\nfox', role: 'user', id: 'test-input' })];
    const output = [createUIMessage({ content: 'The quick brown fox', role: 'assistant', id: 'test-output' })];
    const result = await whitespaceMetric.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBe(1);
  });

  it('should handle both case and whitespace sensitivity', async () => {
    const sensitiveMetric = createContentSimilarityScorer({
      ignoreCase: false,
      ignoreWhitespace: true,
    });
    const inputMessages = [createUIMessage({ content: 'The\tQuick  Brown\n\nFOX', role: 'user', id: 'test-input' })];
    const output = [createUIMessage({ content: 'the quick brown fox', role: 'assistant', id: 'test-output' })];
    const result = await sensitiveMetric.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBeLessThan(0.8);
  });

  it('should handle partial similarity', async () => {
    const result = await scorer.run(
      createAgentTestRun({
        inputMessages: [
          createUIMessage({ content: 'The quick brown fox jumps over the lazy dog', role: 'user', id: 'test-input' }),
        ],
        output: [
          createUIMessage({
            content: 'The quick brown fox runs past the lazy dog',
            role: 'assistant',
            id: 'test-output',
          }),
        ],
      }),
    );
    expect(result.score).toBeGreaterThan(0.7);
    expect(result.score).toBeLessThan(0.8);
  });

  it('should handle completely different strings', async () => {
    const inputMessages = [createUIMessage({ content: 'The quick brown fox', role: 'user', id: 'test-input' })];
    const output = [createUIMessage({ content: 'Lorem ipsum dolor sit amet', role: 'assistant', id: 'test-output' })];
    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBeLessThan(0.3);
  });

  it('should handle empty strings', async () => {
    const inputMessages = [createUIMessage({ content: '', role: 'user', id: 'test-input' })];
    const output = [createUIMessage({ content: '', role: 'assistant', id: 'test-output' })];
    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBe(1);
  });

  it('should handle one empty string', async () => {
    const inputMessages = [createUIMessage({ content: 'The quick brown fox', role: 'user', id: 'test-input' })];
    const output = [createUIMessage({ content: '', role: 'assistant', id: 'test-output' })];
    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBe(0);
  });
});
