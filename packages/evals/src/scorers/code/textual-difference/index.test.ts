import { describe, it, expect } from 'vitest';

import { createAgentTestRun, createUIMessage } from '../../utils';
import { createTextualDifferenceScorer } from './index';

describe('TextualDifferenceMetric', () => {
  const scorer = createTextualDifferenceScorer();

  it('should return perfect match for identical strings', async () => {
    const inputMessages = [createUIMessage({ content: 'The quick brown fox', role: 'user', id: 'test-input' })];
    const output = [createUIMessage({ content: 'The quick brown fox', role: 'assistant', id: 'test-output' })];

    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBe(1);
    expect(result.preprocessStepResult).toMatchObject({
      confidence: 1,
      changes: 0,
      lengthDiff: 0,
    });
  });

  it('should handle small differences', async () => {
    const inputMessages = [createUIMessage({ content: 'The quick brown fox', role: 'user', id: 'test-input' })];
    const output = [createUIMessage({ content: 'The quick brown cat', role: 'assistant', id: 'test-output' })];

    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBeGreaterThan(0.8);
    expect(result.preprocessStepResult?.changes).toBe(1);
  });

  it('should handle word additions', async () => {
    const inputMessages = [createUIMessage({ content: 'The quick brown fox', role: 'user', id: 'test-input' })];
    const output = [createUIMessage({ content: 'The very quick brown fox', role: 'assistant', id: 'test-output' })];

    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBeGreaterThan(0.7);
    expect(result.preprocessStepResult?.changes).toBe(1);
  });

  it('should handle word deletions', async () => {
    const inputMessages = [createUIMessage({ content: 'The quick brown fox jumps', role: 'user', id: 'test-input' })];
    const output = [createUIMessage({ content: 'The quick fox jumps', role: 'assistant', id: 'test-output' })];

    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBeGreaterThan(0.7);
    expect(result.preprocessStepResult?.changes).toBe(1);
  });

  it('should handle multiple changes', async () => {
    const result = await scorer.run(
      createAgentTestRun({
        inputMessages: [
          createUIMessage({ content: 'The quick brown fox jumps over the lazy dog', role: 'user', id: 'test-input' }),
        ],
        output: [
          createUIMessage({
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
    const inputMessages = [createUIMessage({ content: 'The quick brown fox', role: 'user', id: 'test-input' })];
    const output = [createUIMessage({ content: 'Lorem ipsum dolor sit amet', role: 'assistant', id: 'test-output' })];

    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBeLessThan(0.3);
    expect(result.preprocessStepResult?.changes).toBeGreaterThan(3);
  });

  it('should handle empty strings', async () => {
    const inputMessages = [createUIMessage({ content: '', role: 'user', id: 'test-input' })];
    const output = [createUIMessage({ content: '', role: 'assistant', id: 'test-output' })];

    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBe(1);
    expect(result.preprocessStepResult?.changes).toBe(0);
    expect(result.preprocessStepResult?.lengthDiff).toBe(0);
  });

  it('should handle one empty string', async () => {
    const inputMessages = [createUIMessage({ content: 'The quick brown fox', role: 'user', id: 'test-input' })];
    const output = [createUIMessage({ content: '', role: 'assistant', id: 'test-output' })];

    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBe(0);
    expect(result.preprocessStepResult?.changes).toBeGreaterThan(0);
    expect(result.preprocessStepResult?.lengthDiff).toBe(1);
  });

  it('should handle case sensitivity', async () => {
    const inputMessages = [createUIMessage({ content: 'The Quick Brown Fox', role: 'user', id: 'test-input' })];
    const output = [createUIMessage({ content: 'the quick brown fox', role: 'assistant', id: 'test-output' })];

    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBeLessThan(1);
    expect(result.preprocessStepResult?.changes).toBeGreaterThan(0);
  });

  it('should handle whitespace sensitivity', async () => {
    const inputMessages = [createUIMessage({ content: 'The   quick\nbrown    fox', role: 'user', id: 'test-input' })];
    const output = [createUIMessage({ content: 'The quick brown fox', role: 'assistant', id: 'test-output' })];

    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.score).toBeLessThan(1);
    expect(result.preprocessStepResult?.changes).toBeGreaterThan(0);
  });

  it('should include difference details in result', async () => {
    const inputMessages = [createUIMessage({ content: 'The quick brown fox', role: 'user', id: 'test-input' })];
    const output = [createUIMessage({ content: 'The quick brown fox', role: 'assistant', id: 'test-output' })];

    const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
    expect(result.preprocessStepResult).toMatchObject({
      confidence: 1,
      changes: 0,
      lengthDiff: 0,
    });
  });
});
