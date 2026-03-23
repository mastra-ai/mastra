import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

export type PricingMeter =
  | 'input_tokens'
  | 'output_tokens'
  | 'input_cache_read_tokens'
  | 'input_cache_write_tokens'
  | 'input_audio_tokens'
  | 'output_audio_tokens'
  | 'output_reasoning_tokens';

export type CostEstimateStatus =
  | 'ok'
  | 'invalid_usage_data'
  | 'unsupported_usage_type'
  | 'no_matching_model'
  | 'no_applicable_pricing'
  | 'no_pricing_for_usage_type'
  | 'pricing_unavailable';

export interface EstimatorInput {
  provider?: string;
  model?: string;
  meter: PricingMeter;
  tokenCount: number;
  totalInputTokens?: number;
  totalOutputTokens?: number;
}

export interface MetricCostEstimatorInput {
  provider?: string;
  model?: string;
  metricName: string;
  value: number;
  totalInputTokens?: number;
  totalOutputTokens?: number;
}

export interface CostEstimateResult {
  status: CostEstimateStatus;
  estimatedCost: number | null;
  costUnit: string | null;
  costMetadata?: Record<string, unknown>;
}

export interface CostEstimator {
  estimateCost(input: EstimatorInput): CostEstimateResult;
  estimateMetricCost(input: MetricCostEstimatorInput): CostEstimateResult;
}

type MinifiedMeterKey = 'it' | 'ot' | 'icrt' | 'icwt' | 'iat' | 'oat' | 'ort';
type MinifiedConditionFieldKey = 'tit';
type ConditionOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';

interface MinifiedCondition {
  f: MinifiedConditionFieldKey;
  op: ConditionOperator;
  value: number;
}

interface MinifiedTier {
  w?: MinifiedCondition[];
  r: Partial<Record<MinifiedMeterKey, { c: number }>>;
}

interface MinifiedRow {
  i: string;
  p: string;
  m: string;
  s: {
    v: string;
    d: {
      u: string;
      t: MinifiedTier[];
    };
  };
}

interface PricingTier {
  when?: MinifiedCondition[];
  rates: Partial<Record<PricingMeter, number>>;
}

interface PricingRow {
  id: string;
  provider: string;
  model: string;
  schema: string;
  currency: string;
  tiers: PricingTier[];
}

const MINIFIED_METER_TO_CANONICAL: Record<MinifiedMeterKey, PricingMeter> = {
  it: 'input_tokens',
  ot: 'output_tokens',
  icrt: 'input_cache_read_tokens',
  icwt: 'input_cache_write_tokens',
  iat: 'input_audio_tokens',
  oat: 'output_audio_tokens',
  ort: 'output_reasoning_tokens',
};

const METRIC_TO_METER: Record<string, PricingMeter> = {
  mastra_model_total_input_tokens: 'input_tokens',
  mastra_model_total_output_tokens: 'output_tokens',
  mastra_model_input_text_tokens: 'input_tokens',
  mastra_model_input_cache_read_tokens: 'input_cache_read_tokens',
  mastra_model_input_cache_write_tokens: 'input_cache_write_tokens',
  mastra_model_input_audio_tokens: 'input_audio_tokens',
  mastra_model_output_text_tokens: 'output_tokens',
  mastra_model_output_reasoning_tokens: 'output_reasoning_tokens',
  mastra_model_output_audio_tokens: 'output_audio_tokens',
};

let cachedPricingRows: Map<string, PricingRow> | null = null;
let cachedLoadError: string | null = null;

export function getPricingMeterForMetric(metricName: string): PricingMeter | null {
  return METRIC_TO_METER[metricName] ?? null;
}

export function createCostEstimatorFromText(rollupText: string): CostEstimator {
  const pricingRows = parseRollupText(rollupText);

  return {
    estimateCost: (input: EstimatorInput) => estimateCostFromRows(pricingRows, input),
    estimateMetricCost: (input: MetricCostEstimatorInput) => estimateMetricCostFromRows(pricingRows, input),
  };
}

export function estimateMetricCost(input: MetricCostEstimatorInput): CostEstimateResult {
  const pricingRows = loadPricingRows();
  if (!pricingRows) {
    return {
      status: 'pricing_unavailable',
      estimatedCost: null,
      costUnit: null,
      costMetadata: buildCostMetadata('pricing_unavailable'),
    };
  }

  return estimateMetricCostFromRows(pricingRows, input);
}

export function estimateCost(input: EstimatorInput): CostEstimateResult {
  const pricingRows = loadPricingRows();
  if (!pricingRows) {
    return {
      status: 'pricing_unavailable',
      estimatedCost: null,
      costUnit: null,
      costMetadata: buildCostMetadata('pricing_unavailable'),
    };
  }

  return estimateCostFromRows(pricingRows, input);
}

function estimateMetricCostFromRows(
  pricingRows: Map<string, PricingRow>,
  input: MetricCostEstimatorInput,
): CostEstimateResult {
  const meter = getPricingMeterForMetric(input.metricName);
  if (!meter) {
    return {
      status: 'unsupported_usage_type',
      estimatedCost: null,
      costUnit: null,
      costMetadata: buildCostMetadata('unsupported_usage_type'),
    };
  }

  return estimateCostFromRows(pricingRows, {
    provider: input.provider,
    model: input.model,
    meter,
    tokenCount: input.value,
    totalInputTokens: input.totalInputTokens,
    totalOutputTokens: input.totalOutputTokens,
  });
}

function estimateCostFromRows(pricingRows: Map<string, PricingRow>, input: EstimatorInput): CostEstimateResult {
  if (!input.provider || !input.model || !Number.isFinite(input.tokenCount) || input.tokenCount < 0) {
    return {
      status: 'invalid_usage_data',
      estimatedCost: null,
      costUnit: null,
      costMetadata: buildCostMetadata('invalid_usage_data'),
    };
  }

  const row = pricingRows.get(makePricingKey(input.provider, input.model));
  if (!row) {
    return {
      status: 'no_matching_model',
      estimatedCost: null,
      costUnit: null,
      costMetadata: buildCostMetadata('no_matching_model'),
    };
  }

  const selectedTier = selectTier(row, input);
  if (!selectedTier) {
    return {
      status: 'no_applicable_pricing',
      estimatedCost: null,
      costUnit: normalizeCurrency(row.currency),
      costMetadata: buildCostMetadata('no_applicable_pricing', row.id),
    };
  }

  const pricePerUnit = selectedTier.tier.rates[input.meter];
  if (typeof pricePerUnit !== 'number') {
    return {
      status: 'no_pricing_for_usage_type',
      estimatedCost: null,
      costUnit: normalizeCurrency(row.currency),
      costMetadata: buildCostMetadata('no_pricing_for_usage_type', row.id, selectedTier.index),
    };
  }

  return {
    status: 'ok',
    estimatedCost: input.tokenCount * pricePerUnit,
    costUnit: normalizeCurrency(row.currency),
    costMetadata: buildCostMetadata('ok', row.id, selectedTier.index),
  };
}

function buildCostMetadata(
  estimationStatus: CostEstimateStatus,
  pricingRowId?: string,
  matchedTierIndex?: number,
): Record<string, unknown> {
  return {
    estimationStatus,
    ...(pricingRowId ? { pricingRowId } : {}),
    ...(typeof matchedTierIndex === 'number' ? { matchedTierIndex } : {}),
  };
}

function selectTier(row: PricingRow, input: EstimatorInput): { tier: PricingTier; index: number } | null {
  for (const [index, tier] of row.tiers.entries()) {
    if (tier.when && tier.when.length > 0 && tierMatches(tier, input)) {
      return { tier, index };
    }
  }

  for (const [index, tier] of row.tiers.entries()) {
    if ((!tier.when || tier.when.length === 0) && tierMatches(tier, input)) {
      return { tier, index };
    }
  }

  return null;
}

function tierMatches(tier: PricingTier, input: EstimatorInput): boolean {
  if (!tier.when || tier.when.length === 0) {
    return true;
  }

  return tier.when.every(condition => conditionMatches(condition, input));
}

function conditionMatches(condition: MinifiedCondition, input: EstimatorInput): boolean {
  const left = getConditionFieldValue(condition.f, input);
  if (left == null) {
    return false;
  }

  switch (condition.op) {
    case 'gt':
      return left > condition.value;
    case 'gte':
      return left >= condition.value;
    case 'lt':
      return left < condition.value;
    case 'lte':
      return left <= condition.value;
    case 'eq':
      return left === condition.value;
    case 'neq':
      return left !== condition.value;
    default:
      return false;
  }
}

function getConditionFieldValue(field: MinifiedConditionFieldKey, input: EstimatorInput): number | null {
  switch (field) {
    case 'tit':
      return typeof input.totalInputTokens === 'number' ? input.totalInputTokens : null;
    default:
      return null;
  }
}

function loadPricingRows(): Map<string, PricingRow> | null {
  if (cachedPricingRows) {
    return cachedPricingRows;
  }

  if (cachedLoadError) {
    return null;
  }

  try {
    const content = fs.readFileSync(resolveRollupPath(), 'utf-8');
    const rows = parseRollupText(content);
    cachedPricingRows = rows;
    return rows;
  } catch (error) {
    cachedLoadError = error instanceof Error ? error.message : String(error);
    return null;
  }
}

function parseRollupText(content: string): Map<string, PricingRow> {
  const rows = new Map<string, PricingRow>();

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const parsed = JSON.parse(trimmed) as MinifiedRow;
    const row = expandRow(parsed);
    rows.set(makePricingKey(row.provider, row.model), row);
  }

  return rows;
}

function expandRow(row: MinifiedRow): PricingRow {
  return {
    id: row.i,
    provider: row.p,
    model: row.m,
    schema: row.s.v,
    currency: row.s.d.u,
    tiers: row.s.d.t.map(tier => ({
      when: tier.w,
      rates: Object.fromEntries(
        Object.entries(tier.r).map(([meter, value]) => [
          MINIFIED_METER_TO_CANONICAL[meter as MinifiedMeterKey],
          value!.c,
        ]),
      ) as Partial<Record<PricingMeter, number>>,
    })),
  };
}

function resolveRollupPath(): string {
  const packageRoot = getPackageRoot();
  const candidates = [
    path.join(packageRoot, 'dist', 'metrics', 'rollup.jsonl'),
    path.join(packageRoot, 'src', 'metrics', 'rollup.jsonl'),
    path.join(process.cwd(), 'observability', 'mastra', 'src', 'metrics', 'rollup.jsonl'),
    path.join(process.cwd(), 'src', 'metrics', 'rollup.jsonl'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Unable to locate pricing rollup at any known path: ${candidates.join(', ')}`);
}

function getPackageRoot(): string {
  try {
    const require = createRequire(import.meta.url || 'file://');
    const packageJsonPath = require.resolve('@mastra/observability/package.json');
    return path.dirname(packageJsonPath);
  } catch {
    return process.cwd();
  }
}

function makePricingKey(provider: string, model: string): string {
  return `${normalizeKeyPart(provider)}::${normalizeKeyPart(model)}`;
}

function normalizeKeyPart(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeCurrency(currency: string): string {
  return currency.trim().toLowerCase();
}
