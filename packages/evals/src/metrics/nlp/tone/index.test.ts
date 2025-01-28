import { describe, it, expect } from 'vitest';

import { ToneConsistencyMetric } from './index';

describe('ToneConsistencyMetric', () => {
  const metric = new ToneConsistencyMetric();

  describe('tone consistency (with reference)', () => {
    it('should return perfect score for identical sentiment', async () => {
      const result = await metric.measure('I love this amazing product!', 'This product is wonderful and fantastic!');
      const metrics = result.info as { responseSentiment: number; referenceSentiment: number; difference: number };
      expect(result.score).toBeGreaterThan(0.9);
      expect(metrics.responseSentiment).toBeGreaterThan(0);
      expect(metrics.referenceSentiment).toBeGreaterThan(0);
      expect(metrics.difference).toBeLessThan(0.1);
    });

    it('should handle opposite sentiments', async () => {
      const result = await metric.measure('This is terrible and disappointing.', 'This is excellent and amazing!');
      const metrics = result.info as { responseSentiment: number; referenceSentiment: number; difference: number };
      expect(result.score).toBeLessThan(0.5);
      expect(metrics.responseSentiment).toBeLessThan(0);
      expect(metrics.referenceSentiment).toBeGreaterThan(0);
      expect(metrics.difference).toBeGreaterThan(0.5);
    });

    it('should handle neutral text', async () => {
      const result = await metric.measure('The sky is blue. The grass is green.', 'Trees are tall. Water is wet.');
      const metrics = result.info as { responseSentiment: number; referenceSentiment: number; difference: number };
      expect(result.score).toBeGreaterThan(0.9);
      expect(Math.abs(metrics.responseSentiment)).toBeLessThan(0.2);
      expect(Math.abs(metrics.referenceSentiment)).toBeLessThan(0.2);
      expect(metrics.difference!).toBeLessThan(0.1);
    });

    it('should handle mixed sentiment comparison', async () => {
      const result = await metric.measure(
        'The product has great features but some annoying bugs.',
        'While the interface is beautiful, performance is poor.',
      );
      const metrics = result.info as { responseSentiment: number; referenceSentiment: number; difference: number };
      expect(result.score).toBeGreaterThan(0.7);
      expect(Math.abs(metrics.difference)).toBeLessThan(0.3);
    });
  });

  describe('tone stability (single input)', () => {
    it('should handle consistent positive tone', async () => {
      const result = await metric.measure(
        'I love this product! It works amazingly well. The features are fantastic.',
        '',
      );
      const metrics = result.info as { avgSentiment: number; sentimentVariance: number };
      expect(result.score).toBeGreaterThan(0.8);
      expect(metrics.avgSentiment).toBeGreaterThan(0);
      expect(metrics.sentimentVariance).toBeLessThan(0.2);
    });

    it('should handle consistent negative tone', async () => {
      const result = await metric.measure('This is terrible. It never works properly. The support is awful.', '');
      const metrics = result.info as { avgSentiment: number; sentimentVariance: number };
      expect(result.score).toBeGreaterThan(0.8);
      expect(metrics.avgSentiment).toBeLessThan(0);
      expect(metrics.sentimentVariance).toBeLessThan(0.2);
    });

    it('should detect inconsistent tone', async () => {
      const result = await metric.measure(
        'This is amazing! But it has terrible flaws. Yet somehow I love it. Though it frustrates me.',
        '',
      );
      const metrics = result.info as { avgSentiment: number; sentimentVariance: number };
      expect(result.score).toBeLessThan(0.7);
      expect(metrics.sentimentVariance).toBeGreaterThan(0.2);
    });

    it('should handle single sentence', async () => {
      const result = await metric.measure('This is a great product.', '');
      const metrics = result.info as { avgSentiment: number; sentimentVariance: number };
      expect(result.score).toBe(1);
      expect(metrics.sentimentVariance).toBe(0);
    });

    it('should handle empty input', async () => {
      const result = await metric.measure('', '');
      const metrics = result.info as { avgSentiment: number; sentimentVariance: number };
      expect(result.score).toBe(1);
      expect(metrics.avgSentiment).toBe(0);
      expect(metrics.sentimentVariance).toBe(0);
    });

    it('should handle neutral consistent tone', async () => {
      const result = await metric.measure('The sky is blue. The grass is green. The tree is tall.', '');
      const metrics = result.info as { avgSentiment: number; sentimentVariance: number };
      expect(result.score).toBeGreaterThan(0.9);
      expect(Math.abs(metrics.avgSentiment)).toBeLessThan(0.2);
      expect(metrics.sentimentVariance).toBeLessThan(0.1);
    });
  });
});
