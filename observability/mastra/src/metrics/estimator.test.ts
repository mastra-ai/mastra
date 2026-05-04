import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { estimateCosts } from './estimator';
import { PricingRegistry } from './pricing-registry';
import { TokenMetrics } from './types';

const fixturePath = path.join(import.meta.dirname, '__fixtures__', 'pricing-data-test.jsonl');
const pricingRegistry = PricingRegistry.fromText(fs.readFileSync(fixturePath, 'utf-8'));

describe('estimateCosts', () => {
  it('returns total-row error contexts when provider and model do not match a pricing row', () => {
    const costs = estimateCosts(
      {
        provider: 'openai',
        model: 'definitely-not-a-real-model',
        usage: {
          inputTokens: 1_000,
          outputTokens: 100,
        },
      },
      pricingRegistry,
    );

    expect(costs.get(TokenMetrics.TOTAL_INPUT)).toEqual({
      provider: 'openai',
      model: 'definitely-not-a-real-model',
      costMetadata: { error: 'no_matching_model' },
    });
    expect(costs.get(TokenMetrics.TOTAL_OUTPUT)).toEqual({
      provider: 'openai',
      model: 'definitely-not-a-real-model',
      costMetadata: { error: 'no_matching_model' },
    });
  });

  it('applies pricing lookup failures to the same detail rows auto-extract will emit', () => {
    const costs = estimateCosts(
      {
        provider: 'openai',
        model: 'definitely-not-a-real-model',
        usage: {
          inputTokens: 0,
          outputTokens: 5,
          inputDetails: {
            text: 10,
            cacheRead: 5,
          },
          outputDetails: {
            text: 5,
          },
        },
      },
      pricingRegistry,
    );

    const expectedError = {
      provider: 'openai',
      model: 'definitely-not-a-real-model',
      costMetadata: { error: 'no_matching_model' },
    };

    expect(costs.get(TokenMetrics.TOTAL_INPUT)).toEqual(expectedError);
    expect(costs.get(TokenMetrics.TOTAL_OUTPUT)).toEqual(expectedError);
    expect(costs.get(TokenMetrics.INPUT_TEXT)).toEqual(expectedError);
    expect(costs.get(TokenMetrics.INPUT_CACHE_READ)).toEqual(expectedError);
    expect(costs.get(TokenMetrics.OUTPUT_TEXT)).toEqual(expectedError);
  });

  it('uses the base tier for total input when the base tier applies', () => {
    const costs = estimateCosts(
      {
        provider: 'google',
        model: 'gemini-2-5-pro',
        usage: {
          inputTokens: 1_000,
          outputTokens: 100,
        },
      },
      pricingRegistry,
    );

    expect(costs.get(TokenMetrics.TOTAL_INPUT)).toEqual({
      provider: 'google',
      model: 'gemini-2-5-pro',
      estimatedCost: 0.00125,
      costUnit: 'USD',
      costMetadata: {
        pricing_id: 'google-gemini-2-5-pro',
        tier_index: 0,
      },
    });

    const thresholdCosts = estimateCosts(
      {
        provider: 'google',
        model: 'gemini-2-5-pro',
        usage: {
          inputTokens: 300_000,
          outputTokens: 100,
          inputDetails: {
            text: 1_000,
          },
        },
      },
      pricingRegistry,
    );

    expect(thresholdCosts.get(TokenMetrics.INPUT_TEXT)).toEqual({
      provider: 'google',
      model: 'gemini-2-5-pro',
      estimatedCost: 0.0025,
      costUnit: 'USD',
      costMetadata: {
        pricing_id: 'google-gemini-2-5-pro',
        tier_index: 1,
      },
    });
  });

  it('keeps total-row fallback when a mode has no successful detail cost rows', () => {
    const costs = estimateCosts(
      {
        provider: 'openai',
        model: 'gpt-4o-mini',
        usage: {
          inputTokens: 500,
          outputTokens: 200,
          inputDetails: {
            audio: 15,
            image: 5,
          },
          outputDetails: {
            reasoning: 30,
            audio: 10,
            image: 10,
          },
        },
      },
      pricingRegistry,
    );

    expect(costs.get(TokenMetrics.TOTAL_INPUT)?.estimatedCost).toBeCloseTo(0.000075);
    expect(costs.get(TokenMetrics.TOTAL_OUTPUT)?.estimatedCost).toBeCloseTo(0.00012);
    expect(costs.get(TokenMetrics.INPUT_AUDIO)?.costMetadata).toEqual({
      pricing_id: 'openai-gpt-4o-mini',
      tier_index: 0,
      error: 'no_pricing_for_usage_type',
    });
    expect(costs.get(TokenMetrics.OUTPUT_REASONING)?.costMetadata).toEqual({
      pricing_id: 'openai-gpt-4o-mini',
      tier_index: 0,
      error: 'no_pricing_for_usage_type',
    });
  });

  it('sums successfully priced detail rows onto totals and marks partial coverage', () => {
    const costs = estimateCosts(
      {
        provider: 'openai',
        model: 'gpt-4o-mini',
        usage: {
          inputTokens: 500,
          outputTokens: 200,
          inputDetails: {
            text: 400,
            cacheRead: 50,
            cacheWrite: 30,
            audio: 15,
            image: 5,
          },
          outputDetails: {
            text: 150,
            reasoning: 30,
            audio: 10,
            image: 10,
          },
        },
      },
      pricingRegistry,
    );

    expect(costs.get(TokenMetrics.TOTAL_INPUT)?.estimatedCost).toBeCloseTo(0.00006375);
    expect(costs.get(TokenMetrics.TOTAL_INPUT)?.costMetadata).toEqual({
      pricing_id: 'openai-gpt-4o-mini',
      tier_index: 0,
      error: 'partial_cost',
    });
    expect(costs.get(TokenMetrics.TOTAL_OUTPUT)?.estimatedCost).toBeCloseTo(0.00009);
    expect(costs.get(TokenMetrics.TOTAL_OUTPUT)?.costMetadata).toEqual({
      pricing_id: 'openai-gpt-4o-mini',
      tier_index: 0,
      error: 'partial_cost',
    });
    expect(costs.get(TokenMetrics.INPUT_TEXT)?.estimatedCost).toBeCloseTo(0.00006);
    expect(costs.get(TokenMetrics.INPUT_CACHE_READ)?.estimatedCost).toBeCloseTo(0.00000375);
    expect(costs.get(TokenMetrics.OUTPUT_TEXT)?.estimatedCost).toBeCloseTo(0.00009);
    expect(costs.get(TokenMetrics.OUTPUT_REASONING)?.costMetadata).toEqual({
      pricing_id: 'openai-gpt-4o-mini',
      tier_index: 0,
      error: 'no_pricing_for_usage_type',
    });
  });

  it('adds summed detail costs onto totals when a mode has successful detail costs', () => {
    const costs = estimateCosts(
      {
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
        usage: {
          inputTokens: 160,
          outputTokens: 40,
          inputDetails: {
            text: 120,
            cacheRead: 40,
          },
          outputDetails: {
            text: 40,
          },
        },
      },
      pricingRegistry,
    );

    expect(costs.get(TokenMetrics.TOTAL_INPUT)?.estimatedCost).toBeCloseTo(0.000372);
    expect(costs.get(TokenMetrics.TOTAL_OUTPUT)?.estimatedCost).toBeCloseTo(0.0006);
    expect(costs.get(TokenMetrics.INPUT_TEXT)?.estimatedCost).toBeCloseTo(0.00036);
    expect(costs.get(TokenMetrics.INPUT_CACHE_READ)?.estimatedCost).toBeCloseTo(0.000012);
    expect(costs.get(TokenMetrics.OUTPUT_TEXT)?.estimatedCost).toBeCloseTo(0.0006);
  });

  it('keeps zero-valued totals when aggregate counts are explicitly provided', () => {
    const costs = estimateCosts(
      {
        provider: 'openai',
        model: 'gpt-4o-mini',
        usage: {
          inputTokens: 0,
          outputTokens: 0,
        },
      },
      pricingRegistry,
    );

    expect(costs.get(TokenMetrics.TOTAL_INPUT)).toEqual({
      provider: 'openai',
      model: 'gpt-4o-mini',
      estimatedCost: 0,
      costUnit: 'USD',
      costMetadata: {
        pricing_id: 'openai-gpt-4o-mini',
        tier_index: 0,
      },
    });
    expect(costs.get(TokenMetrics.TOTAL_OUTPUT)).toEqual({
      provider: 'openai',
      model: 'gpt-4o-mini',
      estimatedCost: 0,
      costUnit: 'USD',
      costMetadata: {
        pricing_id: 'openai-gpt-4o-mini',
        tier_index: 0,
      },
    });
  });

  it('falls back to base model pricing when model name has date suffix', () => {
    // Model names like "gpt-4o-mini-2024-07-18" should match "gpt-4o-mini" pricing
    const costs = estimateCosts(
      {
        provider: 'openai',
        model: 'gpt-4o-mini-2024-07-18',
        usage: {
          inputTokens: 1_000,
          outputTokens: 100,
        },
      },
      pricingRegistry,
    );

    // The cost context reflects the matched pricing model's name (base model)
    expect(costs.get(TokenMetrics.TOTAL_INPUT)).toEqual({
      provider: 'openai',
      model: 'gpt-4o-mini',
      estimatedCost: 0.00015,
      costUnit: 'USD',
      costMetadata: {
        pricing_id: 'openai-gpt-4o-mini',
        tier_index: 0,
      },
    });
  });

  it('falls back to base model pricing when model name has dots and date suffix', () => {
    // Model names like "gpt-5.4-mini-2026-03-17" should match "gpt-5-4-mini" pricing
    // (dots converted to dashes, then date suffix stripped)
    const costs = estimateCosts(
      {
        provider: 'openai',
        model: 'gpt-4o.mini-2024-07-18',
        usage: {
          inputTokens: 1_000,
          outputTokens: 100,
        },
      },
      pricingRegistry,
    );

    // gpt-4o.mini-2024-07-18 -> gpt-4o-mini (dots to dashes, strip date)
    // Cost context reflects the matched pricing model
    expect(costs.get(TokenMetrics.TOTAL_INPUT)).toEqual({
      provider: 'openai',
      model: 'gpt-4o-mini',
      estimatedCost: 0.00015,
      costUnit: 'USD',
      costMetadata: {
        pricing_id: 'openai-gpt-4o-mini',
        tier_index: 0,
      },
    });
  });

  it('strips Anthropic-style date suffix (YYYYMMDD format)', () => {
    // Anthropic uses YYYYMMDD format: claude-sonnet-4-5-20250929
    const costs = estimateCosts(
      {
        provider: 'anthropic',
        model: 'claude-sonnet-4-5-20250929',
        usage: {
          inputTokens: 1_000,
          outputTokens: 100,
        },
      },
      pricingRegistry,
    );

    expect(costs.get(TokenMetrics.TOTAL_INPUT)).toEqual({
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
      estimatedCost: 0.003,
      costUnit: 'USD',
      costMetadata: {
        pricing_id: 'anthropic-claude-sonnet-4-5',
        tier_index: 0,
      },
    });
  });

  it('strips Anthropic-style date suffix with trailing suffix (e.g., -thinking)', () => {
    // Anthropic sometimes has suffixes after the date: claude-sonnet-4-5-20250929-thinking
    const costs = estimateCosts(
      {
        provider: 'anthropic',
        model: 'claude-sonnet-4-5-20250929-thinking',
        usage: {
          inputTokens: 1_000,
          outputTokens: 100,
        },
      },
      pricingRegistry,
    );

    // Should strip date but keep -thinking suffix for lookup
    // Falls back to claude-sonnet-4-5 since claude-sonnet-4-5-thinking isn't in fixture
    // But the stripping produces claude-sonnet-4-5-thinking, which won't match
    // So it should fail to find the model
    expect(costs.get(TokenMetrics.TOTAL_INPUT)?.costMetadata).toEqual({
      error: 'no_matching_model',
    });
  });
});
