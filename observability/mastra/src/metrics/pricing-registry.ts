import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { MIN_MODELS_DEV_PRICING_ROWS, MODELS_DEV_API_URL, modelsDevToPricingRows } from './models-dev';
import { PricingModel, PricingTier } from './pricing-model';
import type { PricingMeter, PricingConditionOperator, PricingConditionField } from './types';

const DATA_FILE_NAME = 'pricing-data.jsonl';
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MIN_REFRESH_ATTEMPT_INTERVAL_MS = 60 * 60 * 1000;
const REFRESH_TIMEOUT_MS = 5_000;
// Same cache folder as the model router. A function, so importing this module never calls
// os.homedir(), which throws in some sandboxes.
const CACHE_FILE = () => path.join(os.homedir(), '.cache', 'mastra', 'pricing-data.json');
const BEDROCK_GEOGRAPHY_PREFIXES = new Set(['global', 'us', 'eu', 'apac', 'jp', 'au']);
const AI_SDK_VERCEL_GATEWAY_PROVIDER_ID = 'gateway';
const VERCEL_PRICING_PROVIDER_ID = 'vercel';
const AI_SDK_PROVIDER_NAMESPACE_ALIASES = new Map([
  ['fireworks', 'fireworks-ai'],
  ['google.vertex', 'google-vertex'],
  ['vertex.anthropic', 'google-vertex-anthropic'],
  ['vertex.maas', 'google-vertex'],
]);

type MinifiedMeterKey = 'it' | 'ot' | 'icrt' | 'icwt' | 'icwt5m' | 'icwt1h' | 'iat' | 'oat' | 'ort';
type MinifiedConditionFieldKey = 'tit';

interface MinifiedCondition {
  f: MinifiedConditionFieldKey;
  op: PricingConditionOperator;
  value: number;
}

export interface MinifiedTier {
  w?: MinifiedCondition[];
  r: Partial<Record<MinifiedMeterKey, { c: number }>>;
}

export interface MinifiedPricingModelRow {
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
  icwt5m: 'input_cache_write_5m_tokens',
  icwt1h: 'input_cache_write_1h_tokens',
  iat: 'input_audio_tokens',
  oat: 'output_audio_tokens',
  ort: 'output_reasoning_tokens',
};

const MINIFIED_CONDITION_FIELD_TO_CANONICAL: Record<MinifiedConditionFieldKey, PricingConditionField> = {
  tit: 'total_input_tokens',
};

let cachedLoadError: string | null = null;
let globalRegistry: PricingRegistry | null = null;
// When the global pricing was last confirmed against models.dev. 0 means the bundled snapshot.
let refreshedAt = 0;
let lastRefreshAttemptAt = 0;
let refreshEtag: string | undefined;
let refreshInFlight = false;

export class PricingRegistry {
  constructor(private readonly pricingModels: Map<string, PricingModel>) {}

  static fromText(pricingModelText: string): PricingRegistry {
    return new PricingRegistry(parsePricingModelText(pricingModelText));
  }

  /**
   * The registry used for cost estimates. It starts from the models.dev copy cached in
   * `~/.cache/mastra`, or from the bundled snapshot, and refreshes from models.dev in the
   * background once a day and when a model has no price. Lookups never wait for a refresh.
   */
  static getGlobal(): PricingRegistry | null {
    if (!globalRegistry) {
      const pricingModels = loadCachedPricingModels() ?? loadPricingModels();
      if (pricingModels) {
        globalRegistry = new PricingRegistry(pricingModels);
      }
    }

    if (Date.now() - refreshedAt >= REFRESH_INTERVAL_MS) {
      refreshGlobalPricing();
    }

    return globalRegistry;
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

    // A model with no price may be newer than the pricing in use.
    if (this === globalRegistry) {
      refreshGlobalPricing();
    }
    return null;
  }
}

/** Same `MASTRA_OFFLINE` switch as the model router's `isOfflineMode()` in `@mastra/core`. */
function isRefreshEnabled(): boolean {
  const offline = process.env.MASTRA_OFFLINE;
  return offline !== 'true' && offline !== '1' && process.env.MASTRA_AUTO_REFRESH_PRICING !== 'false';
}

/**
 * Start a background refresh from models.dev. Returns false when refresh is off, one is
 * already running, or the last attempt was less than an hour ago.
 */
function refreshGlobalPricing(): boolean {
  if (refreshInFlight || !isRefreshEnabled() || Date.now() - lastRefreshAttemptAt < MIN_REFRESH_ATTEMPT_INTERVAL_MS) {
    return false;
  }

  refreshInFlight = true;
  lastRefreshAttemptAt = Date.now();
  void fetchModelsDevPricing()
    .catch(() => {
      // Keep the pricing in use. The next attempt can start an hour later.
    })
    .finally(() => {
      refreshInFlight = false;
    });
  return true;
}

async function fetchModelsDevPricing(): Promise<void> {
  const response = await fetch(MODELS_DEV_API_URL, {
    headers: refreshEtag ? { 'if-none-match': refreshEtag } : undefined,
    signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
  });

  if (response.status === 304) {
    refreshedAt = Date.now();
    await touchCacheFile();
    return;
  }
  if (!response.ok) {
    throw new Error(`models.dev responded with ${response.status}`);
  }

  const rows = modelsDevToPricingRows(await response.json());
  if (rows.length < MIN_MODELS_DEV_PRICING_ROWS) {
    throw new Error(
      `models.dev returned ${rows.length} pricing rows, expected at least ${MIN_MODELS_DEV_PRICING_ROWS}`,
    );
  }

  globalRegistry = new PricingRegistry(rowsToPricingModels(rows));
  refreshedAt = Date.now();
  refreshEtag = response.headers.get('etag') ?? undefined;
  await writeCacheFile(JSON.stringify({ etag: refreshEtag, rows }));
}

/** The cache file's mtime records when its rows were last confirmed against models.dev. */
function loadCachedPricingModels(): Map<string, PricingModel> | null {
  if (!isRefreshEnabled()) {
    return null;
  }

  try {
    const cacheFile = CACHE_FILE();
    const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8')) as { etag?: unknown; rows?: unknown };
    if (!Array.isArray(cached.rows) || cached.rows.length < MIN_MODELS_DEV_PRICING_ROWS) {
      return null;
    }

    const pricingModels = rowsToPricingModels(cached.rows as MinifiedPricingModelRow[]);
    refreshEtag = typeof cached.etag === 'string' ? cached.etag : undefined;
    refreshedAt = fs.statSync(cacheFile).mtimeMs;
    return pricingModels;
  } catch {
    return null;
  }
}

/** Write-to-temp-then-rename, like the model router's cache writes, so readers never see a partial file. */
async function writeCacheFile(content: string): Promise<void> {
  try {
    const cacheFile = CACHE_FILE();
    const tempFile = `${cacheFile}.${process.pid}.${Date.now()}.tmp`;
    await fs.promises.mkdir(path.dirname(cacheFile), { recursive: true });
    await fs.promises.writeFile(tempFile, content, 'utf-8');
    await fs.promises.rename(tempFile, cacheFile);
  } catch {
    // Read-only home folders (some containers and serverless hosts) keep the refresh in memory only.
  }
}

async function touchCacheFile(): Promise<void> {
  try {
    const now = new Date();
    await fs.promises.utimes(CACHE_FILE(), now, now);
  } catch {
    // Nothing cached yet, or the cache folder is read-only.
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
  const rows = content
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line) as MinifiedPricingModelRow);

  return rowsToPricingModels(rows);
}

function rowsToPricingModels(rows: MinifiedPricingModelRow[]): Map<string, PricingModel> {
  const pricingModels = new Map<string, PricingModel>();
  for (const row of rows) {
    const pricingModel = expandPricingModelRow(row);
    pricingModels.set(makePricingKey(pricingModel), pricingModel);
  }
  return pricingModels;
}

function expandRates(row: MinifiedPricingModelRow, tier: MinifiedTier): Partial<Record<PricingMeter, number>> {
  const rates = Object.fromEntries(
    Object.entries(tier.r).map(([meter, value]) => [MINIFIED_METER_TO_CANONICAL[meter as MinifiedMeterKey], value!.c]),
  ) as Partial<Record<PricingMeter, number>>;

  const cacheWriteRate = rates.input_cache_write_tokens;
  if (row.m.includes('claude') && typeof cacheWriteRate === 'number') {
    rates.input_cache_write_5m_tokens ??= cacheWriteRate;
    rates.input_cache_write_1h_tokens ??= cacheWriteRate * 1.6;
  }

  return rates;
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
          rates: expandRates(row, tier),
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
