import { describe, it, expect } from 'vitest';

import { createAgentTestRun, createTestMessage } from '../../utils';
import { createContentSimilarityScorer } from './index';

describe('ContentSimilarityMetric', () => {
  const scorer = createContentSimilarityScorer();

  it('should return perfect similarity for identical strings', async () => {
    const inputMessages = [createTestMessage({ content: 'The quick brown fox', role: 'user', id: 'test-input' })];
    const output = [createTestMessage({ content: 'The quick brown fox', role: 'assistant', id: 'test-output' })];
    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBe(1);
  });

  it('should handle case differences with default options', async () => {
    const inputMessages = [createTestMessage({ content: 'The Quick Brown Fox', role: 'user', id: 'test-input' })];
    const output = [createTestMessage({ content: 'the quick brown fox', role: 'assistant', id: 'test-output' })];
    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBe(1);
  });

  it('should handle whitespace differences with default options', async () => {
    const inputMessages = [createTestMessage({ content: 'The   quick\nbrown    fox', role: 'user', id: 'test-input' })];
    const output = [createTestMessage({ content: 'The quick brown fox', role: 'assistant', id: 'test-output' })];
    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBe(1);
  });

  it('should be case sensitive when ignoreCase is false', async () => {
    const caseSensitiveMetric = createContentSimilarityScorer({ ignoreCase: false });
    const inputMessages = [createTestMessage({ content: 'The Quick Brown FOX', role: 'user', id: 'test-input' })];
    const output = [createTestMessage({ content: 'the quick brown fox', role: 'assistant', id: 'test-output' })];
    const result = await caseSensitiveMetric.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBeLessThan(0.8);
  });

  it('should preserve whitespace differences when ignoreWhitespace is true', async () => {
    const whitespaceMetric = createContentSimilarityScorer({
      ignoreCase: true,
      ignoreWhitespace: true,
    });
    const inputMessages = [createTestMessage({ content: 'The\tquick  brown\n\nfox', role: 'user', id: 'test-input' })];
    const output = [createTestMessage({ content: 'The quick brown fox', role: 'assistant', id: 'test-output' })];
    const result = await whitespaceMetric.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBe(1);
  });

  it('should handle both case and whitespace sensitivity', async () => {
    const sensitiveMetric = createContentSimilarityScorer({
      ignoreCase: false,
      ignoreWhitespace: true,
    });
    const inputMessages = [createTestMessage({ content: 'The\tQuick  Brown\n\nFOX', role: 'user', id: 'test-input' })];
    const output = [createTestMessage({ content: 'the quick brown fox', role: 'assistant', id: 'test-output' })];
    const result = await sensitiveMetric.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBeLessThan(0.8);
  });

  it('should handle partial similarity', async () => {
    const result = await scorer.run(
      createAgentTestRun({
        inputMessages: [
          createTestMessage({
            content: 'The quick brown fox jumps over the lazy dog',
            role: 'user',
            id: 'test-input',
          }),
        ],
        output: [
          createTestMessage({
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
    const inputMessages = [createTestMessage({ content: 'The quick brown fox', role: 'user', id: 'test-input' })];
    const output = [createTestMessage({ content: 'Lorem ipsum dolor sit amet', role: 'assistant', id: 'test-output' })];
    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBeLessThan(0.3);
  });

  it('should handle empty strings', async () => {
    const inputMessages = [createTestMessage({ content: '', role: 'user', id: 'test-input' })];
    const output = [createTestMessage({ content: '', role: 'assistant', id: 'test-output' })];
    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBe(1);
  });

  it('should handle one empty string', async () => {
    const inputMessages = [createTestMessage({ content: 'The quick brown fox', role: 'user', id: 'test-input' })];
    const output = [createTestMessage({ content: '', role: 'assistant', id: 'test-output' })];
    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBe(0);
  });

  it('should count whitespace differences when ignoreWhitespace is false', async () => {
    const whitespaceSensitiveMetric = createContentSimilarityScorer({ ignoreCase: true, ignoreWhitespace: false });
    const scoreOf = async (input: string, output: string) => {
      const result = await whitespaceSensitiveMetric.run(
        createAgentTestRun({
          inputMessages: [createTestMessage({ content: input, role: 'user', id: 'test-input' })],
          output: [createTestMessage({ content: output, role: 'assistant', id: 'test-output' })],
        }),
      );
      return result.score;
    };

    expect(await scoreOf('New York', 'NewYork')).toBeCloseTo(10 / 13);
    expect(await scoreOf('The quick\nbrown fox', 'The quick brown fox')).toBeCloseTo(32 / 36);
    expect(await scoreOf('ha ha', 'ha ha ha')).toBeCloseTo(8 / 11);
  });

  it('should count whitespace in texts with many distinct characters', async () => {
    const metric = createContentSimilarityScorer({ ignoreCase: false, ignoreWhitespace: false });
    const text = Array.from({ length: 0xffff }, (_, i) => String.fromCharCode(i))
      .filter(char => /\S/.test(char))
      .slice(0, 45311)
      .join('');
    const inputMessages = [createTestMessage({ content: text + ' '.repeat(100000), role: 'user', id: 'test-input' })];
    const output = [createTestMessage({ content: text, role: 'assistant', id: 'test-output' })];
    const result = await metric.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBe(90620 / 190620);
  });

  it('should keep ignoring whitespace when only ignoreCase is passed', async () => {
    const caseOnlyMetric = createContentSimilarityScorer({ ignoreCase: false });
    const inputMessages = [createTestMessage({ content: 'New York', role: 'user', id: 'test-input' })];
    const output = [createTestMessage({ content: 'NewYork', role: 'assistant', id: 'test-output' })];
    const result = await caseOnlyMetric.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBe(1);
  });
});
