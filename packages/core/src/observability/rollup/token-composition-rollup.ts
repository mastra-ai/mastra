/**
 * Session-level rollup over exported MODEL_STEP spans.
 *
 * Turns a session's exported spans into the numbers the Resolvable State
 * cost gate needs: cache-hit rate, prompt token composition by region, and
 * the steps-per-turn distribution. Tokens by type only — never prices.
 */

import { SpanType } from '../types';
import type { ExportedSpan, ModelStepAttributes } from '../types';

/** The cache-hit formula, printed in the output header so consumers cannot misread the number. */
export const CACHE_HIT_RATE_FORMULA = 'cacheRead / (cacheRead + text + cacheWrite)';

export interface StepsPerTurnDistribution {
  turns: number;
  min: number;
  median: number;
  p95: number;
  max: number;
}

export interface TokenCompositionRollup {
  formula: typeof CACHE_HIT_RATE_FORMULA;
  steps: {
    /** MODEL_STEP spans seen. */
    total: number;
    /** Steps whose provider reported cache fields — the hit-rate population. */
    reported: number;
    /** Steps with no provider-reported cache fields. Excluded from the hit rate. */
    unreported: number;
    /** Reported steps carrying audio/image input tokens. Excluded from the hit rate. */
    multimodalExcluded: number;
    /** MODEL_STEP spans with no `promptRegions` attribute (pre-instrumentation spans). */
    uninstrumented: number;
  };
  cache: {
    /** Undefined when no step qualifies — never fabricate a rate from an empty population. */
    hitRate?: number;
    unreportedFraction: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    textTokens: number;
  };
  regions: {
    /** Estimation methods seen across spans (should normally be one). */
    methods: string[];
    /** Estimated tokens per region, summed across instrumented steps. */
    totals: Record<string, number>;
    totalEstimated: number;
  };
  stepsPerTurn: StepsPerTurnDistribution;
  /** Per-step (estimated − provider-reported) input tokens. Empty when providers reported no totals. */
  estimateDelta: {
    samples: number;
    meanAbsolute?: number;
    meanSigned?: number;
  };
  /** Steps whose prompt prefix changed from the previous step (cache-invalidating). */
  prefixChanges: {
    observed: number;
    changed: number;
  };
}

type AnyExportedSpan = ExportedSpan<SpanType> & { attributes?: Record<string, any> };

function isModelStep(span: AnyExportedSpan): boolean {
  return span.type === SpanType.MODEL_STEP;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index]!;
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

export function rollupTokenComposition(spans: AnyExportedSpan[]): TokenCompositionRollup {
  const steps = spans.filter(isModelStep);

  let reported = 0;
  let unreported = 0;
  let multimodalExcluded = 0;
  let uninstrumented = 0;

  let cacheReadTokens = 0;
  let cacheWriteTokens = 0;
  let textTokens = 0;

  const regionTotals: Record<string, number> = {};
  const methods = new Set<string>();
  let totalEstimated = 0;

  const deltas: number[] = [];
  let prefixObserved = 0;
  let prefixChanged = 0;

  const stepsByTurn = new Map<string, number>();

  for (const span of steps) {
    const attributes = (span.attributes ?? {}) as ModelStepAttributes;
    const turnKey = span.parentSpanId ?? `${span.traceId}:orphan`;
    stepsByTurn.set(turnKey, (stepsByTurn.get(turnKey) ?? 0) + 1);

    const details = attributes.usage?.inputDetails;
    // "Unreported" is inferred from absence: providers that do not report cache
    // fields leave them undefined, and undefined is never read as zero.
    const hasCacheFields = details?.cacheRead !== undefined || details?.cacheWrite !== undefined;
    const isMultimodal = (details?.audio ?? 0) > 0 || (details?.image ?? 0) > 0;

    if (!hasCacheFields) {
      unreported++;
    } else if (isMultimodal) {
      // Excluded rather than folded in: `text` deliberately excludes audio/image
      // tokens, so a multimodal step's denominator would silently under-count.
      reported++;
      multimodalExcluded++;
    } else {
      reported++;
      cacheReadTokens += details?.cacheRead ?? 0;
      cacheWriteTokens += details?.cacheWrite ?? 0;
      textTokens += details?.text ?? 0;
    }

    const regions = attributes.promptRegions;
    if (!regions) {
      // Distinct from "region total is 0" — a span from before instrumentation
      // landed must never be conflated with an empty region.
      uninstrumented++;
    } else {
      methods.add(regions.method);
      totalEstimated += regions.totalEstimated;
      for (const [region, tokens] of Object.entries(regions.regions)) {
        regionTotals[region] = (regionTotals[region] ?? 0) + tokens;
      }

      const providerTotal = attributes.usage?.inputTokens;
      if (providerTotal !== undefined) {
        deltas.push(regions.totalEstimated - providerTotal);
      }
    }

    if (attributes.promptPrefixChangedFromPreviousStep !== undefined) {
      prefixObserved++;
      if (attributes.promptPrefixChangedFromPreviousStep) prefixChanged++;
    }
  }

  const hitRateDenominator = cacheReadTokens + textTokens + cacheWriteTokens;
  const countedForHitRate = reported - multimodalExcluded;

  const perTurn = [...stepsByTurn.values()].sort((a, b) => a - b);

  return {
    formula: CACHE_HIT_RATE_FORMULA,
    steps: { total: steps.length, reported, unreported, multimodalExcluded, uninstrumented },
    cache: {
      hitRate: countedForHitRate > 0 && hitRateDenominator > 0 ? cacheReadTokens / hitRateDenominator : undefined,
      unreportedFraction: steps.length > 0 ? unreported / steps.length : 0,
      cacheReadTokens,
      cacheWriteTokens,
      textTokens,
    },
    regions: { methods: [...methods].sort(), totals: regionTotals, totalEstimated },
    stepsPerTurn: {
      turns: perTurn.length,
      min: perTurn.length ? perTurn[0]! : 0,
      median: median(perTurn),
      p95: percentile(perTurn, 95),
      max: perTurn.length ? perTurn[perTurn.length - 1]! : 0,
    },
    estimateDelta: {
      samples: deltas.length,
      meanAbsolute: deltas.length ? deltas.reduce((sum, d) => sum + Math.abs(d), 0) / deltas.length : undefined,
      meanSigned: deltas.length ? deltas.reduce((sum, d) => sum + d, 0) / deltas.length : undefined,
    },
    prefixChanges: { observed: prefixObserved, changed: prefixChanged },
  };
}

/** Human-readable report. Token counts by type only — no prices, by design. */
export function formatTokenCompositionRollup(rollup: TokenCompositionRollup): string {
  const lines: string[] = [];
  const pct = (value?: number) => (value === undefined ? 'n/a' : `${(value * 100).toFixed(1)}%`);

  lines.push('Token composition rollup (tokens by type; no pricing by design)');
  lines.push(`cache-hit rate formula: ${rollup.formula}`);
  lines.push(`  computed over reported, text-only steps`);
  lines.push('');
  lines.push(`steps: ${rollup.steps.total} total`);
  lines.push(`  reported ${rollup.steps.reported} | unreported ${rollup.steps.unreported}`);
  lines.push(
    `  multimodal excluded ${rollup.steps.multimodalExcluded} | uninstrumented (no promptRegions) ${rollup.steps.uninstrumented}`,
  );
  lines.push('');
  lines.push(
    `cache-hit rate: ${pct(rollup.cache.hitRate)} (unreported fraction ${pct(rollup.cache.unreportedFraction)})`,
  );
  lines.push(
    `  cacheRead ${rollup.cache.cacheReadTokens} | cacheWrite ${rollup.cache.cacheWriteTokens} | text ${rollup.cache.textTokens}`,
  );
  lines.push('');
  lines.push(`prompt regions (estimated, method: ${rollup.regions.methods.join(', ') || 'n/a'})`);
  for (const [region, tokens] of Object.entries(rollup.regions.totals).sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${region.padEnd(32)} ${tokens}`);
  }
  lines.push(`  ${'TOTAL'.padEnd(32)} ${rollup.regions.totalEstimated}`);
  lines.push('');
  const spt = rollup.stepsPerTurn;
  lines.push(
    `steps per turn: turns ${spt.turns} | min ${spt.min} | median ${spt.median} | p95 ${spt.p95} | max ${spt.max}`,
  );
  lines.push(
    `estimate vs provider total: samples ${rollup.estimateDelta.samples} | mean signed ${rollup.estimateDelta.meanSigned?.toFixed(1) ?? 'n/a'} | mean absolute ${rollup.estimateDelta.meanAbsolute?.toFixed(1) ?? 'n/a'}`,
  );
  lines.push(`prompt prefix changed: ${rollup.prefixChanges.changed}/${rollup.prefixChanges.observed} observed steps`);

  return lines.join('\n');
}
