import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createCostEstimatorFromText, getPricingMeterForMetric } from './estimator';

const fixturePath = path.join(import.meta.dirname, '__fixtures__', 'rollup-test.jsonl');
const rollupFixture = fs.readFileSync(fixturePath, 'utf-8');
const estimator = createCostEstimatorFromText(rollupFixture);

describe('cost estimator', () => {
  it('maps token metric names to pricing meters', () => {
    expect(getPricingMeterForMetric('mastra_model_total_input_tokens')).toBe('input_tokens');
    expect(getPricingMeterForMetric('mastra_model_input_cache_read_tokens')).toBe('input_cache_read_tokens');
    expect(getPricingMeterForMetric('mastra_model_output_reasoning_tokens')).toBe('output_reasoning_tokens');
    expect(getPricingMeterForMetric('mastra_model_input_image_tokens')).toBeNull();
  });

  it('estimates base-tier cost for a matched provider and model', () => {
    const result = estimator.estimateCost({
      provider: 'openai',
      model: 'gpt-4o-mini',
      meter: 'input_tokens',
      tokenCount: 1_000,
      totalInputTokens: 1_000,
    });

    expect(result.status).toBe('ok');
    expect(result.estimatedCost).toBeCloseTo(0.00015);
    expect(result.costUnit).toBe('usd');
    expect(result.costMetadata?.pricingRowId).toBe('openai-gpt-4o-mini');
    expect(result.costMetadata?.matchedTierIndex).toBe(0);
  });

  it('selects the prompt-threshold tier when total input tokens exceed the threshold', () => {
    const result = estimator.estimateCost({
      provider: 'google',
      model: 'gemini-2-5-pro',
      meter: 'input_tokens',
      tokenCount: 1_000,
      totalInputTokens: 300_000,
    });

    expect(result.status).toBe('ok');
    expect(result.estimatedCost).toBeCloseTo(0.0025);
    expect(result.costMetadata?.matchedTierIndex).toBe(1);
  });

  it('keeps the base tier when the threshold condition does not match', () => {
    const result = estimator.estimateCost({
      provider: 'google',
      model: 'gemini-2-5-pro',
      meter: 'input_tokens',
      tokenCount: 1_000,
      totalInputTokens: 100_000,
    });

    expect(result.status).toBe('ok');
    expect(result.estimatedCost).toBeCloseTo(0.00125);
    expect(result.costMetadata?.matchedTierIndex).toBe(0);
  });

  it('estimates cache-read cost when the pricing row includes that meter', () => {
    const result = estimator.estimateMetricCost({
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
      metricName: 'mastra_model_input_cache_read_tokens',
      value: 1_000,
      totalInputTokens: 50_000,
    });

    expect(result.status).toBe('ok');
    expect(result.estimatedCost).toBeCloseTo(0.0003);
    expect(result.costUnit).toBe('usd');
  });

  it('returns no_matching_model when provider and model are not in the embedded rollup', () => {
    const result = estimator.estimateCost({
      provider: 'openai',
      model: 'definitely-not-a-real-model',
      meter: 'input_tokens',
      tokenCount: 1_000,
      totalInputTokens: 1_000,
    });

    expect(result.status).toBe('no_matching_model');
    expect(result.estimatedCost).toBeNull();
    expect(result.costUnit).toBeNull();
  });

  it('returns no_pricing_for_usage_type when a matched row does not include the requested meter', () => {
    const result = estimator.estimateCost({
      provider: 'openai',
      model: 'gpt-4o-mini',
      meter: 'output_reasoning_tokens',
      tokenCount: 100,
      totalOutputTokens: 100,
    });

    expect(result.status).toBe('no_pricing_for_usage_type');
    expect(result.estimatedCost).toBeNull();
    expect(result.costUnit).toBe('usd');
  });

  it('returns unsupported_usage_type when a metric name has no pricing-meter mapping', () => {
    const result = estimator.estimateMetricCost({
      provider: 'openai',
      model: 'gpt-4o-mini',
      metricName: 'mastra_model_input_image_tokens',
      value: 10,
      totalInputTokens: 10,
    });

    expect(result.status).toBe('unsupported_usage_type');
    expect(result.estimatedCost).toBeNull();
  });
});
