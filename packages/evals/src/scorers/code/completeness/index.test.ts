import { describe, it, expect, beforeEach } from 'vitest';

import { createTestRun } from '../../utils';
import { createCompletenessScorer } from './index';

describe('CompletenessMetric', () => {
  let scorer;

  beforeEach(() => {
    scorer = createCompletenessScorer();
  });

  describe('basic functionality', () => {
    it('should return high score for identical text', async () => {
      const text = 'The quick brown fox jumps over the lazy dog';
      const run = createTestRun(text, text);
      const result = await scorer.run(run);

      expect(result.score).toBeCloseTo(1.0);
      expect(result.extractStepResult?.elementCounts).toBeDefined();
    });

    it('should return lower score for simplified text missing elements', async () => {
      const original = 'The quick brown fox jumps over the lazy dog';
      const simplified = 'The fox jumps over the dog';
      const result = await scorer.run(createTestRun(original, simplified));

      expect(result.score).toBeLessThan(1.0);
      expect(result.score).toBeGreaterThan(0.5);
      expect(result.extractStepResult?.missingElements).toContain('brown');
      expect(result.extractStepResult?.missingElements).toContain('lazy');
    });

    it('should handle completely different texts', async () => {
      const original = 'The weather is sunny today';
      const simplified = 'I like to eat pizza';
      const result = await scorer.run(createTestRun(original, simplified));

      expect(result.score).toBeLessThan(0.3);
      const { input, output } = result.extractStepResult?.elementCounts as { input: number; output: number };
      expect(input).toBeGreaterThan(0);
      expect(output).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle both empty strings', async () => {
      const result = await scorer.run(createTestRun('', ''));
      expect(result.score).toBe(1);
      const { input, output } = result.extractStepResult?.elementCounts as { input: number; output: number };
      expect(input).toBe(0);
      expect(output).toBe(0);
    });

    it('should handle empty original string', async () => {
      const result = await scorer.run(createTestRun('', 'some text'));
      expect(result.score).toBe(0);
    });

    it('should handle whitespace-only strings', async () => {
      const result = await scorer.run(createTestRun('   \n  ', '  \n  '));
      expect(result.score).toBe(1);
      const { input, output } = result.extractStepResult?.elementCounts as { input: number; output: number };
      expect(input).toBe(0);
      expect(output).toBe(0);
    });

    it('should handle null and undefined inputs', async () => {
      // @ts-expect-error Testing invalid input
      await expect(scorer.run(createTestRun(null, ''))).rejects.toThrow();
      // @ts-expect-error Testing invalid input
      await expect(scorer.run(createTestRun('', undefined))).rejects.toThrow();
    });
  });

  describe('special cases', () => {
    it('should handle lists and enumerations', async () => {
      const result = await scorer.run(createTestRun('apples, oranges, and bananas', 'apples and bananas'));
      expect(result.score).toBeLessThan(0.8);
      expect(result.extractStepResult?.missingElements).toContain('oranges');
    });

    it('should handle repeated elements', async () => {
      const result = await scorer.run(createTestRun('cat cat cat cats', 'cat cats'));
      expect(result.score).toBeGreaterThan(0.7);
    });

    it('should handle long and multi-paragraph text', async () => {
      const original = `First paragraph about AI.
        Second paragraph about ML.
        Third paragraph about DL.`;
      const simplified = `First para about AI.
        Second para about ML.`;
      const result = await scorer.run(createTestRun(original, simplified));

      expect(result.score).toBeGreaterThan(0.5);
      expect(result.extractStepResult?.missingElements).toBeDefined();
    });
  });
});
