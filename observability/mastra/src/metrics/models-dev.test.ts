import { describe, expect, it } from 'vitest';
import { estimateCosts } from './estimator';
import { modelsDevToPricingRows } from './models-dev';
import { PricingRegistry } from './pricing-registry';
import { TokenMetrics } from './types';

function registryFrom(catalog: unknown): PricingRegistry {
  return PricingRegistry.fromText(
    modelsDevToPricingRows(catalog)
      .map(row => JSON.stringify(row))
      .join('\n'),
  );
}

describe('modelsDevToPricingRows', () => {
  it('converts models.dev prices per 1M tokens into per-token meter rates', () => {
    const [row] = modelsDevToPricingRows({
      openai: {
        models: {
          'gpt-6-luna': {
            cost: {
              input: 0.1,
              output: 0.5,
              cache_read: 0.01,
              cache_write: 0.125,
              reasoning: 0.4,
              input_audio: 3,
              output_audio: 6,
            },
          },
        },
      },
    });

    expect(row).toEqual({
      i: 'e07d69e66a4bdabd',
      p: 'openai',
      m: 'gpt-6-luna',
      s: {
        v: 'model_pricing/v1',
        d: {
          u: 'USD',
          t: [
            {
              r: {
                it: { c: 1e-7 },
                ot: { c: 5e-7 },
                icrt: { c: 1e-8 },
                icwt: { c: 1.25e-7 },
                ort: { c: 4e-7 },
                iat: { c: 3e-6 },
                oat: { c: 6e-6 },
              },
            },
          ],
        },
      },
    });
  });

  it('drops zero prices and models without both input and output prices', () => {
    const rows = modelsDevToPricingRows({
      openrouter: {
        models: {
          'free/model': { cost: { input: 0, output: 0 } },
          'paid/model': { cost: { input: 1, output: 2, cache_read: 0 } },
          'input-only': { cost: { input: 1 } },
          'no-cost': {},
          broken: 'not a model',
        },
      },
      'not-a-provider': 42,
    });

    expect(rows.map(row => row.m)).toEqual(['paid-model']);
    expect(rows[0]!.s.d.t[0]!.r).toEqual({ it: { c: 1e-6 }, ot: { c: 2e-6 } });
  });

  it('uses the highest matching context tier, starting at the tier size', () => {
    const registry = registryFrom({
      anthropic: {
        models: {
          'claude-tiered': {
            cost: {
              input: 1,
              output: 5,
              tiers: [
                { input: 2, output: 10, tier: { type: 'context', size: 200_000 } },
                { input: 4, output: 20, tier: { type: 'context', size: 1_000_000 } },
              ],
            },
          },
        },
      },
    });
    const inputRate = (inputTokens: number) =>
      ((estimateCosts(
        { provider: 'anthropic', model: 'claude-tiered', usage: { inputTokens, outputTokens: 0 } },
        registry,
      ).get(TokenMetrics.TOTAL_INPUT)?.estimatedCost ?? 0) /
        inputTokens) *
      1_000_000;

    expect(inputRate(199_999)).toBeCloseTo(1);
    expect(inputRate(200_000)).toBeCloseTo(2);
    expect(inputRate(999_999)).toBeCloseTo(2);
    expect(inputRate(1_000_000)).toBeCloseTo(4);
  });

  it('keeps exact ids ahead of aliases built from dated ids', () => {
    const registry = registryFrom({
      openai: {
        models: {
          'gpt-4o': { cost: { input: 2.5, output: 10 } },
          'gpt-4o-2024-05-13': { cost: { input: 5, output: 15 } },
          'o3-pro-2025-06-10': { cost: { input: 20, output: 80 } },
        },
      },
    });

    expect(registry.get({ provider: 'openai', model: 'gpt-4o' })?.tiers[0]?.rates.input_tokens).toBe(2.5e-6);
    expect(registry.get({ provider: 'openai', model: 'gpt-4o-2024-05-13' })?.tiers[0]?.rates.input_tokens).toBe(5e-6);
    // Only the dated id exists, so the undated alias points at it.
    expect(registry.get({ provider: 'openai', model: 'o3-pro' })?.tiers[0]?.rates.input_tokens).toBe(2e-5);
  });

  it('adds Bedrock aliases without region, vendor and version parts, preferring the shortest id', () => {
    const registry = registryFrom({
      'amazon-bedrock': {
        models: {
          'us.anthropic.claude-sonnet-4-5-20250929-v1:0': { cost: { input: 3.3, output: 16.5 } },
          'anthropic.claude-sonnet-4-5-20250929-v1:0': { cost: { input: 3, output: 15 } },
        },
      },
    });

    expect(
      registry.get({ provider: 'amazon-bedrock', model: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0' })?.tiers[0]
        ?.rates.input_tokens,
    ).toBe(3.3e-6);
    expect(registry.get({ provider: 'amazon-bedrock', model: 'claude-sonnet-4-5' })?.tiers[0]?.rates.input_tokens).toBe(
      3e-6,
    );
  });

  it('matches runtime provider ids from the AI SDK and the model router', () => {
    const registry = registryFrom({
      'fireworks-ai': { models: { 'accounts/fireworks/models/kimi-k2p5': { cost: { input: 0.6, output: 3 } } } },
      openrouter: { models: { 'anthropic/claude-sonnet-4.5': { cost: { input: 3, output: 15 } } } },
    });

    // @ai-sdk/fireworks reports `fireworks.chat`; the model router reports `fireworks-ai`.
    expect(registry.get({ provider: 'fireworks.chat', model: 'accounts/fireworks/models/kimi-k2p5' })).not.toBeNull();
    expect(registry.get({ provider: 'fireworks-ai', model: 'accounts/fireworks/models/kimi-k2p5' })).not.toBeNull();
    expect(registry.get({ provider: 'openrouter', model: 'anthropic/claude-sonnet-4.5' })).not.toBeNull();
  });
});
