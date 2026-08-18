/**
 * Pulse-owned model pricing — cost is DERIVED at read time.
 *
 * Pulse stores token usage facts (fold-key shape on the model end fact)
 * and versioned price rows; cost is computed when asked, by ONE shared
 * rule used by every reader. What this wins over write-time folding:
 * retroactive price corrections (append a new version, history
 * recomputes), price history, and zero cost math on the hot path.
 *
 * The rule mirrors the established estimator semantics exactly so the
 * transition is provable: detail meters first (their sum is the side's
 * cost), totals × base rate as the fallback; tier chosen by its
 * conditions (today: total input tokens), else the base tier.
 */

export type PriceMeter =
  | 'input_tokens'
  | 'input_audio_tokens'
  | 'input_cache_read_tokens'
  | 'input_cache_write_tokens'
  | 'input_image_tokens'
  | 'output_tokens'
  | 'output_audio_tokens'
  | 'output_image_tokens'
  | 'output_reasoning_tokens';

export interface PriceTier {
  /** Conditions; a tier with none is the base tier. */
  when?: Array<{ field: 'total_input_tokens'; op: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq'; value: number }>;
  rates: Partial<Record<PriceMeter, number>>;
}

export interface ModelPriceRow {
  provider: string;
  model: string;
  currency: string;
  /** Append-only: the highest version wins at read time. */
  version: number;
  validFrom: Date;
  tiers: PriceTier[];
}

/** Token-data key → the meter that prices it. */
const DETAIL_METERS: Array<{ key: string; meter: PriceMeter; side: 'in' | 'out' }> = [
  { key: 'input_text_tokens', meter: 'input_tokens', side: 'in' },
  { key: 'input_cache_read_tokens', meter: 'input_cache_read_tokens', side: 'in' },
  { key: 'input_cache_write_tokens', meter: 'input_cache_write_tokens', side: 'in' },
  { key: 'input_audio_tokens', meter: 'input_audio_tokens', side: 'in' },
  { key: 'input_image_tokens', meter: 'input_image_tokens', side: 'in' },
  { key: 'output_text_tokens', meter: 'output_tokens', side: 'out' },
  { key: 'output_reasoning_tokens', meter: 'output_reasoning_tokens', side: 'out' },
  { key: 'output_audio_tokens', meter: 'output_audio_tokens', side: 'out' },
  { key: 'output_image_tokens', meter: 'output_image_tokens', side: 'out' },
];

function pickTier(tiers: PriceTier[], data: Record<string, number>): PriceTier | undefined {
  for (const tier of tiers) {
    if (!tier.when?.length) continue;
    const ok = tier.when.every(c => {
      const left = data.total_input_tokens;
      if (typeof left !== 'number') return false;
      switch (c.op) {
        case 'gt':
          return left > c.value;
        case 'gte':
          return left >= c.value;
        case 'lt':
          return left < c.value;
        case 'lte':
          return left <= c.value;
        case 'eq':
          return left === c.value;
        case 'neq':
          return left !== c.value;
      }
    });
    if (ok) return tier;
  }
  return tiers[0];
}

/**
 * Derive USD cost from a model end fact's token data. Detail-first per
 * side; totals × base rate when no detail on that side priced.
 */
export function deriveCostUsd(data: Record<string, number> | undefined, price: ModelPriceRow): number | undefined {
  if (!data) return undefined;
  const tier = pickTier(price.tiers, data);
  if (!tier) return undefined;

  const side = (which: 'in' | 'out'): number | undefined => {
    let sum: number | undefined;
    for (const d of DETAIL_METERS) {
      if (d.side !== which) continue;
      const tokens = data[d.key];
      const rate = tier.rates[d.meter];
      if (typeof tokens === 'number' && typeof rate === 'number') sum = (sum ?? 0) + tokens * rate;
    }
    if (sum !== undefined) return sum;
    const totalKey = which === 'in' ? 'total_input_tokens' : 'total_output_tokens';
    const baseMeter: PriceMeter = which === 'in' ? 'input_tokens' : 'output_tokens';
    const tokens = data[totalKey];
    const rate = tier.rates[baseMeter];
    if (typeof tokens === 'number' && typeof rate === 'number') return tokens * rate;
    return undefined;
  };

  const input = side('in');
  const output = side('out');
  if (input === undefined && output === undefined) return undefined;
  return (input ?? 0) + (output ?? 0);
}

/** Highest version per (provider, model) wins — append-only price history. */
export function latestPrices(rows: ModelPriceRow[]): Map<string, ModelPriceRow> {
  const best = new Map<string, ModelPriceRow>();
  for (const row of rows) {
    const key = `${row.provider}/${row.model}`;
    const cur = best.get(key);
    if (!cur || row.version > cur.version) best.set(key, row);
  }
  return best;
}

/** Resolve a fact's price: exact provider/model, then model-only fallback
 * (providers alias — e.g. 'openai.responses' serving an 'openai' model). */
export function priceFor(
  prices: Map<string, ModelPriceRow>,
  provider: string | undefined,
  model: string | undefined,
): ModelPriceRow | undefined {
  if (!model) return undefined;
  if (provider) {
    const exact = prices.get(`${provider}/${model}`);
    if (exact) return exact;
    const root = provider.split('.')[0]!;
    const aliased = prices.get(`${root}/${model}`);
    if (aliased) return aliased;
  }
  for (const [key, row] of prices) if (key.endsWith(`/${model}`)) return row;
  return undefined;
}
