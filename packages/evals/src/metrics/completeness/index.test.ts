import { CompletenessMetric } from './index';

describe('CompletenessMetric', () => {
  let metric: CompletenessMetric;

  beforeEach(() => {
    metric = new CompletenessMetric();
  });

  describe('basic functionality', () => {
    it('should return high score for identical text', async () => {
      const text = 'The quick brown fox jumps over the lazy dog';
      const result = await metric.measure({ input: text, output: text });

      expect(result.score).toBeCloseTo(1.0);
      expect(result.confidence).toBe(0.8);
    });

    it('should return lower score for simplified text missing elements', async () => {
      const original = 'The quick brown fox jumps over the lazy dog';
      const simplified = 'The fox jumps over the dog';
      const result = await metric.measure({ input: original, output: simplified });

      expect(result.score).toBeLessThan(1.0);
      expect(result.score).toBeGreaterThan(0.5);
      expect(result.metrics?.missingElements).toContain('brown');
      expect(result.metrics?.missingElements).toContain('lazy');
    });

    it('should handle completely different texts', async () => {
      const original = 'The weather is sunny today';
      const simplified = 'I like to eat pizza';
      const result = await metric.measure({ input: original, output: simplified });

      expect(result.score).toBeLessThan(0.3);
      const { input, output } = result.metrics?.elementCounts as { input: number; output: number };
      expect(input).toBeGreaterThan(0);
      expect(output).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle both empty strings', async () => {
      const result = await metric.measure({ input: '', output: '' });
      expect(result.score).toBe(1);
      const { input, output } = result.metrics?.elementCounts as { input: number; output: number };
      expect(input).toBe(0);
      expect(output).toBe(0);
    });

    it('should handle empty original string', async () => {
      const result = await metric.measure({ input: '', output: 'some text' });
      expect(result.score).toBe(0);
    });

    it('should handle whitespace-only strings', async () => {
      const result = await metric.measure({ input: '   \n  ', output: '  \n  ' });
      expect(result.score).toBe(1);
      const { input, output } = result.metrics?.elementCounts as { input: number; output: number };
      expect(input).toBe(0);
      expect(output).toBe(0);
    });

    it('should handle null and undefined inputs', async () => {
      // @ts-expect-error Testing invalid input
      await expect(metric.measure({ input: null, output: '' })).rejects.toThrow();
      // @ts-expect-error Testing invalid input
      await expect(metric.measure({ input: '', output: undefined })).rejects.toThrow();
    });
  });

  describe('special cases', () => {
    it('should handle lists and enumerations', async () => {
      const result = await metric.measure({ input: 'apples, oranges, and bananas', output: 'apples and bananas' });
      expect(result.score).toBeLessThan(0.8);
      expect(result.metrics?.missingElements).toContain('oranges');
    });

    it('should handle repeated elements', async () => {
      const result = await metric.measure({ input: 'cat cat cat cats', output: 'cat cats' });
      expect(result.score).toBeGreaterThan(0.7);
    });

    it('should handle long and multi-paragraph text', async () => {
      const original = `First paragraph about AI.
        Second paragraph about ML.
        Third paragraph about DL.`;
      const simplified = `First para about AI.
        Second para about ML.`;
      const result = await metric.measure({ input: original, output: simplified });

      expect(result.score).toBeGreaterThan(0.5);
      expect(result.metrics?.missingElements).toBeDefined();
    });
  });
});
