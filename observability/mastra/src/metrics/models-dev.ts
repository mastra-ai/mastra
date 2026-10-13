import { PricingModel, PricingTier } from './pricing-model';
import type { PricingMeter } from './types';

/** Same catalog the model router reads in `@mastra/core` (`gateways/models-dev.ts`). */
export const MODELS_DEV_API_URL = 'https://models.dev/api.json';

/**
 * A models.dev catalog with fewer prices than this has changed shape or is broken, so it must
 * not replace the pricing in use. The full catalog prices roughly 8,000 models.
 */
export const MIN_PRICED_MODELS = 1_000;

/** models.dev `cost` keys (USD per 1M tokens) mapped to pricing meters. */
const COST_KEY_TO_METER: Record<string, PricingMeter> = {
  input: 'input_tokens',
  output: 'output_tokens',
  cache_read: 'input_cache_read_tokens',
  cache_write: 'input_cache_write_tokens',
  input_audio: 'input_audio_tokens',
  output_audio: 'output_audio_tokens',
  reasoning: 'output_reasoning_tokens',
};

const PRICE_SIGNIFICANT_DIGITS = 12;

/** The part of the models.dev catalog that pricing uses: each model's `cost`, in the models.dev shape. */
export type ModelsDevCosts = Record<string, { models: Record<string, { cost: Record<string, unknown> }> }>;

/** Keep only each model's `cost` from a models.dev `api.json` payload, sorted by id so diffs stay small. */
export function pickModelsDevCosts(catalog: unknown): ModelsDevCosts {
  const costs: ModelsDevCosts = {};
  for (const [providerId, providerInfo] of sortedEntries(catalog)) {
    if (!isRecord(providerInfo)) continue;

    for (const [modelId, modelInfo] of sortedEntries(providerInfo.models)) {
      if (isRecord(modelInfo) && isRecord(modelInfo.cost)) {
        (costs[providerId] ??= { models: {} }).models[modelId] = { cost: modelInfo.cost };
      }
    }
  }
  return costs;
}

/**
 * Build the pricing lookup from models.dev costs, keyed by `provider::model`.
 *
 * Each model is keyed by its own id (lowercased, dots and slashes flattened to dashes, matching
 * the lookup variants in `pricing-registry.ts`). Each model is also keyed by an alias with region,
 * vendor, version and date parts stripped, but only when no model owns that key itself, so the
 * dated `gpt-4o-2024-05-13` never replaces `gpt-4o`.
 */
export function modelsDevToPricingModels(costs: unknown): Map<string, PricingModel> {
  const pricingModels = new Map<string, PricingModel>();
  const aliases: Array<{ alias: string; modelId: string; pricingModel: PricingModel }> = [];

  for (const [providerId, providerInfo] of Object.entries(isRecord(costs) ? costs : {})) {
    if (!isRecord(providerInfo) || !isRecord(providerInfo.models)) continue;
    const provider = normalizeProviderId(providerId);

    for (const [modelId, modelInfo] of Object.entries(providerInfo.models)) {
      const tiers = isRecord(modelInfo) ? toTiers(modelInfo.cost, modelId) : null;
      if (!tiers) continue;

      const model = modelId.toLowerCase().replace(/[./]/g, '-');
      const pricingModel = new PricingModel({
        id: `${providerId}/${modelId}`,
        provider,
        model,
        currency: 'USD',
        tiers,
      });
      pricingModels.set(`${provider}::${model}`, pricingModel);

      const alias = toAliasModelKey(modelId);
      if (alias && alias !== model) aliases.push({ alias, modelId, pricingModel });
    }
  }

  // When several ids share an alias, the shortest id wins (`anthropic.claude-x` over
  // `us.anthropic.claude-x`), then the latest one (`...-20241022` over `...-20240620`).
  aliases.sort((a, b) => a.modelId.length - b.modelId.length || b.modelId.localeCompare(a.modelId));
  for (const { alias, pricingModel } of aliases) {
    const key = `${pricingModel.provider}::${alias}`;
    if (!pricingModels.has(key)) {
      const { id, provider, currency, tiers } = pricingModel;
      pricingModels.set(key, new PricingModel({ id, provider, model: alias, currency, tiers }));
    }
  }

  return pricingModels;
}

function toTiers(cost: unknown, modelId: string): PricingTier[] | null {
  const isClaude = modelId.toLowerCase().includes('claude');
  const baseRates = toRates(cost, isClaude);
  if (!baseRates || !isRecord(cost)) return null;

  const contextTiers = (Array.isArray(cost.tiers) ? cost.tiers : [])
    .flatMap(tier => {
      const band = isRecord(tier) && isRecord(tier.tier) ? tier.tier : null;
      const rates = toRates(tier, isClaude);
      // models.dev: "Tier `size` is the context threshold where that band starts."
      return band && (band.type ?? 'context') === 'context' && typeof band.size === 'number' && band.size > 0 && rates
        ? [{ size: band.size, rates }]
        : [];
    })
    // The registry uses the first conditional tier that matches, so the highest threshold goes first.
    .sort((a, b) => b.size - a.size);

  return [
    new PricingTier({ index: 0, rates: baseRates }),
    ...contextTiers.map(
      ({ size, rates }, i) =>
        new PricingTier({ index: i + 1, when: [{ field: 'total_input_tokens', op: 'gte', value: size }], rates }),
    ),
  ];
}

/** Zero prices are dropped (free endpoints and flat-fee plans), as the old platform pipeline did. */
function toRates(cost: unknown, isClaude: boolean): Partial<Record<PricingMeter, number>> | null {
  if (!isRecord(cost)) return null;

  const rates: Partial<Record<PricingMeter, number>> = {};
  for (const [costKey, meter] of Object.entries(COST_KEY_TO_METER)) {
    const pricePerMillion = cost[costKey];
    if (typeof pricePerMillion === 'number' && Number.isFinite(pricePerMillion) && pricePerMillion > 0) {
      rates[meter] = Number((pricePerMillion / 1_000_000).toPrecision(PRICE_SIGNIFICANT_DIGITS));
    }
  }

  // models.dev lists one cache write price, Anthropic's 5-minute one. Its 1-hour writes cost 1.6x that.
  const cacheWriteRate = rates.input_cache_write_tokens;
  if (isClaude && cacheWriteRate !== undefined) {
    rates.input_cache_write_5m_tokens = cacheWriteRate;
    rates.input_cache_write_1h_tokens = cacheWriteRate * 1.6;
  }

  return rates.input_tokens && rates.output_tokens ? rates : null;
}

function normalizeProviderId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Port of the old platform pipeline's model-key normalization, used only for alias keys. */
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

function sortedEntries(value: unknown): Array<[string, unknown]> {
  return Object.entries(isRecord(value) ? value : {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
