import { describe, it, expect, beforeEach } from 'vitest';

import { createAgentTestRun, createUIMessage } from '../../utils';
import { createCompletenessScorer } from './index';

describe('CompletenessMetric', () => {
  let scorer;

  beforeEach(() => {
    scorer = createCompletenessScorer();
  });

  describe('basic functionality', () => {
    it('should return high score for identical text', async () => {
      const text = 'The quick brown fox jumps over the lazy dog';

      const inputMessages = [createUIMessage({ content: text, role: 'user', id: 'test-input' })];
      const output = [createUIMessage({ content: text, role: 'assistant', id: 'test-output' })];

      const run = createAgentTestRun({ inputMessages, output });
      const result = await scorer.run(run);
      expect(result.score).toBeCloseTo(1.0);
      expect(result.preprocessStepResult?.elementCounts).toBeDefined();
    });

    it('should return lower score for simplified text missing elements', async () => {
      const original = 'The quick brown fox jumps over the lazy dog';
      const simplified = 'The fox jumps over the dog';

      const inputMessages = [createUIMessage({ content: original, role: 'user', id: 'test-input' })];
      const output = [createUIMessage({ content: simplified, role: 'assistant', id: 'test-output' })];

      const run = createAgentTestRun({ inputMessages, output });
      const result = await scorer.run(run);

      expect(result.score).toBeLessThan(1.0);
      expect(result.score).toBeGreaterThan(0.5);

      expect(result.preprocessStepResult?.missingElements).toContain('brown');
      expect(result.preprocessStepResult?.missingElements).toContain('lazy');
    });

    it('should handle completely different texts', async () => {
      const original = 'The weather is sunny today';
      const simplified = 'I like to eat pizza';

      const inputMessages = [createUIMessage({ content: original, role: 'user', id: 'test-input' })];
      const outputMessages = [createUIMessage({ content: simplified, role: 'assistant', id: 'test-output' })];

      const run = createAgentTestRun({ inputMessages, output: outputMessages });
      const result = await scorer.run(run);

      expect(result.score).toBeLessThan(0.3);
      const { input, output } = result.preprocessStepResult?.elementCounts as { input: number; output: number };
      expect(input).toBeGreaterThan(0);
      expect(output).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle both empty strings', async () => {
      const inputMessages = [createUIMessage({ content: '', role: 'user', id: 'test-input' })];
      const outputMessages = [createUIMessage({ content: '', role: 'assistant', id: 'test-output' })];

      const run = createAgentTestRun({ inputMessages, output: outputMessages });
      const result = await scorer.run(run);
      expect(result.score).toBe(1);
      const { input, output } = result.preprocessStepResult?.elementCounts as { input: number; output: number };
      expect(input).toBe(0);
      expect(output).toBe(0);
    });

    it('should handle empty original string', async () => {
      const inputMessages = [createUIMessage({ content: '', role: 'user', id: 'test-input' })];
      const outputMessages = [createUIMessage({ content: 'some text', role: 'assistant', id: 'test-output' })];

      const run = createAgentTestRun({ inputMessages, output: outputMessages });
      const result = await scorer.run(run);
      expect(result.score).toBe(0);
    });

    it('should handle whitespace-only strings', async () => {
      const inputMessages = [createUIMessage({ content: '   \n  ', role: 'user', id: 'test-input' })];
      const outputMessages = [createUIMessage({ content: '  \n  ', role: 'assistant', id: 'test-output' })];

      const run = createAgentTestRun({ inputMessages, output: outputMessages });
      const result = await scorer.run(run);
      expect(result.score).toBe(1);
      const { input, output } = result.preprocessStepResult?.elementCounts as { input: number; output: number };
      expect(input).toBe(0);
      expect(output).toBe(0);
    });

    it('should handle null and undefined inputs', async () => {
      // @ts-expect-error Testing invalid input
      await expect(scorer.run(createAgentTestRun({ inputMessages: null, output: null }))).rejects.toThrow();
      // @ts-expect-error Testing invalid input
      await expect(scorer.run(createAgentTestRun({ inputMessages: undefined, output: undefined }))).rejects.toThrow();
    });
  });

  describe('special cases', () => {
    it('should handle lists and enumerations', async () => {
      const inputMessages = [
        createUIMessage({ content: 'apples, oranges, and bananas', role: 'user', id: 'test-input' }),
      ];
      const outputMessages = [createUIMessage({ content: 'apples and bananas', role: 'assistant', id: 'test-output' })];

      const run = createAgentTestRun({ inputMessages, output: outputMessages });
      const result = await scorer.run(run);
      expect(result.score).toBeLessThan(0.8);
      expect(result.preprocessStepResult?.missingElements).toContain('oranges');
    });

    it('should handle repeated elements', async () => {
      const inputMessages = [createUIMessage({ content: 'cat cat cat cats', role: 'user', id: 'test-input' })];
      const outputMessages = [createUIMessage({ content: 'cat cats', role: 'assistant', id: 'test-output' })];

      const run = createAgentTestRun({ inputMessages, output: outputMessages });
      const result = await scorer.run(run);
      expect(result.score).toBeGreaterThan(0.7);
    });

    it('should handle long and multi-paragraph text', async () => {
      const original = `First paragraph about AI.
        Second paragraph about ML.
        Third paragraph about DL.`;
      const simplified = `First para about AI.
        Second para about ML.`;

      const inputMessages = [createUIMessage({ content: original, role: 'user', id: 'test-input' })];
      const outputMessages = [createUIMessage({ content: simplified, role: 'assistant', id: 'test-output' })];

      const run = createAgentTestRun({ inputMessages, output: outputMessages });
      const result = await scorer.run(run);

      expect(result.score).toBeGreaterThan(0.5);
      expect(result.preprocessStepResult?.missingElements).toBeDefined();
    });
  });
});
