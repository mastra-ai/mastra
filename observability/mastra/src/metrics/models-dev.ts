import { createHash } from 'node:crypto';
import type { MinifiedPricingModelRow, MinifiedTier } from './pricing-registry';

/** Same catalog the model router reads in `@mastra/core` (`gateways/models-dev.ts`). */
export const MODELS_DEV_API_URL = 'https://models.dev/api.json';

/**
 * A models.dev payload converting to fewer rows than this has changed shape or is broken,
 * so it must not replace the pricing in use. The full catalog converts to roughly 8,000 rows.
 */
export const MIN_MODELS_DEV_PRICING_ROWS = 1_000;

/** models.dev `cost` keys (USD per 1M tokens) mapped to pricing meters. */
const COST_KEY_TO_METER = {
  input: 'it',
  output: 'ot',
  cache_read: 'icrt',
  cache_write: 'icwt',
  input_audio: 'iat',
  output_audio: 'oat',
  reasoning: 'ort',
} as const;

const PRICE_SIGNIFICANT_DIGITS = 12;

type Rates = MinifiedTier['r'];

/**
 * Convert a models.dev `api.json` payload into pricing rows.
 *
 * Each model gets a row keyed by its own id (lowercased, dots and slashes flattened to
 * dashes, matching the lookup variants in `pricing-registry.ts`). Each model also gets an
 * alias row with region, vendor, version and date parts stripped, but only when no model
 * owns that key itself, so the dated `gpt-4o-2024-05-13` never replaces `gpt-4o`.
 */
export function modelsDevToPricingRows(catalog: unknown): MinifiedPricingModelRow[] {
  const rows = new Map<string, MinifiedPricingModelRow>();
  const aliases: Array<{ provider: string; modelId: string; alias: string; tiers: MinifiedTier[] }> = [];

  for (const [providerId, providerInfo] of Object.entries(isRecord(catalog) ? catalog : {})) {
    if (!isRecord(providerInfo) || !isRecord(providerInfo.models)) continue;
    const provider = normalizeProviderId(providerId);

    for (const [modelId, modelInfo] of Object.entries(providerInfo.models)) {
      const tiers = isRecord(modelInfo) ? toTiers(modelInfo.cost) : null;
      if (!tiers) continue;

      const model = modelId.toLowerCase().replace(/[./]/g, '-');
      rows.set(`${provider}::${model}`, toRow(provider, model, tiers));

      const alias = toAliasModelKey(modelId);
      if (alias && alias !== model) aliases.push({ provider, modelId, alias, tiers });
    }
  }

  // When several ids share an alias, the shortest id wins (`anthropic.claude-x` over
  // `us.anthropic.claude-x`), then the latest one (`...-20241022` over `...-20240620`).
  aliases.sort((a, b) => a.modelId.length - b.modelId.length || b.modelId.localeCompare(a.modelId));
  for (const { provider, alias, tiers } of aliases) {
    const key = `${provider}::${alias}`;
    if (!rows.has(key)) rows.set(key, toRow(provider, alias, tiers));
  }

  return [...rows.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, row]) => row);
}

function toTiers(cost: unknown): MinifiedTier[] | null {
  const baseRates = toRates(cost);
  if (!baseRates || !isRecord(cost)) return null;

  const contextTiers = (Array.isArray(cost.tiers) ? cost.tiers : [])
    .flatMap(tier => {
      const band = isRecord(tier) && isRecord(tier.tier) ? tier.tier : null;
      const rates = toRates(tier);
      // models.dev: "Tier `size` is the context threshold where that band starts."
      return band && (band.type ?? 'context') === 'context' && typeof band.size === 'number' && band.size > 0 && rates
        ? [{ size: band.size, rates }]
        : [];
    })
    // The registry uses the first conditional tier that matches, so the highest threshold goes first.
    .sort((a, b) => b.size - a.size)
    .map(({ size, rates }): MinifiedTier => ({ w: [{ f: 'tit', op: 'gte', value: size }], r: rates }));

  return [{ r: baseRates }, ...contextTiers];
}

/** Zero prices are dropped (free endpoints and flat-fee plans), as the old platform pipeline did. */
function toRates(cost: unknown): Rates | null {
  if (!isRecord(cost)) return null;

  const rates: Rates = {};
  for (const [costKey, meter] of Object.entries(COST_KEY_TO_METER)) {
    const pricePerMillion = cost[costKey];
    if (typeof pricePerMillion === 'number' && Number.isFinite(pricePerMillion) && pricePerMillion > 0) {
      rates[meter] = { c: Number((pricePerMillion / 1_000_000).toPrecision(PRICE_SIGNIFICANT_DIGITS)) };
    }
  }

  return rates.it && rates.ot ? rates : null;
}

function toRow(provider: string, model: string, tiers: MinifiedTier[]): MinifiedPricingModelRow {
  return {
    i: toRowId(provider, model),
    p: provider,
    m: model,
    s: { v: 'model_pricing/v1', d: { u: 'USD', t: tiers } },
  };
}

/** Same id scheme as the old platform pipeline, so `pricing_id` stays stable for a provider + model. */
function toRowId(provider: string, model: string): string {
  return createHash('sha1').update(`rollup|${provider}|${model}`).digest('hex').slice(0, 16);
}

function normalizeProviderId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Port of the old platform pipeline's model-key normalization, used only for alias rows. */
function toAliasModelKey(modelId: string): string {
  return modelId
    .replace(/^accounts\/[^/]+\/models\//i, '')
    .replace(/^(global|us|eu|apac)\./i, '')
    .replace(/^[a-z0-9-]+\.(openai|anthropic|google|xai|minimax)\./i, '')
    .replace(/^(openai|anthropic|google|xai|x-ai|minimax|minimaxai)[/:._-]+/i, '')
    .replace(/-v\d+(?::0)?$/i, '')
    .replace(/@\d{8}$/, '')
    .replace(/@default$/i, '')
    .replace(/-\d{4}-\d{2}-\d{2}$/, '')
    .replace(/-20\d{6}$/, '')
    .replace(/_20\d{6}$/, '')
    .replace(/[/.:_\s]+/g, '-')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
