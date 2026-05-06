import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { PricingModel, PricingTier } from './pricing-model';
import type { PricingMeter, PricingConditionOperator, PricingConditionField } from './types';

const DATA_FILE_NAME = 'pricing-data.jsonl';

type MinifiedMeterKey = 'it' | 'ot' | 'icrt' | 'icwt' | 'iat' | 'oat' | 'ort';
type MinifiedConditionFieldKey = 'tit';

interface MinifiedCondition {
  f: MinifiedConditionFieldKey;
  op: PricingConditionOperator;
  value: number;
}

interface MinifiedTier {
  w?: MinifiedCondition[];
  r: Partial<Record<MinifiedMeterKey, { c: number }>>;
}

interface MinifiedPricingModelRow {
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

const MINIFIED_METER_TO_CANONICAL: Record<MinifiedMeterKey, PricingMeter> = {
  it: 'input_tokens',
  ot: 'output_tokens',
  icrt: 'input_cache_read_tokens',
  icwt: 'input_cache_write_tokens',
  iat: 'input_audio_tokens',
  oat: 'output_audio_tokens',
  ort: 'output_reasoning_tokens',
};

const MINIFIED_CONDITION_FIELD_TO_CANONICAL: Record<MinifiedConditionFieldKey, PricingConditionField> = {
  tit: 'total_input_tokens',
};

let cachedLoadError: string | null = null;

export class PricingRegistry {
  private static globalRegistry: PricingRegistry | null = null;

  constructor(private readonly pricingModels: Map<string, PricingModel>) {}

  static fromText(pricingModelText: string): PricingRegistry {
    return new PricingRegistry(parsePricingModelText(pricingModelText));
  }

  static getGlobal(): PricingRegistry | null {
    if (PricingRegistry.globalRegistry) {
      return PricingRegistry.globalRegistry;
    }

    const pricingModels = loadPricingModels();
    if (!pricingModels) {
      return null;
    }

    PricingRegistry.globalRegistry = new PricingRegistry(pricingModels);
    return PricingRegistry.globalRegistry;
  }

  get(args: { provider: string; model: string }): PricingModel | null {
    // Try all model name variants in order of preference
    const variants = getModelVariants(args.model);
    for (const variant of variants) {
      const key = makePricingKey({ provider: args.provider, model: variant });
      const match = this.pricingModels.get(key);
      if (match) return match;
    }
    return null;
  }
}

function loadPricingModels(): Map<string, PricingModel> | null {
  if (cachedLoadError) {
    return null;
  }

  try {
    const content = fs.readFileSync(resolvePricingModelPath(), 'utf-8');
    return parsePricingModelText(content);
  } catch (error) {
    cachedLoadError = error instanceof Error ? error.message : String(error);
    return null;
  }
}

function parsePricingModelText(content: string): Map<string, PricingModel> {
  const pricingModels = new Map<string, PricingModel>();

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const parsed = JSON.parse(trimmed) as MinifiedPricingModelRow;
    const pricingModel = expandPricingModelRow(parsed);
    pricingModels.set(makePricingKey(pricingModel), pricingModel);
  }

  return pricingModels;
}

function expandPricingModelRow(row: MinifiedPricingModelRow): PricingModel {
  return new PricingModel({
    id: row.i,
    provider: row.p,
    model: row.m,
    schema: row.s.v,
    currency: row.s.d.u,
    tiers: row.s.d.t.map(
      (tier, index) =>
        new PricingTier({
          index,
          when: tier.w?.map(condition => ({
            field: MINIFIED_CONDITION_FIELD_TO_CANONICAL[condition.f],
            op: condition.op,
            value: condition.value,
          })),
          rates: Object.fromEntries(
            Object.entries(tier.r).map(([meter, value]) => [
              MINIFIED_METER_TO_CANONICAL[meter as MinifiedMeterKey],
              value!.c,
            ]),
          ) as Partial<Record<PricingMeter, number>>,
        }),
    ),
  });
}

function resolvePricingModelPath(): string {
  const packageRoot = getPackageRoot();
  const candidates = [
    path.join(packageRoot, 'dist', 'metrics', DATA_FILE_NAME),
    path.join(packageRoot, 'src', 'metrics', DATA_FILE_NAME),
    path.join(process.cwd(), 'observability', 'mastra', 'src', 'metrics', DATA_FILE_NAME),
    path.join(process.cwd(), 'src', 'metrics', DATA_FILE_NAME),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Unable to locate pricing data JSONL at any known path: ${candidates.join(', ')}`);
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

function makePricingKey(args: { provider: string; model: string }): string {
  return `${normalizeProvider(args.provider)}::${normalizeKeyPart(args.model)}`;
}

function normalizeKeyPart(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Normalize a provider string by stripping AI SDK capability suffixes
 * (e.g. "openai.chat" → "openai", "anthropic.messages" → "anthropic").
 * The pricing data uses bare provider names without these suffixes.
 */
function normalizeProvider(provider: string): string {
  const normalized = provider.trim().toLowerCase();
  const dotIndex = normalized.indexOf('.');
  return dotIndex !== -1 ? normalized.substring(0, dotIndex) : normalized;
}

/**
 * Generate model name variants to try during lookup, in priority order:
 * 1. Original model name
 * 2. Dots converted to dashes (e.g., "gpt-5.4" → "gpt-5-4")
 * 3. Date suffix stripped from original
 * 4. Date suffix stripped from dashed version
 */
function getModelVariants(model: string): string[] {
  const dashed = model.replace(/\./g, '-');
  return [model, dashed, stripDateSuffix(model), stripDateSuffix(dashed)];
}

/**
 * Strip date suffix from model names.
 * Handles multiple date formats used by different providers:
 * - OpenAI: YYYY-MM-DD at end (e.g., "gpt-5-4-mini-2026-03-17" → "gpt-5-4-mini")
 * - Anthropic: YYYYMMDD with optional suffix (e.g., "claude-sonnet-4-5-20250929-thinking" → "claude-sonnet-4-5-thinking")
 * - Cohere/Gemini: MM-YYYY at end (e.g., "command-r-08-2024" → "command-r")
 */
function stripDateSuffix(model: string): string {
  // OpenAI format: -YYYY-MM-DD at end
  let stripped = model.replace(/-20\d{2}-\d{2}-\d{2}$/, '');
  if (stripped !== model) return stripped;

  // Anthropic format: -YYYYMMDD, possibly followed by suffix like -thinking
  stripped = model.replace(/-20\d{6}(-[a-z]+)?$/, '$1');
  if (stripped !== model) return stripped;

  // Cohere/Gemini format: -MM-YYYY at end
  stripped = model.replace(/-\d{2}-20\d{2}$/, '');
  return stripped;
}
