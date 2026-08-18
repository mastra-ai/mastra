import { describe, expect, it } from 'vitest';
import { deriveCostUsd, latestPrices, priceFor, type ModelPriceRow } from './pricing';

const price = (over: Partial<ModelPriceRow> = {}): ModelPriceRow => ({
  provider: 'openai',
  model: 'gpt-4o-mini',
  currency: 'USD',
  version: 1,
  validFrom: new Date('2026-01-01'),
  tiers: [{ rates: { input_tokens: 0.0001, output_tokens: 0.0002, input_cache_read_tokens: 0.00005 } }],
  ...over,
});

describe('read-time cost derivation', () => {
  it('details first: side cost is the sum of priced detail meters', () => {
    const cost = deriveCostUsd(
      {
        total_input_tokens: 100,
        total_output_tokens: 50,
        input_text_tokens: 80,
        input_cache_read_tokens: 20,
        output_text_tokens: 50,
      },
      price(),
    );
    // input: 80×0.0001 + 20×0.00005 = 0.009 ; output: 50×0.0002 = 0.01
    expect(cost).toBeCloseTo(0.019, 12);
  });

  it('falls back to totals × base rate when no detail is priced', () => {
    const cost = deriveCostUsd({ total_input_tokens: 100, total_output_tokens: 50 }, price());
    expect(cost).toBeCloseTo(100 * 0.0001 + 50 * 0.0002, 12);
  });

  it('selects a conditional tier by input tokens, else the base tier', () => {
    const p = price({
      tiers: [
        { rates: { input_tokens: 0.0001, output_tokens: 0.0002 } },
        {
          when: [{ field: 'total_input_tokens', op: 'gt', value: 1000 }],
          rates: { input_tokens: 0.00005, output_tokens: 0.0001 },
        },
      ],
    });
    expect(deriveCostUsd({ total_input_tokens: 2000, total_output_tokens: 0 }, p)).toBeCloseTo(2000 * 0.00005, 12);
    expect(deriveCostUsd({ total_input_tokens: 10, total_output_tokens: 0 }, p)).toBeCloseTo(10 * 0.0001, 12);
  });

  it('retroactive correction: a newer version wins and history recomputes', () => {
    const rows = [price(), price({ version: 2, tiers: [{ rates: { input_tokens: 0.001, output_tokens: 0.002 } }] })];
    const latest = latestPrices(rows);
    const cost = deriveCostUsd({ total_input_tokens: 10, total_output_tokens: 10 }, latest.get('openai/gpt-4o-mini')!);
    expect(cost).toBeCloseTo(10 * 0.001 + 10 * 0.002, 12); // v2 rates, not v1
  });

  it('provider aliases resolve (openai.responses → openai)', () => {
    const latest = latestPrices([price()]);
    expect(priceFor(latest, 'openai.responses', 'gpt-4o-mini')).toBeDefined();
    expect(priceFor(latest, 'openai', 'nope')).toBeUndefined();
  });

  it('returns undefined when nothing is priceable — never a guessed zero', () => {
    expect(deriveCostUsd({ 'usage.totalTokens': 42 }, price())).toBeUndefined();
    expect(deriveCostUsd(undefined, price())).toBeUndefined();
  });
});
