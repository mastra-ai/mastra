import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import type { MastraModelGatewayInterface } from '@mastra/core/llm';
import { MIN_PRICED_MODELS, MODELS_DEV_API_URL, modelsDevToPricingModels, pickModelsDevCosts } from './models-dev';
import type { ModelsDevCosts } from './models-dev';
import type { PricingModel } from './pricing-model';

const DATA_FILE_NAME = 'pricing-data.json';
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MIN_REFRESH_ATTEMPT_INTERVAL_MS = 60 * 60 * 1000;
const REFRESH_TIMEOUT_MS = 5_000;
// Same cache folder as the model router. A function, so importing this module never calls
// os.homedir(), which throws in some sandboxes.
const CACHE_FILE = () => path.join(os.homedir(), '.cache', 'mastra', 'pricing-data.json');
// Every installed version of this package shares the cache file. Bump this when the cached
// prices change shape or meaning, so other versions ignore the file instead of misreading it.
const CACHE_VERSION = 1;
const BEDROCK_GEOGRAPHY_PREFIXES = new Set(['global', 'us', 'eu', 'apac', 'jp', 'au', 'in']);
const AI_SDK_VERCEL_GATEWAY_PROVIDER_ID = 'gateway';
const AZURE_OPENAI_GATEWAY_ID = 'azure-openai';
const VERCEL_PRICING_PROVIDER_ID = 'vercel';
const AI_SDK_PROVIDER_NAMESPACE_ALIASES = new Map([
  ['fireworks', 'fireworks-ai'],
  ['google.vertex', 'google-vertex'],
  ['vertex.anthropic', 'google-vertex-anthropic'],
  ['vertex.maas', 'google-vertex'],
]);

let cachedLoadError: string | null = null;
let globalRegistry: PricingRegistry | null = null;
let bundledRegistry: PricingRegistry | null = null;
/** The part of a model router gateway that pricing reads. */
type PricingGateway = Pick<MastraModelGatewayInterface, 'id' | 'getId' | 'fetchProviders'>;
// Prices that custom gateways returned from `fetchProviders()`, for models models.dev does not list.
let gatewayRegistry: PricingRegistry | null = null;
let gatewayCosts: ModelsDevCosts = {};
let gatewaySource: (() => Iterable<PricingGateway>) | null = null;
// Per gateway: `Infinity` once its prices are loaded, else when loading last failed.
const gatewayLoadAttempts = new Map<PricingGateway, number>();
let gatewayLoadInFlight = false;
// When the global pricing was last confirmed against models.dev. 0 means the bundled snapshot.
let refreshedAt = 0;
let lastRefreshAttemptAt = 0;
let refreshEtag: string | undefined;
let refreshInFlight = false;

export class PricingRegistry {
  constructor(private readonly pricingModels: Map<string, PricingModel>) {}

  /** A registry from models.dev costs, in the shape of `pricing-data.json` or `api.json`. */
  static fromModelsDev(costs: unknown): PricingRegistry {
    return new PricingRegistry(modelsDevToPricingModels(costs));
  }

  /**
   * The registry used for cost estimates. It uses the bundled snapshot. When refresh is on (under
   * `mastra dev`, or with `MASTRA_AUTO_REFRESH_PRICING=true`), it starts from the models.dev copy
   * cached in `~/.cache/mastra` instead, and refreshes from models.dev in the background once a day
   * and when a model has no price. Lookups never wait for a refresh.
   */
  static getGlobal(): PricingRegistry | null {
    if (!globalRegistry) {
      const cachedPricingModels = loadCachedPricingModels();
      globalRegistry = cachedPricingModels ? new PricingRegistry(cachedPricingModels) : getBundledRegistry();
    }

    if (Date.now() - refreshedAt >= REFRESH_INTERVAL_MS) {
      refreshGlobalPricing();
    }

    return globalRegistry;
  }

  get(args: { provider: string; model: string }): PricingModel | null {
    if (this !== globalRegistry) {
      return this.find(args);
    }

    // models.dev can drop or rename a model after a release, so refreshed prices may miss a
    // model the bundled snapshot still has. Gateway prices only fill what models.dev lacks, so a
    // gateway that names a public provider cannot reprice direct calls to that provider.
    const match =
      this.find(args) ??
      (this === bundledRegistry ? null : getBundledRegistry()?.find(args)) ??
      gatewayRegistry?.find(args);
    if (match) {
      return match;
    }

    // A model with no price anywhere may be newer than the pricing in use, or served by a
    // gateway whose prices are not loaded yet.
    void loadGatewayPricing();
    refreshGlobalPricing();
    return null;
  }

  private find(args: { provider: string; model: string }): PricingModel | null {
    for (const provider of getPricingProviderCandidates(args.provider, args.model)) {
      for (const variant of getModelVariants(args.model, provider)) {
        const match = this.pricingModels.get(makePricingKey({ provider, model: variant }));
        if (match) return match;
      }
    }
    return null;
  }
}

function getBundledRegistry(): PricingRegistry | null {
  if (!bundledRegistry) {
    const pricingModels = loadPricingModels();
    if (pricingModels) {
      bundledRegistry = new PricingRegistry(pricingModels);
    }
  }
  return bundledRegistry;
}

/**
 * Where to find the model router gateways whose `pricing` fills the gaps in models.dev. Prices
 * load on the first lookup that has no price, so production does not call gateways at startup;
 * under the same switches as the models.dev refresh (`mastra dev`, or
 * `MASTRA_AUTO_REFRESH_PRICING=true`) they also load right away, off the hot path, so the first
 * model call is priced. Each gateway is read once; a failed read is retried at most once an hour.
 */
export function setPricingGateways(source: () => Iterable<PricingGateway>): void {
  gatewaySource = source;
  if (isRefreshEnabled()) {
    void loadGatewayPricing();
  }
}

/** Load `pricing` from every custom gateway not loaded yet. Off under `MASTRA_OFFLINE`. */
export async function loadGatewayPricing(): Promise<void> {
  if (!gatewaySource || gatewayLoadInFlight || isOffline()) {
    return;
  }

  gatewayLoadInFlight = true;
  try {
    const builtInIds = await getBuiltInGatewayIds();
    let changed = false;
    for (const gateway of gatewaySource()) {
      const gatewayId = gateway.getId?.() ?? gateway.id;
      const lastAttempt = gatewayLoadAttempts.get(gateway) ?? 0;
      if (builtInIds.has(gatewayId) || Date.now() - lastAttempt < MIN_REFRESH_ATTEMPT_INTERVAL_MS) {
        continue;
      }

      try {
        const providers = await gateway.fetchProviders();
        for (const [providerId, config] of Object.entries(providers ?? {})) {
          for (const [modelId, cost] of Object.entries(config?.pricing ?? {})) {
            (gatewayCosts[providerId] ??= { models: {} }).models[modelId] = { cost: cost as Record<string, unknown> };
          }
        }
        gatewayLoadAttempts.set(gateway, Infinity);
        changed = true;
      } catch (error) {
        gatewayLoadAttempts.set(gateway, Date.now());
        console.warn(`Failed to load model prices from gateway ${gatewayId}:`, error);
      }
    }
    if (changed) {
      gatewayRegistry = new PricingRegistry(modelsDevToPricingModels(gatewayCosts));
    }
  } finally {
    gatewayLoadInFlight = false;
  }
}

/**
 * The gateways core ships: the ones Mastra registers on its own, plus Azure OpenAI, which users
 * construct themselves. Their `fetchProviders()` can hit the network and never carries prices.
 * Read from core when it exports the list (1.46+), else the known ids.
 */
async function getBuiltInGatewayIds(): Promise<Set<string>> {
  try {
    const { defaultGateways, getGatewayId } = await import('@mastra/core/llm');
    return new Set([...defaultGateways.map(getGatewayId), AZURE_OPENAI_GATEWAY_ID]);
  } catch {
    return new Set(['models.dev', 'netlify', 'mastra', AZURE_OPENAI_GATEWAY_ID]);
  }
}

function isOffline(): boolean {
  const offline = process.env.MASTRA_OFFLINE;
  return offline === 'true' || offline === '1';
}

/**
 * Same switches as the model router's auto-refresh in `@mastra/core`: on by default only under
 * `mastra dev` (`MASTRA_DEV`), opt-in elsewhere, and always off with `MASTRA_OFFLINE`.
 */
function isRefreshEnabled(): boolean {
  if (isOffline()) {
    return false;
  }
  const isDev = process.env.MASTRA_DEV === 'true' || process.env.MASTRA_DEV === '1';
  const setting = process.env.MASTRA_AUTO_REFRESH_PRICING;
  return setting === 'true' || (setting !== 'false' && isDev);
}

/**
 * Start a background refresh from models.dev, unless refresh is off, one is already
 * running, or the last attempt was less than an hour ago.
 */
function refreshGlobalPricing(): void {
  if (refreshInFlight || !isRefreshEnabled() || Date.now() - lastRefreshAttemptAt < MIN_REFRESH_ATTEMPT_INTERVAL_MS) {
    return;
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

  const costs = pickModelsDevCosts(await response.json());
  const pricingModels = modelsDevToPricingModels(costs);
  if (pricingModels.size < MIN_PRICED_MODELS) {
    throw new Error(`models.dev returned ${pricingModels.size} prices, expected at least ${MIN_PRICED_MODELS}`);
  }

  globalRegistry = new PricingRegistry(pricingModels);
  refreshedAt = Date.now();
  refreshEtag = response.headers.get('etag') ?? undefined;
  await writeCacheFile(JSON.stringify({ version: CACHE_VERSION, etag: refreshEtag, costs }));
}

/** The cache file's mtime records when its prices were last confirmed against models.dev. */
function loadCachedPricingModels(): Map<string, PricingModel> | null {
  if (!isRefreshEnabled()) {
    return null;
  }

  try {
    const cacheFile = CACHE_FILE();
    const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8')) as {
      version?: unknown;
      etag?: unknown;
      costs?: unknown;
    };
    if (cached.version !== CACHE_VERSION) {
      return null;
    }

    const pricingModels = modelsDevToPricingModels(cached.costs);
    if (pricingModels.size < MIN_PRICED_MODELS) {
      return null;
    }

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
    return modelsDevToPricingModels(JSON.parse(fs.readFileSync(resolvePricingModelPath(), 'utf-8')));
  } catch (error) {
    cachedLoadError = error instanceof Error ? error.message : String(error);
    return null;
  }
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

  throw new Error(`Unable to locate pricing data at any known path: ${candidates.join(', ')}`);
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
