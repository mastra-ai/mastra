import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { SpanType } from '../types';
import {
  CACHE_HIT_RATE_FORMULA,
  formatTokenCompositionRollup,
  rollupTokenComposition,
} from './token-composition-rollup';

const spans = JSON.parse(
  readFileSync(join(__dirname, '__fixtures__', 'token-composition-spans.json'), 'utf-8'),
) as any[];

describe('rollupTokenComposition', () => {
  const rollup = rollupTokenComposition(spans);

  it('counts only MODEL_STEP spans, classifying reported/unreported/multimodal/uninstrumented', () => {
    expect(rollup.steps).toEqual({
      total: 6,
      reported: 5,
      unreported: 1,
      multimodalExcluded: 1,
      uninstrumented: 1,
    });
  });

  it('computes the cache-hit rate over reported, text-only steps only', () => {
    // cacheRead 210 / (210 cacheRead + 26 text + 10 cacheWrite) — the multimodal
    // step's 50 cacheRead is excluded, not folded into the denominator.
    expect(rollup.cache.cacheReadTokens).toBe(210);
    expect(rollup.cache.cacheWriteTokens).toBe(10);
    expect(rollup.cache.textTokens).toBe(26);
    expect(rollup.cache.hitRate).toBeCloseTo(210 / 246, 10);
    expect(rollup.cache.unreportedFraction).toBeCloseTo(1 / 6, 10);
  });

  it('sums region totals across instrumented steps without conflating uninstrumented spans', () => {
    expect(rollup.regions.methods).toEqual(['tokenx-estimate']);
    expect(rollup.regions.totals).toEqual({
      system: 172,
      'tagged-system:memory': 60,
      messages: 201,
    });
    expect(rollup.regions.totalEstimated).toBe(433);
    // The uninstrumented step contributed nothing but is reported separately.
    expect(rollup.steps.uninstrumented).toBe(1);
  });

  it('derives the steps-per-turn distribution by parent generation span', () => {
    expect(rollup.stepsPerTurn).toEqual({ turns: 3, min: 1, median: 2, p95: 3, max: 3 });
  });

  it('measures estimate-vs-provider-total delta only where a provider total exists', () => {
    expect(rollup.estimateDelta.samples).toBe(5);
    expect(rollup.estimateDelta.meanSigned).toBeCloseTo(-13 / 5, 10);
    expect(rollup.estimateDelta.meanAbsolute).toBeCloseTo(17 / 5, 10);
  });

  it('computes estimator bias only over steps carrying both an estimate and a provider total', () => {
    const withEstimate = (id: string, totalEstimated: number, inputTokens?: number) => ({
      id,
      traceId: 't',
      spanId: id,
      parentSpanId: 'gen-bias',
      type: SpanType.MODEL_STEP,
      attributes: {
        promptRegions: { method: 'tokenx-estimate', totalEstimated, regions: { system: totalEstimated } },
        ...(inputTokens === undefined ? {} : { usage: { inputTokens } }),
      },
    });

    // 110 estimated against 100 reported is a 10% bias. The second span carries
    // a large estimate but no provider total, so it must not enter the ratio.
    const rollup = rollupTokenComposition([withEstimate('a', 110, 100), withEstimate('b', 9000)] as any);

    expect(rollup.estimateDelta.samples).toBe(1);
    expect(rollup.estimateDelta.biasFraction).toBeCloseTo(0.1, 10);
    expect(rollup.regions.totalEstimated).toBe(9110);
  });

  it('reports no bias when no step carries a provider total', () => {
    expect(rollupTokenComposition([]).estimateDelta.biasFraction).toBeUndefined();
  });

  it('counts prefix-change observations without inventing a value for the first step', () => {
    expect(rollup.prefixChanges).toEqual({ observed: 2, changed: 1 });
  });

  it('never reports a hit rate when no step qualifies', () => {
    const empty = rollupTokenComposition([]);
    expect(empty.cache.hitRate).toBeUndefined();
    expect(empty.cache.unreportedFraction).toBe(0);
    expect(empty.estimateDelta.samples).toBe(0);
  });

  it('does not read a missing cache field as zero', () => {
    const unreportedOnly = rollupTokenComposition([spans[3]]);
    expect(unreportedOnly.steps.unreported).toBe(1);
    expect(unreportedOnly.steps.reported).toBe(0);
    expect(unreportedOnly.cache.hitRate).toBeUndefined();
  });
});

describe('formatTokenCompositionRollup', () => {
  const output = formatTokenCompositionRollup(rollupTokenComposition(spans));

  it('prints the cache-hit formula in the header', () => {
    expect(output).toContain(CACHE_HIT_RATE_FORMULA);
    expect(output.split('\n').slice(0, 3).join('\n')).toContain(CACHE_HIT_RATE_FORMULA);
  });

  it('reports tokens by type only — no prices anywhere', () => {
    expect(output).not.toMatch(/[$€£¥]/);
    expect(output).not.toMatch(/\b(cost|price|usd|dollar)/i);
  });

  it('surfaces the excluded populations so the rate cannot be read as the whole session', () => {
    expect(output).toContain('multimodal excluded 1');
    expect(output).toContain('uninstrumented (no promptRegions) 1');
    expect(output).toContain('unreported 1');
  });
});
