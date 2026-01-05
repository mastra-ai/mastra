import { describe, it, expect } from 'vitest';
import {
  calculateCost,
  aggregateCosts,
  formatCost,
  estimateCost,
  registerModelPricing,
  getModelPricing,
  hasPricing,
  MODEL_PRICING,
} from './cost';

describe('Cost Calculation', () => {
  describe('calculateCost', () => {
    it('should calculate cost for known OpenAI model', () => {
      const cost = calculateCost(
        { inputTokens: 1000, outputTokens: 500 },
        'gpt-4o',
        'openai',
      );

      expect(cost).toBeDefined();
      // 1000 input tokens at $2.5/1M = $0.0025
      // 500 output tokens at $10/1M = $0.005
      // Total = $0.0075
      expect(cost!.totalCostUSD).toBeCloseTo(0.0075, 6);
    });

    it('should calculate cost for Anthropic model with caching', () => {
      const cost = calculateCost(
        { inputTokens: 10000, outputTokens: 1000, cachedTokens: 8000 },
        'claude-3-5-sonnet-20241022',
        'anthropic',
      );

      expect(cost).toBeDefined();
      // 2000 non-cached input tokens at $3/1M = $0.006
      // 8000 cached tokens at $0.3/1M = $0.0024
      // 1000 output tokens at $15/1M = $0.015
      // Total = $0.0234
      expect(cost!.totalCostUSD).toBeCloseTo(0.0234, 6);
    });

    it('should calculate cost for Google Gemini model', () => {
      const cost = calculateCost(
        { inputTokens: 100000, outputTokens: 10000 },
        'gemini-2.0-flash',
        'google',
      );

      expect(cost).toBeDefined();
      // 100000 input tokens at $0.1/1M = $0.01
      // 10000 output tokens at $0.4/1M = $0.004
      // Total = $0.014
      expect(cost!.totalCostUSD).toBeCloseTo(0.014, 6);
    });

    it('should return undefined for unknown model', () => {
      const cost = calculateCost(
        { inputTokens: 1000, outputTokens: 500 },
        'unknown-model',
        'unknown-provider',
      );

      expect(cost).toBeUndefined();
    });

    it('should work with model name only (no provider)', () => {
      const cost = calculateCost(
        { inputTokens: 1000, outputTokens: 500 },
        'openai/gpt-4o-mini',
      );

      expect(cost).toBeDefined();
      // 1000 input at $0.15/1M = $0.00015
      // 500 output at $0.6/1M = $0.0003
      expect(cost!.totalCostUSD).toBeCloseTo(0.00045, 6);
    });

    it('should include cost breakdown by model', () => {
      const cost = calculateCost(
        { inputTokens: 1000, outputTokens: 500 },
        'gpt-4o',
        'openai',
      );

      expect(cost).toBeDefined();
      expect(cost!.costByModel).toBeDefined();
      expect(cost!.costByModel!['gpt-4o']).toBeCloseTo(0.0075, 6);
    });

    it('should handle zero tokens', () => {
      const cost = calculateCost(
        { inputTokens: 0, outputTokens: 0 },
        'gpt-4o',
        'openai',
      );

      expect(cost).toBeDefined();
      expect(cost!.totalCostUSD).toBe(0);
    });
  });

  describe('aggregateCosts', () => {
    it('should aggregate multiple costs', () => {
      const costs = [
        { totalCostUSD: 0.01, modelCostUSD: 0.01, costByModel: { 'gpt-4o': 0.01 } },
        { totalCostUSD: 0.02, modelCostUSD: 0.02, costByModel: { 'gpt-4o': 0.015, 'gpt-4o-mini': 0.005 } },
        { totalCostUSD: 0.005, toolCostUSD: 0.005 },
      ];

      const aggregate = aggregateCosts(costs);

      expect(aggregate.totalCostUSD).toBeCloseTo(0.035, 6);
      expect(aggregate.modelCostUSD).toBeCloseTo(0.03, 6);
      expect(aggregate.toolCostUSD).toBeCloseTo(0.005, 6);
      expect(aggregate.costByModel!['gpt-4o']).toBeCloseTo(0.025, 6);
      expect(aggregate.costByModel!['gpt-4o-mini']).toBeCloseTo(0.005, 6);
    });

    it('should handle undefined costs', () => {
      const costs = [
        { totalCostUSD: 0.01, modelCostUSD: 0.01 },
        undefined,
        { totalCostUSD: 0.02, modelCostUSD: 0.02 },
      ];

      const aggregate = aggregateCosts(costs);

      expect(aggregate.totalCostUSD).toBeCloseTo(0.03, 6);
    });

    it('should handle empty array', () => {
      const aggregate = aggregateCosts([]);

      expect(aggregate.totalCostUSD).toBe(0);
      expect(aggregate.modelCostUSD).toBe(0);
      expect(aggregate.toolCostUSD).toBe(0);
    });
  });

  describe('formatCost', () => {
    it('should format tiny costs in microdollars', () => {
      expect(formatCost(0.00005)).toBe('$50.00µ');
    });

    it('should format small costs in millidollars', () => {
      expect(formatCost(0.005)).toBe('$5.000m');
    });

    it('should format medium costs with 4 decimals', () => {
      expect(formatCost(0.1234)).toBe('$0.1234');
    });

    it('should format large costs with 2 decimals', () => {
      expect(formatCost(12.345)).toBe('$12.35');
    });
  });

  describe('estimateCost', () => {
    it('should estimate cost for known model', () => {
      const estimate = estimateCost(1000, 500, 'gpt-4o', 'openai');
      expect(estimate).toBeCloseTo(0.0075, 6);
    });

    it('should return undefined for unknown model', () => {
      const estimate = estimateCost(1000, 500, 'unknown', 'unknown');
      expect(estimate).toBeUndefined();
    });
  });

  describe('registerModelPricing', () => {
    it('should register custom pricing', () => {
      registerModelPricing('custom/my-model', {
        inputPer1M: 1.0,
        outputPer1M: 2.0,
      });

      const cost = calculateCost(
        { inputTokens: 1000000, outputTokens: 1000000 },
        'custom/my-model',
      );

      expect(cost).toBeDefined();
      expect(cost!.totalCostUSD).toBe(3.0); // $1 + $2

      // Clean up
      delete MODEL_PRICING['custom/my-model'];
    });
  });

  describe('getModelPricing', () => {
    it('should get pricing for known model', () => {
      const pricing = getModelPricing('gpt-4o', 'openai');

      expect(pricing).toBeDefined();
      expect(pricing!.inputPer1M).toBe(2.5);
      expect(pricing!.outputPer1M).toBe(10);
    });

    it('should return undefined for unknown model', () => {
      const pricing = getModelPricing('unknown-model');
      expect(pricing).toBeUndefined();
    });
  });

  describe('hasPricing', () => {
    it('should return true for known model', () => {
      expect(hasPricing('gpt-4o', 'openai')).toBe(true);
    });

    it('should return false for unknown model', () => {
      expect(hasPricing('unknown-model')).toBe(false);
    });
  });

  describe('Pricing Data Coverage', () => {
    it('should have pricing for major OpenAI models', () => {
      expect(hasPricing('openai/gpt-4o')).toBe(true);
      expect(hasPricing('openai/gpt-4o-mini')).toBe(true);
      expect(hasPricing('openai/o1')).toBe(true);
    });

    it('should have pricing for major Anthropic models', () => {
      expect(hasPricing('anthropic/claude-3-5-sonnet-20241022')).toBe(true);
      expect(hasPricing('anthropic/claude-3-opus-20240229')).toBe(true);
    });

    it('should have pricing for major Google models', () => {
      expect(hasPricing('google/gemini-2.0-flash')).toBe(true);
      expect(hasPricing('google/gemini-1.5-pro')).toBe(true);
    });
  });
});
