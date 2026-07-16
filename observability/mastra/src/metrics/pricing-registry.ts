import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { PricingModel, PricingTier } from './pricing-model';
import type { PricingMeter, PricingConditionOperator, PricingConditionField } from './types';

const DATA_FILE_NAME = 'pricing-data.jsonl';
const BEDROCK_GEOGRAPHY_PREFIXES = new Set(['global', 'us', 'eu', 'apac', 'jp', 'au']);
const AI_SDK_VERCEL_GATEWAY_PROVIDER_ID = 'gateway';
const VERCEL_PRICING_PROVIDER_ID = 'vercel';
const AI_SDK_PROVIDER_NAMESPACE_ALIASES = new Map([
  ['google.vertex', 'google-vertex'],
  ['vertex.anthropic', 'google-vertex-anthropic'],
  ['vertex.maas', 'google-vertex'],
]);

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
    for (const provider of getPricingProviderCandidates(args.provider, args.model)) {
      const variants = getModelVariants(args.model, provider);
      for (const variant of variants) {
        const key = makePricingKey({ provider, model: variant });
        const match = this.pricingModels.get(key);
        if (match) return match;
      }
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
  return `${normalizeKeyPart(args.provider)}::${normalizeKeyPart(args.model)}`;
}

function normalizeKeyPart(value: string): string {
  return value.trim().toLowerCase();
}

function getPricingProviderCandidates(provider: string, model: string): string[] {
  const normalizedProvider = normalizeKeyPart(provider);
  const providerCandidates =
    getNamespacedProviderCandidates(normalizedProvider) ?? getBaseProviderCandidates(normalizedProvider, model);

  return [...new Set([normalizedProvider, ...providerCandidates])];
}

function getNamespacedProviderCandidates(provider: string): string[] | null {
  for (const [providerNamespace, pricingProvider] of AI_SDK_PROVIDER_NAMESPACE_ALIASES) {
    if (matchesProviderNamespace(provider, providerNamespace)) {
      return [providerNamespace, pricingProvider];
    }
  }

  return null;
}

function matchesProviderNamespace(provider: string, providerNamespace: string): boolean {
  return provider === providerNamespace || provider.startsWith(`${providerNamespace}.`);
}

function getBaseProviderCandidates(provider: string, model: string): string[] {
  const baseProvider = getBaseProvider(provider);
  return isVercelGatewayModel(baseProvider, model) ? [baseProvider, VERCEL_PRICING_PROVIDER_ID] : [baseProvider];
}

function getBaseProvider(provider: string): string {
  const capabilitySeparator = provider.indexOf('.');
  return capabilitySeparator === -1 ? provider : provider.substring(0, capabilitySeparator);
}

function isVercelGatewayModel(provider: string, model: string): boolean {
  return provider === AI_SDK_VERCEL_GATEWAY_PROVIDER_ID && hasCreatorModelIdShape(model);
}

function hasCreatorModelIdShape(model: string): boolean {
  const segments = model.split('/');
  return segments.length === 2 && segments.every(segment => segment.trim().length > 0);
}

/**
 * Generate model name variants to try during lookup, in priority order:
 * 1. Original (and date-stripped original)
 * 2. Dots → dashes, e.g. "gpt-5.4" → "gpt-5-4" (and date-stripped)
 * 3. Dots and slashes → dashes, e.g. "xiaomi/mimo-v2-pro" → "xiaomi-mimo-v2-pro"
 *    (covers OpenRouter entries that keep the vendor prefix flattened with a dash)
 * 4. Vendor prefix dropped, e.g. "openai/gpt-5-mini" → "gpt-5-mini", and the
 *    same with dots flattened, e.g. "google/gemini-2.5-flash" → "gemini-2-5-flash"
 *    (covers OpenRouter entries stored without the vendor prefix, including
 *    dotted versions)
 * 5. For Bedrock, geographic and vendor prefixes dropped and Bedrock version suffixes
 *    stripped, e.g. "us.anthropic.claude-sonnet-4-5-20250929-v1:0" →
 *    "claude-sonnet-4-5"
 *
 * Each variant is also tried with its date suffix stripped.
 * The Set dedupes so non-prefixed inputs do not pay for redundant lookups.
 */
function getModelVariants(model: string, provider: string): string[] {
  const variants = new Set<string>();
  const add = (v: string) => {
    variants.add(v);
    variants.add(stripDateSuffix(v));
  };

  add(model);
  add(model.replace(/\./g, '-'));
  add(model.replace(/[./]/g, '-'));

  const slashIndex = model.indexOf('/');
  if (slashIndex !== -1) {
    // Vendor-prefixed routes (e.g. OpenRouter's `google/gemini-2.5-flash`) need the
    // same dot-flattening as the full id; otherwise the stripped suffix keeps its dots
    // (`gemini-2.5-flash`) and never matches a flattened pricing key (`gemini-2-5-flash`).
    const withoutVendor = model.substring(slashIndex + 1);
    add(withoutVendor);
    add(withoutVendor.replace(/\./g, '-'));
  }

  if (provider === 'amazon-bedrock') {
    const addBedrockVariant = (v: string) => {
      add(v);
      add(v.replace(/-(?:v)?\d+(?::\d+)?$/, ''));
    };
    const segments = model.split('.');
    const withoutGeography = BEDROCK_GEOGRAPHY_PREFIXES.has(segments[0] ?? '') ? segments.slice(1).join('.') : model;

    addBedrockVariant(withoutGeography);
    addBedrockVariant(withoutGeography.replace(/\./g, '-'));

    const vendorSeparator = withoutGeography.indexOf('.');
    if (vendorSeparator !== -1) {
      const withoutVendor = withoutGeography.substring(vendorSeparator + 1);
      addBedrockVariant(withoutVendor);
      addBedrockVariant(withoutVendor.replace(/\./g, '-'));
    }
  }

  return [...variants];
}

/**
 * Strip date suffix from model names.
 * Handles multiple date formats used by different providers:
 * - OpenAI: YYYY-MM-DD at end (e.g., "gpt-5-4-mini-2026-03-17" → "gpt-5-4-mini")
 * - Anthropic: YYYYMMDD with optional suffix (e.g., "claude-sonnet-4-5-20250929-thinking" → "claude-sonnet-4-5-thinking")
 * - Vertex Anthropic: @YYYYMMDD at end (e.g., "claude-sonnet-4-5@20250929" → "claude-sonnet-4-5")
 * - Cohere/Gemini: MM-YYYY at end (e.g., "command-r-08-2024" → "command-r")
 */
function stripDateSuffix(model: string): string {
  // Vertex Anthropic format: @YYYYMMDD at end
  let stripped = model.replace(/@20\d{6}$/, '');
  if (stripped !== model) return stripped;

  // OpenAI format: -YYYY-MM-DD at end
  stripped = model.replace(/-20\d{2}-\d{2}-\d{2}$/, '');
  if (stripped !== model) return stripped;

  // Anthropic format: -YYYYMMDD, possibly followed by suffix like -thinking
  stripped = model.replace(/-20\d{6}(-[a-z]+)?$/, '$1');
  if (stripped !== model) return stripped;

  // Cohere/Gemini format: -MM-YYYY at end
  stripped = model.replace(/-\d{2}-20\d{2}$/, '');
  return stripped;
}
