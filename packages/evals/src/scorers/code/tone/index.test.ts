import { describe, it, expect } from 'vitest';

import { createAgentTestRun, createUIMessage } from '../../utils';
import { createToneScorer } from './index';

describe('ToneConsistencyMetric', () => {
  describe('tone consistency (with reference)', () => {
    it('should return perfect score for identical sentiment', async () => {
      const scorer = createToneScorer({
        referenceTone: 'This product is wonderful and fantastic!',
      });

      const output = [
        createUIMessage({ content: 'I love this amazing product!', role: 'assistant', id: 'test-output' }),
      ];

      const result = await scorer.run(createAgentTestRun({ output }));

      const metrics = result.preprocessStepResult;
      expect(result.score).toBeGreaterThan(0.9);
      expect(metrics?.responseSentiment).toBeGreaterThan(0);
      expect(metrics?.referenceSentiment).toBeGreaterThan(0);
      expect(metrics?.difference).toBeLessThan(0.1);
    });

    it('should handle opposite sentiments', async () => {
      const scorer = createToneScorer({
        referenceTone: 'This is excellent and amazing!',
      });

      const output = [
        createUIMessage({ content: 'This is terrible and disappointing.', role: 'assistant', id: 'test-output' }),
      ];

      const result = await scorer.run(createAgentTestRun({ output }));
      const metrics = result.preprocessStepResult;
      expect(result.score).toBeLessThan(0.5);
      expect(metrics?.responseSentiment).toBeLessThan(0);
      expect(metrics?.referenceSentiment).toBeGreaterThan(0);
      expect(metrics?.difference).toBeGreaterThan(0.5);
    });

    it('should handle neutral text', async () => {
      const scorer = createToneScorer({
        referenceTone: 'Trees are tall. Water is wet.',
      });

      const output = [
        createUIMessage({ content: 'The sky is blue. The grass is green.', role: 'assistant', id: 'test-output' }),
      ];

      const result = await scorer.run(createAgentTestRun({ output }));
      const metrics = result.preprocessStepResult;
      expect(result.score).toBeGreaterThan(0.9);
      expect(Math.abs(metrics?.responseSentiment || 0)).toBeLessThan(0.2);
      expect(Math.abs(metrics?.referenceSentiment || 0)).toBeLessThan(0.2);
      expect(metrics?.difference!).toBeLessThan(0.1);
    });

    it('should handle mixed sentiment comparison', async () => {
      const scorer = createToneScorer({
        referenceTone: 'While the interface is beautiful, performance is poor.',
      });

      const output = [
        createUIMessage({
          content: 'The product has great features but some annoying bugs.',
          role: 'assistant',
          id: 'test-output',
        }),
      ];

      const result = await scorer.run(createAgentTestRun({ output }));
      const metrics = result.preprocessStepResult;
      expect(result.score).toBeGreaterThan(0.7);
      expect(Math.abs(metrics?.difference || 0)).toBeLessThan(0.3);
    });
  });

  describe('tone stability (single input)', () => {
    it('should handle consistent positive tone', async () => {
      const scorer = createToneScorer();
      const output = [
        createUIMessage({
          content: 'I love this product! It works amazingly well. The features are fantastic.',
          role: 'assistant',
          id: 'test-output',
        }),
      ];

      const result = await scorer.run(createAgentTestRun({ output }));
      const metrics = result.preprocessStepResult;
      expect(result.score).toBeGreaterThan(0.8);
      expect(metrics?.avgSentiment).toBeGreaterThan(0);
      expect(metrics?.sentimentVariance).toBeLessThan(0.2);
    });

    it('should handle consistent negative tone', async () => {
      const scorer = createToneScorer();
      const output = [
        createUIMessage({
          content: 'This is terrible. It never works properly. The support is awful.',
          role: 'assistant',
          id: 'test-output',
        }),
      ];

      const result = await scorer.run(createAgentTestRun({ output }));
      const metrics = result.preprocessStepResult;
      expect(result.score).toBeGreaterThan(0.8);
      expect(metrics?.avgSentiment).toBeLessThan(0);
      expect(metrics?.sentimentVariance).toBeLessThan(0.2);
    });

    it('should detect inconsistent tone', async () => {
      const scorer = createToneScorer();
      const output = [
        createUIMessage({
          content: 'This is amazing! But it has terrible flaws. Yet somehow I love it. Though it frustrates me.',
          role: 'assistant',
          id: 'test-output',
        }),
      ];

      const result = await scorer.run(createAgentTestRun({ output }));

      const metrics = result.preprocessStepResult;
      expect(result.score).toBeLessThan(0.7);
      expect(metrics?.sentimentVariance).toBeGreaterThan(0.2);
    });

    it('should handle single sentence', async () => {
      const scorer = createToneScorer();
      const output = [createUIMessage({ content: 'This is a great product.', role: 'assistant', id: 'test-output' })];

      const result = await scorer.run(createAgentTestRun({ output }));
      const metrics = result.preprocessStepResult;
      expect(result.score).toBe(1);
      expect(metrics?.sentimentVariance).toBe(0);
    });

    it('should handle empty input', async () => {
      const scorer = createToneScorer();
      const output = [createUIMessage({ content: '', role: 'assistant', id: 'test-output' })];

      const result = await scorer.run(createAgentTestRun({ output }));
      const metrics = result.preprocessStepResult;
      expect(result.score).toBe(1);
      expect(metrics?.avgSentiment).toBe(0);
      expect(metrics?.sentimentVariance).toBe(0);
    });

    it('should handle neutral consistent tone', async () => {
      const scorer = createToneScorer();
      const output = [
        createUIMessage({
          content: 'The sky is blue. The grass is green. The tree is tall.',
          role: 'assistant',
          id: 'test-output',
        }),
      ];

      const result = await scorer.run(createAgentTestRun({ output }));
      const metrics = result.preprocessStepResult;
      expect(result.score).toBeGreaterThan(0.9);
      expect(Math.abs(metrics?.avgSentiment || 0)).toBeLessThan(0.2);
      expect(metrics?.sentimentVariance).toBeLessThan(0.1);
    });
  });
});
