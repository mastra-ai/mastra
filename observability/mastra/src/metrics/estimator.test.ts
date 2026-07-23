import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { estimateCosts } from './estimator';
import { PricingRegistry } from './pricing-registry';
import { TokenMetrics } from './types';

const fixturePath = path.join(import.meta.dirname, '__fixtures__', 'pricing-data-test.jsonl');
const pricingRegistry = PricingRegistry.fromText(fs.readFileSync(fixturePath, 'utf-8'));
const embeddedPricingPath = path.join(import.meta.dirname, 'pricing-data.jsonl');
const embeddedPricingRegistry = PricingRegistry.fromText(fs.readFileSync(embeddedPricingPath, 'utf-8'));

describe('estimateCosts', () => {
  it.each([
    ['gpt-5.6', '02673ef8836dfa48', 0.005, 0.0005, 0.00625, 0.03, 0.00001, 0.000045],
    ['gpt-5.6-sol', '20d0cde775d1441d', 0.005, 0.0005, 0.00625, 0.03, 0.00001, 0.000045],
    ['gpt-5.6-terra', 'd39bbd4dbe73180a', 0.0025, 0.00025, 0.003125, 0.015, 0.000005, 0.0000225],
    ['gpt-5.6-luna', '3ad0e58759c048c0', 0.001, 0.0001, 0.00125, 0.006, 0.000002, 0.000009],
  ])(
    'estimates embedded OpenAI pricing for %s',
    (
      model,
      pricingId,
      inputCost,
      cacheReadCost,
      cacheWriteCost,
      outputCost,
      longContextInputRate,
      longContextOutputRate,
    ) => {
      const costs = estimateCosts(
        {
          provider: 'openai',
          model,
          usage: {
            inputTokens: 3_000,
            outputTokens: 1_000,
            inputDetails: { text: 1_000, cacheRead: 1_000, cacheWrite: 1_000 },
            outputDetails: { text: 1_000 },
          },
        },
        embeddedPricingRegistry,
      );

      expect(costs.get(TokenMetrics.INPUT_TEXT)?.estimatedCost).toBeCloseTo(inputCost);
      expect(costs.get(TokenMetrics.INPUT_CACHE_READ)?.estimatedCost).toBeCloseTo(cacheReadCost);
      expect(costs.get(TokenMetrics.INPUT_CACHE_WRITE)?.estimatedCost).toBeCloseTo(cacheWriteCost);
      expect(costs.get(TokenMetrics.OUTPUT_TEXT)?.estimatedCost).toBeCloseTo(outputCost);
      expect(costs.get(TokenMetrics.TOTAL_INPUT)?.costMetadata).toEqual({ pricing_id: pricingId, tier_index: 0 });

      const longContextCosts = estimateCosts(
        {
          provider: 'openai',
          model,
          usage: { inputTokens: 272_001, outputTokens: 1_000 },
        },
        embeddedPricingRegistry,
      );

      expect(longContextCosts.get(TokenMetrics.TOTAL_INPUT)?.estimatedCost).toBeCloseTo(272_001 * longContextInputRate);
      expect(longContextCosts.get(TokenMetrics.TOTAL_OUTPUT)?.estimatedCost).toBeCloseTo(1_000 * longContextOutputRate);
      expect(longContextCosts.get(TokenMetrics.TOTAL_INPUT)?.costMetadata).toEqual({
        pricing_id: pricingId,
        tier_index: 1,
      });
    },
  );

  it.each([
    ['claude-fable-5', '00de3426817c9886', 0.01, 0.001, 0.0125, 0.05],
    ['claude-opus-4-8', '93c628c3a9d22500', 0.005, 0.0005, 0.00625, 0.025],
    ['claude-sonnet-5', '916837951831cfe5', 0.002, 0.0002, 0.0025, 0.01],
  ])(
    'estimates embedded Anthropic pricing for %s',
    (model, pricingId, inputCost, cacheReadCost, cacheWriteCost, outputCost) => {
      const costs = estimateCosts(
        {
          provider: 'anthropic',
          model,
          usage: {
            inputTokens: 3_000,
            outputTokens: 1_000,
            inputDetails: { text: 1_000, cacheRead: 1_000, cacheWrite: 1_000 },
            outputDetails: { text: 1_000 },
          },
        },
        embeddedPricingRegistry,
      );

      expect(costs.get(TokenMetrics.INPUT_TEXT)?.estimatedCost).toBeCloseTo(inputCost);
      expect(costs.get(TokenMetrics.INPUT_CACHE_READ)?.estimatedCost).toBeCloseTo(cacheReadCost);
      expect(costs.get(TokenMetrics.INPUT_CACHE_WRITE)?.estimatedCost).toBeCloseTo(cacheWriteCost);
      expect(costs.get(TokenMetrics.OUTPUT_TEXT)?.estimatedCost).toBeCloseTo(outputCost);
      expect(costs.get(TokenMetrics.TOTAL_INPUT)?.costMetadata).toEqual({ pricing_id: pricingId, tier_index: 0 });
    },
  );

  it('estimates embedded Google pricing for gemini-3.5-flash', () => {
    const costs = estimateCosts(
      {
        provider: 'google',
        model: 'gemini-3.5-flash',
        usage: {
          inputTokens: 2_000,
          outputTokens: 1_000,
          inputDetails: { text: 1_000, cacheRead: 1_000 },
          outputDetails: { text: 1_000 },
        },
      },
      embeddedPricingRegistry,
    );

    expect(costs.get(TokenMetrics.INPUT_TEXT)?.estimatedCost).toBeCloseTo(0.0015);
    expect(costs.get(TokenMetrics.INPUT_CACHE_READ)?.estimatedCost).toBeCloseTo(0.00015);
    expect(costs.get(TokenMetrics.OUTPUT_TEXT)?.estimatedCost).toBeCloseTo(0.009);
    expect(costs.get(TokenMetrics.TOTAL_INPUT)?.costMetadata).toEqual({
      pricing_id: 'f13bc1ec3f88b97d',
      tier_index: 0,
    });
  });

  it.each([
    ['grok-4.5', 'ec1c2a95e38faa9b', 0.002, 0.0003, 0.006, 0.000004, 0.0000006, 0.000012],
    ['grok-build-0.1', 'd03e4214108e83a2', 0.001, 0.0002, 0.002, 0.000002, 0.0000004, 0.000004],
  ])(
    'estimates embedded xAI pricing for %s',
    (model, pricingId, inputCost, cacheReadCost, outputCost, longInputRate, longCacheReadRate, longOutputRate) => {
      const costs = estimateCosts(
        {
          provider: 'xai',
          model,
          usage: {
            inputTokens: 2_000,
            outputTokens: 1_000,
            inputDetails: { text: 1_000, cacheRead: 1_000 },
            outputDetails: { text: 1_000 },
          },
        },
        embeddedPricingRegistry,
      );

      expect(costs.get(TokenMetrics.INPUT_TEXT)?.estimatedCost).toBeCloseTo(inputCost);
      expect(costs.get(TokenMetrics.INPUT_CACHE_READ)?.estimatedCost).toBeCloseTo(cacheReadCost);
      expect(costs.get(TokenMetrics.OUTPUT_TEXT)?.estimatedCost).toBeCloseTo(outputCost);
      expect(costs.get(TokenMetrics.TOTAL_INPUT)?.costMetadata).toEqual({ pricing_id: pricingId, tier_index: 0 });

      const longContextCosts = estimateCosts(
        {
          provider: 'xai',
          model,
          usage: {
            inputTokens: 201_000,
            outputTokens: 1_000,
            inputDetails: { text: 200_000, cacheRead: 1_000 },
            outputDetails: { text: 1_000 },
          },
        },
        embeddedPricingRegistry,
      );

      expect(longContextCosts.get(TokenMetrics.INPUT_TEXT)?.estimatedCost).toBeCloseTo(200_000 * longInputRate);
      expect(longContextCosts.get(TokenMetrics.INPUT_CACHE_READ)?.estimatedCost).toBeCloseTo(1_000 * longCacheReadRate);
      expect(longContextCosts.get(TokenMetrics.OUTPUT_TEXT)?.estimatedCost).toBeCloseTo(1_000 * longOutputRate);
      expect(longContextCosts.get(TokenMetrics.TOTAL_INPUT)?.costMetadata).toEqual({
        pricing_id: pricingId,
        tier_index: 1,
      });
    },
  );

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

  it('resolves OpenRouter "vendor/model" ids when pricing data keeps the vendor prefix', () => {
    // OpenRouter reports model ids with a slash separator, but pricing entries
    // flatten them with a dash (e.g. "xiaomi/mimo-v2-pro" → "xiaomi-mimo-v2-pro").
    const costs = estimateCosts(
      {
        provider: 'openrouter',
        model: 'xiaomi/mimo-v2-pro-20260318',
        usage: {
          inputTokens: 1_000,
          outputTokens: 100,
        },
      },
      pricingRegistry,
    );

    expect(costs.get(TokenMetrics.TOTAL_INPUT)).toEqual({
      provider: 'openrouter',
      model: 'xiaomi-mimo-v2-pro',
      estimatedCost: 0.001,
      costUnit: 'USD',
      costMetadata: {
        pricing_id: 'openrouter-xiaomi-mimo-v2-pro',
        tier_index: 0,
      },
    });
  });

  it('resolves OpenRouter "vendor/model" ids when pricing data drops the vendor prefix', () => {
    // Some OpenRouter pricing rows omit the vendor prefix entirely
    // (e.g. "openai/gpt-5-mini" is stored as "gpt-5-mini").
    const costs = estimateCosts(
      {
        provider: 'openrouter',
        model: 'openai/gpt-5-mini-2025-08-07',
        usage: {
          inputTokens: 1_000,
          outputTokens: 100,
        },
      },
      pricingRegistry,
    );

    expect(costs.get(TokenMetrics.TOTAL_INPUT)).toEqual({
      provider: 'openrouter',
      model: 'gpt-5-mini',
      estimatedCost: 0.00025,
      costUnit: 'USD',
      costMetadata: {
        pricing_id: 'openrouter-gpt-5-mini',
        tier_index: 0,
      },
    });
  });

  it('resolves OpenRouter "vendor/model" ids whose version contains a dot', () => {
    // OpenRouter keeps the dotted version in the route id (e.g.
    // "google/gemini-2.5-flash"), but pricing keys flatten dots to dashes
    // ("gemini-2-5-flash"). The vendor-stripped id must be dot-flattened too.
    const costs = estimateCosts(
      {
        provider: 'openrouter',
        model: 'google/gemini-2.5-flash',
        usage: {
          inputTokens: 1_000,
          outputTokens: 100,
        },
      },
      pricingRegistry,
    );

    expect(costs.get(TokenMetrics.TOTAL_INPUT)).toEqual({
      provider: 'openrouter',
      model: 'gemini-2-5-flash',
      estimatedCost: 0.001,
      costUnit: 'USD',
      costMetadata: {
        pricing_id: 'openrouter-gemini-2-5-flash',
        tier_index: 0,
      },
    });
  });

  it.each([
    ['anthropic/claude-haiku-4.5', 'vercel-claude-haiku-4-5', 0.001],
    ['amazon/nova-micro', 'vercel-amazon-nova-micro', 0.000035],
  ])('resolves Vercel AI Gateway model id %s against Vercel pricing', (model, pricingId, estimatedCost) => {
    const costs = estimateCosts(
      {
        provider: 'gateway',
        model,
        usage: { inputTokens: 1_000 },
      },
      pricingRegistry,
    );

    expect(costs.get(TokenMetrics.TOTAL_INPUT)).toMatchObject({
      provider: 'vercel',
      costMetadata: { pricing_id: pricingId },
    });
    expect(costs.get(TokenMetrics.TOTAL_INPUT)?.estimatedCost).toBeCloseTo(estimatedCost);
  });

  it.each(['claude-haiku-4.5', ' /claude-haiku-4.5', 'anthropic/claude/haiku-4.5'])(
    'does not treat invalid Gateway model id %s as Vercel pricing',
    model => {
      const costs = estimateCosts(
        {
          provider: 'gateway',
          model,
          usage: { inputTokens: 1_000 },
        },
        pricingRegistry,
      );

      expect(costs.get(TokenMetrics.TOTAL_INPUT)).toEqual({
        provider: 'gateway',
        model,
        costMetadata: { error: 'no_matching_model' },
      });
    },
  );

  it('prefers exact Gateway pricing before the Vercel fallback', () => {
    const registry = PricingRegistry.fromText(`
{"i":"gateway-openai-gpt-4o-mini","p":"gateway","m":"openai/gpt-4o-mini","s":{"v":"model_pricing/v1","d":{"u":"USD","t":[{"r":{"it":{"c":2e-7}}}]}}}
{"i":"vercel-gpt-4o-mini","p":"vercel","m":"gpt-4o-mini","s":{"v":"model_pricing/v1","d":{"u":"USD","t":[{"r":{"it":{"c":1.5e-7}}}]}}}
`);
    const costs = estimateCosts(
      {
        provider: 'gateway',
        model: 'openai/gpt-4o-mini',
        usage: { inputTokens: 1_000 },
      },
      registry,
    );

    expect(costs.get(TokenMetrics.TOTAL_INPUT)).toMatchObject({
      provider: 'gateway',
      model: 'openai/gpt-4o-mini',
      costMetadata: { pricing_id: 'gateway-openai-gpt-4o-mini' },
    });
    expect(costs.get(TokenMetrics.TOTAL_INPUT)?.estimatedCost).toBeCloseTo(0.0002);
  });

  it.each([
    ['openai.chat', 'gpt-4o-mini', 'openai', 'openai-gpt-4o-mini'],
    ['google.generative-ai', 'gemini-2.0-flash', 'google', 'google-gemini-2-0-flash'],
  ])('falls back from AI SDK provider %s to %s pricing', (provider, model, pricingProvider, pricingId) => {
    const costs = estimateCosts(
      {
        provider,
        model,
        usage: { inputTokens: 1_000 },
      },
      pricingRegistry,
    );

    expect(costs.get(TokenMetrics.TOTAL_INPUT)).toMatchObject({
      provider: pricingProvider,
      costMetadata: { pricing_id: pricingId },
    });
  });

  it.each([
    ['google.vertex.chat', 'gemini-2.0-flash', 'google-vertex', 'google-vertex-gemini-2-0-flash', 0.00015],
    ['vertex.maas.chat', 'deepseek-ai/deepseek-v3.1-maas', 'google-vertex', 'google-vertex-deepseek-v3-1-maas', 0.0006],
    [
      'vertex.anthropic.messages',
      'claude-sonnet-4-5@20250929',
      'google-vertex-anthropic',
      'google-vertex-anthropic-claude-sonnet-4-5',
      0.003,
    ],
  ])('resolves AI SDK provider %s against %s pricing', (provider, model, pricingProvider, pricingId, estimatedCost) => {
    const costs = estimateCosts(
      {
        provider,
        model,
        usage: { inputTokens: 1_000 },
      },
      pricingRegistry,
    );

    expect(costs.get(TokenMetrics.TOTAL_INPUT)).toMatchObject({
      provider: pricingProvider,
      costMetadata: { pricing_id: pricingId },
    });
    expect(costs.get(TokenMetrics.TOTAL_INPUT)?.estimatedCost).toBeCloseTo(estimatedCost);
  });

  it('does not fall back from Google Vertex to direct Google pricing', () => {
    const costs = estimateCosts(
      {
        provider: 'google.vertex.chat',
        model: 'gemini-2.5-pro',
        usage: { inputTokens: 1_000 },
      },
      pricingRegistry,
    );

    expect(costs.get(TokenMetrics.TOTAL_INPUT)).toEqual({
      provider: 'google.vertex.chat',
      model: 'gemini-2.5-pro',
      costMetadata: { error: 'no_matching_model' },
    });
  });

  it('resolves Bedrock inference-profile ids and prices all Anthropic token meters', () => {
    const costs = estimateCosts(
      {
        provider: 'amazon-bedrock',
        model: 'us.anthropic.claude-sonnet-4-6',
        usage: {
          inputTokens: 1_150,
          outputTokens: 100,
          inputDetails: { text: 1_000, cacheRead: 100, cacheWrite: 50 },
          outputDetails: { text: 100 },
        },
      },
      pricingRegistry,
    );

    const expectedCosts = new Map([
      [TokenMetrics.INPUT_TEXT, 0.0033],
      [TokenMetrics.INPUT_CACHE_READ, 0.000033],
      [TokenMetrics.INPUT_CACHE_WRITE, 0.00020625],
      [TokenMetrics.OUTPUT_TEXT, 0.00165],
    ]);
    for (const [metric, estimatedCost] of expectedCosts) {
      expect(costs.get(metric)).toMatchObject({
        provider: 'amazon-bedrock',
        model: 'claude-sonnet-4-6',
        costMetadata: { pricing_id: 'amazon-bedrock-claude-sonnet-4-6' },
      });
      expect(costs.get(metric)?.estimatedCost).toBeCloseTo(estimatedCost);
    }
  });

  it.each([
    ['anthropic.claude-sonnet-4-6-v1', 'amazon-bedrock-claude-sonnet-4-6', 0.0033],
    ['global.anthropic.claude-sonnet-4-5-20250929-v1:0', 'amazon-bedrock-claude-sonnet-4-5', 0.003],
    ['jp.anthropic.claude-sonnet-4-5-20250929-v1:0', 'amazon-bedrock-claude-sonnet-4-5', 0.003],
    ['au.anthropic.claude-sonnet-4-5-20250929-v1:0', 'amazon-bedrock-claude-sonnet-4-5', 0.003],
    ['us.amazon.nova-pro-v1:0', 'amazon-bedrock-amazon-nova-pro', 0.0008],
  ])('resolves Bedrock model id %s', (model, pricingId, estimatedCost) => {
    const costs = estimateCosts(
      {
        provider: 'amazon-bedrock',
        model,
        usage: { inputTokens: 1_000 },
      },
      pricingRegistry,
    );

    expect(costs.get(TokenMetrics.TOTAL_INPUT)).toMatchObject({
      provider: 'amazon-bedrock',
      costMetadata: { pricing_id: pricingId },
    });
    expect(costs.get(TokenMetrics.TOTAL_INPUT)?.estimatedCost).toBeCloseTo(estimatedCost);
  });
});
