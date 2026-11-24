import { describe, it, expect } from 'vitest';

import { createAgentTestRun, createTestMessage } from '../../utils';
import { createTextualDifferenceScorer } from './index';

describe('TextualDifferenceMetric', () => {
  const scorer = createTextualDifferenceScorer();

  it('should return perfect match for identical strings', async () => {
    const inputMessages = [createTestMessage({ content: 'The quick brown fox', role: 'user', id: 'test-input' })];
    const output = [createTestMessage({ content: 'The quick brown fox', role: 'assistant', id: 'test-output' })];

    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBe(1);
    expect(result.preprocessStepResult).toMatchObject({
      confidence: 1,
      changes: 0,
      lengthDiff: 0,
    });
  });

  it('should handle small differences', async () => {
    const inputMessages = [createTestMessage({ content: 'The quick brown fox', role: 'user', id: 'test-input' })];
    const output = [createTestMessage({ content: 'The quick brown cat', role: 'assistant', id: 'test-output' })];

    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBeGreaterThan(0.8);
    expect(result.preprocessStepResult?.changes).toBe(1);
  });

  it('should handle word additions', async () => {
    const inputMessages = [createTestMessage({ content: 'The quick brown fox', role: 'user', id: 'test-input' })];
    const output = [createTestMessage({ content: 'The very quick brown fox', role: 'assistant', id: 'test-output' })];

    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBeGreaterThan(0.7);
    expect(result.preprocessStepResult?.changes).toBe(1);
  });

  it('should handle word deletions', async () => {
    const inputMessages = [createTestMessage({ content: 'The quick brown fox jumps', role: 'user', id: 'test-input' })];
    const output = [createTestMessage({ content: 'The quick fox jumps', role: 'assistant', id: 'test-output' })];

    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBeGreaterThan(0.7);
    expect(result.preprocessStepResult?.changes).toBe(1);
  });

  it('should handle multiple changes', async () => {
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
            content: 'The slow black fox runs under the active cat',
            role: 'assistant',
            id: 'test-output',
          }),
        ],
      }),
    );
    expect(result.score).toBeGreaterThan(0.4);
    expect(result.score).toBeLessThan(0.7);
    expect(result.preprocessStepResult?.changes).toBeGreaterThan(3);
  });

  it('should handle completely different strings', async () => {
    const inputMessages = [createTestMessage({ content: 'The quick brown fox', role: 'user', id: 'test-input' })];
    const output = [createTestMessage({ content: 'Lorem ipsum dolor sit amet', role: 'assistant', id: 'test-output' })];

    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBeLessThan(0.3);
    expect(result.preprocessStepResult?.changes).toBeGreaterThan(3);
  });

  it('should handle empty strings', async () => {
    const inputMessages = [createTestMessage({ content: '', role: 'user', id: 'test-input' })];
    const output = [createTestMessage({ content: '', role: 'assistant', id: 'test-output' })];

    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBe(1);
    expect(result.preprocessStepResult?.changes).toBe(0);
    expect(result.preprocessStepResult?.lengthDiff).toBe(0);
  });

  it('should handle one empty string', async () => {
    const inputMessages = [createTestMessage({ content: 'The quick brown fox', role: 'user', id: 'test-input' })];
    const output = [createTestMessage({ content: '', role: 'assistant', id: 'test-output' })];

    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBe(0);
    expect(result.preprocessStepResult?.changes).toBeGreaterThan(0);
    expect(result.preprocessStepResult?.lengthDiff).toBe(1);
  });

  it('should handle case sensitivity', async () => {
    const inputMessages = [createTestMessage({ content: 'The Quick Brown Fox', role: 'user', id: 'test-input' })];
    const output = [createTestMessage({ content: 'the quick brown fox', role: 'assistant', id: 'test-output' })];

    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBeLessThan(1);
    expect(result.preprocessStepResult?.changes).toBeGreaterThan(0);
  });

  it('should handle whitespace sensitivity', async () => {
    const inputMessages = [createTestMessage({ content: 'The   quick\nbrown    fox', role: 'user', id: 'test-input' })];
    const output = [createTestMessage({ content: 'The quick brown fox', role: 'assistant', id: 'test-output' })];

    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBeLessThan(1);
    expect(result.preprocessStepResult?.changes).toBeGreaterThan(0);
  });

  it('should keep memory low on long texts', async () => {
    const original = 'lorem ipsum dolor sit amet '.repeat(200);
    const changed = original.replace(/o/g, '0');
    const inputMessages = [createTestMessage({ content: original, role: 'user', id: 'test-input' })];
    const output = [createTestMessage({ content: changed, role: 'assistant', id: 'test-output' })];

    const heapBefore = process.memoryUsage().heapUsed;
    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    const heapGrowthMB = (process.memoryUsage().heapUsed - heapBefore) / 1024 / 1024;

    // 3 of every 27 characters change, so 24/27 of each text is common
    expect(result.score).toBeCloseTo(24 / 27, 5);
    expect(heapGrowthMB).toBeLessThan(100);
  });

  it('should count changes when only the word order differs', async () => {
    const inputMessages = [createTestMessage({ content: 'dog bites man', role: 'user', id: 'test-input' })];
    const output = [createTestMessage({ content: 'man bites dog', role: 'assistant', id: 'test-output' })];

    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBeLessThan(1);
    expect(result.preprocessStepResult?.changes).toBe(2);
  });

  it('should count every change in texts with many distinct words', async () => {
    const words = Array.from({ length: 65536 }, (_, i) => `word${i}`);
    const inputMessages = [createTestMessage({ content: words.join(' '), role: 'user', id: 'test-input' })];
    const output = [createTestMessage({ content: 'word65536', role: 'assistant', id: 'test-output' })];

    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.preprocessStepResult?.changes).toBe(65536);
  });

  it('should include difference details in result', async () => {
    const inputMessages = [createTestMessage({ content: 'The quick brown fox', role: 'user', id: 'test-input' })];
    const output = [createTestMessage({ content: 'The quick brown fox', role: 'assistant', id: 'test-output' })];

    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.preprocessStepResult).toMatchObject({
      confidence: 1,
      changes: 0,
      lengthDiff: 0,
    });
  });
});
