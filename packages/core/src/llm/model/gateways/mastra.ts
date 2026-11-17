import { createHash } from 'node:crypto';
import { createAnthropic } from '@ai-sdk/anthropic-v6';
import { createOpenRouter } from '@openrouter/ai-sdk-provider-v6';
import { MastraError } from '../../../error/index.js';
import { PROVIDER_REGISTRY } from '../provider-registry.js';
import { MastraModelGateway } from './base.js';
import type { ProviderConfig, GatewayLanguageModel } from './base.js';
import { GATEWAY_AUTH_HEADER, MASTRA_USER_AGENT } from './constants.js';

export interface MastraGatewayConfig {
  apiKey?: string;
  baseUrl?: string;
  customFetch?: typeof globalThis.fetch;
}

/**
 * Builds the headers for the OAuth gateway paths. The gateway credential lives in a reserved
 * internal header, so caller-provided headers must not be able to replace it — including via a
 * differently-cased spelling, since HTTP header names are case-insensitive.
 */
function withGatewayAuthHeader(apiKey: string, headers?: Record<string, string>): Record<string, string> {
  const reserved = GATEWAY_AUTH_HEADER.toLowerCase();
  const result: Record<string, string> = { 'User-Agent': MASTRA_USER_AGENT };
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (key.toLowerCase() === reserved) continue;
    result[key] = value;
  }
  result[GATEWAY_AUTH_HEADER] = `Bearer ${apiKey}`;
  return result;
}

/**
 * Whether the Gateway serves Observational Memory for a given API key.
 *
 * Gateway keys come in two shapes with different memory behaviour:
 * - project keys (`msk_…`) are served with server-side Observational Memory;
 * - organization keys (`msk-gateway-…`, `mskv2_…`) are served by a gateway without
 *   the memory API, so memory has to stay local.
 *
 * Anything unrecognised (including a missing key) reports `false`: memory is never
 * assumed to be handled remotely unless the key says so.
 */
export function gatewayServesObservationalMemory(apiKey: string | undefined): boolean {
  if (typeof apiKey !== 'string' || apiKey.length === 0) return false;
  if (apiKey.startsWith('msk-gateway-') || apiKey.startsWith('mskv2_')) return false;
  return apiKey.startsWith('msk_');
}

export class MastraGateway extends MastraModelGateway {
  readonly id = 'mastra';
  readonly name = 'Gateway';

  constructor(private config?: MastraGatewayConfig) {
    super();
  }

  private getBaseUrl(): string {
    const raw = this.config?.baseUrl ?? process.env['MASTRA_GATEWAY_URL'] ?? 'https://gateway-api.mastra.ai';
    // Trim trailing slashes with a loop; the equivalent /\/+$/ regex is quadratic on long runs of '/'.
    let end = raw.length;
    while (end > 0 && raw[end - 1] === '/') end--;
    return raw.slice(0, end).replace(/\/v1$/, '');
  }

  override shouldEnable(): boolean {
    return !!(this.config?.apiKey ?? process.env['MASTRA_GATEWAY_API_KEY']);
  }

  /**
   * Gateway v2 deployments are signaled by MASTRA_GATEWAY_VERSION=v2 (set by the platform)
   * or by a v2 (organization) API key prefix, which predates the env var signal. A v1 project
   * key (`msk_`) is always served by v1, so it wins over the env var.
   * Keep in sync with isGatewayV2 in @mastra/server's gateway-memory-client.
   * Public so the server can ask a registered gateway instance for its
   * effective v2 state (the instance may carry a key via config.apiKey
   * that env-only checks cannot see).
   */
  isV2(): boolean {
    const key = this.config?.apiKey ?? process.env['MASTRA_GATEWAY_API_KEY'];
    // A v1 project key (`msk_`) is always served by v1, so it wins over the env var.
    // The v2 prefixes (`msk-gateway-`, `mskv2_`) do not start with `msk_`.
    if (key?.startsWith('msk_')) return false;
    if (process.env['MASTRA_GATEWAY_VERSION'] === 'v2') return true;
    return !!key && (key.startsWith('msk-gateway-') || key.startsWith('mskv2_'));
  }

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    const isV2 = this.isV2();
    const openrouterConfig = PROVIDER_REGISTRY['openrouter'];
    let models = openrouterConfig?.models ?? [];
    if (isV2) {
      const apiKey = await this.getApiKey();
      // Gateway v2 reads the key only from Authorization or x-api-key. A custom fetch is a v1
      // pass-through that owns Authorization, so the catalogue request uses the plain global fetch.
      const fetchImpl = globalThis.fetch;
      models = await loadCachedV2Catalog(fetchImpl, `${this.getBaseUrl()}\n${hashApiKey(apiKey)}`, () =>
        this.fetchV2Catalog(fetchImpl, apiKey),
      );
    }

    const providers = {
      mastra: {
        apiKeyEnvVar: 'MASTRA_GATEWAY_API_KEY',
        apiKeyHeader: 'Authorization',
        name: 'Gateway',
        gateway: 'mastra',
        models: [...models],
        // Static release dates describe the bundled registry, not the live v2 catalog.
        modelReleaseDates: isV2 ? undefined : openrouterConfig?.modelReleaseDates,
        docUrl: 'https://mastra.ai/docs/gateway',
      },
    };

    return providers;
  }

  private async fetchV2Catalog(fetchImpl: typeof fetch, apiKey: string): Promise<string[]> {
    const response = await fetchImpl(`${this.getBaseUrl()}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new GatewayCatalogError(`Gateway model catalog unavailable (${response.status})`, response.status);
    }
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || !('data' in body) || !Array.isArray(body.data)) {
      throw new Error('Gateway model catalog has an invalid response');
    }
    // The Mastra gateway model uses the OpenAI-compatible chat transport.
    // Models offered only through another endpoint cannot be selected here.
    return body.data
      .filter(
        (item): item is { id: string; endpoints: string[] } =>
          !!item &&
          typeof item === 'object' &&
          typeof item.id === 'string' &&
          Array.isArray(item.endpoints) &&
          item.endpoints.includes('chat'),
      )
      .map(item => item.id);
  }

  async buildUrl(_modelId: string): Promise<string> {
    return `${this.getBaseUrl()}/v1`;
  }

  async getApiKey(): Promise<string> {
    const apiKey = this.config?.apiKey ?? process.env['MASTRA_GATEWAY_API_KEY'];
    if (!apiKey) {
      throw new MastraError({
        id: 'MASTRA_GATEWAY_NO_API_KEY',
        domain: 'LLM',
        category: 'UNKNOWN',
        text: 'Missing MASTRA_GATEWAY_API_KEY environment variable',
      });
    }
    return apiKey;
  }

  resolveLanguageModel({
    modelId,
    providerId,
    apiKey,
    headers,
  }: {
    modelId: string;
    providerId: string;
    apiKey: string;
    headers?: Record<string, string>;
  }): GatewayLanguageModel {
    const baseURL = `${this.getBaseUrl()}/v1`;
    const fullModelId = `${providerId}/${modelId}`;

    if (this.config?.customFetch && providerId === 'anthropic') {
      // Anthropic OAuth path: use native Anthropic SDK (sends /messages, not /chat/completions)
      return createAnthropic({
        apiKey: 'oauth-gateway-placeholder',
        baseURL,
        headers: withGatewayAuthHeader(apiKey, headers),
        fetch: this.config.customFetch as any,
      })(modelId) as unknown as GatewayLanguageModel;
    }

    if (this.config?.customFetch) {
      // Non-Anthropic OAuth path: gateway key in GATEWAY_AUTH_HEADER, customFetch owns Authorization
      return createOpenRouter({
        apiKey: 'oauth-gateway-placeholder',
        baseURL,
        headers: withGatewayAuthHeader(apiKey, headers),
        fetch: this.config.customFetch,
        // Strict mode adds stream_options.include_usage to streaming requests only,
        // so routes that report usage in a separate final chunk still return it.
        compatibility: 'strict',
      }).chat(fullModelId) as unknown as GatewayLanguageModel;
    }

    // API key path: gateway key goes via Authorization (standard flow)
    return createOpenRouter({
      apiKey,
      baseURL,
      headers: {
        'User-Agent': MASTRA_USER_AGENT,
        ...headers,
      },
      // Strict mode adds stream_options.include_usage to streaming requests only.
      compatibility: 'strict',
    }).chat(fullModelId) as unknown as GatewayLanguageModel;
  }
}

/** How long a v2 model catalogue is reused before it is fetched again. */
const V2_CATALOG_TTL_MS = 60_000;
/** How long the last good v2 catalogue is still served while refreshes fail. */
const V2_CATALOG_STALE_IF_ERROR_MS = 10 * 60_000;
/**
 * How long to wait after a failed request before trying again: the last good catalogue is served
 * meanwhile, or, when there is none, the failure is thrown again.
 */
const V2_CATALOG_RETRY_AFTER_ERROR_MS = 15_000;
/** Most catalogues kept per fetch implementation. */
const V2_CATALOG_MAX_ENTRIES = 100;

/** A catalogue request that got an HTTP error status. */
class GatewayCatalogError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GatewayCatalogError';
  }
}

interface V2CatalogEntry {
  models?: string[];
  fetchedAt?: number;
  retryAt?: number;
  pending?: Promise<string[]>;
  /** A failure with no list to fall back on, rethrown until `failedUntil` without a new request. */
  failure?: unknown;
  failedUntil?: number;
}

/**
 * v2 model catalogues, first by the global fetch in effect when the request was made, then by
 * base URL and API key hash. A replaced global fetch (instrumentation, test doubles) gets its own
 * entries, so a list from one is never served through another. The raw key is never stored.
 */
let v2CatalogCaches = new WeakMap<typeof fetch, Map<string, V2CatalogEntry>>();

/** Only an in-memory cache key, so the raw key is not held. Not a password hash. */
function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

/** A 401 or 403 means the key was rejected, so a list cached for it must not be served. */
function isRejectedKey(error: unknown): boolean {
  return error instanceof GatewayCatalogError && (error.status === 401 || error.status === 403);
}

/**
 * Drops settled entries past the stale window (keeping a failure that is still remembered), then
 * the oldest settled ones over the size cap.
 */
function pruneV2Catalogs(cache: Map<string, V2CatalogEntry>, now: number): void {
  for (const [key, entry] of cache) {
    const failureRemembered = entry.failedUntil !== undefined && now < entry.failedUntil;
    const listExpired = entry.fetchedAt === undefined || now - entry.fetchedAt >= V2_CATALOG_STALE_IF_ERROR_MS;
    if (!entry.pending && !failureRemembered && listExpired) cache.delete(key);
  }
  for (const [key, entry] of cache) {
    if (cache.size <= V2_CATALOG_MAX_ENTRIES) break;
    if (!entry.pending) cache.delete(key);
  }
}

/**
 * Returns the cached v2 catalogue for `cacheKey`, fetching it when it is missing or older than
 * the TTL. Concurrent callers share one request. When a refresh fails with a timeout, a network
 * error or a server error, the last good catalogue is returned for a bounded time, and the next
 * attempt waits a short while. Without a catalogue to fall back on, the error is thrown, and the
 * same error is thrown again without a new request for that short while, so callers during an
 * outage do not each wait for the request timeout. A rejected key (401 or 403) drops the cached
 * catalogue and is never remembered, so every call asks the gateway again.
 */
function loadCachedV2Catalog(
  fetchImpl: typeof fetch,
  cacheKey: string,
  load: () => Promise<string[]>,
): Promise<string[]> {
  let cache = v2CatalogCaches.get(fetchImpl);
  if (!cache) {
    cache = new Map();
    v2CatalogCaches.set(fetchImpl, cache);
  }
  const entries = cache;
  const entry = entries.get(cacheKey);
  const now = Date.now();
  if (entry?.models && entry.fetchedAt !== undefined) {
    const age = now - entry.fetchedAt;
    const fresh = age < V2_CATALOG_TTL_MS;
    const backingOff = entry.retryAt !== undefined && now < entry.retryAt && age < V2_CATALOG_STALE_IF_ERROR_MS;
    if (fresh || backingOff) return Promise.resolve(entry.models);
  }
  if (entry?.failedUntil !== undefined && now < entry.failedUntil) return Promise.reject(entry.failure);
  if (entry?.pending) return entry.pending;

  const pending = load().then(
    models => {
      const settledAt = Date.now();
      entries.delete(cacheKey);
      entries.set(cacheKey, { models, fetchedAt: settledAt });
      pruneV2Catalogs(entries, settledAt);
      return models;
    },
    error => {
      const previous = entries.get(cacheKey);
      const settledAt = Date.now();
      if (
        !isRejectedKey(error) &&
        previous?.models &&
        previous.fetchedAt !== undefined &&
        settledAt - previous.fetchedAt < V2_CATALOG_STALE_IF_ERROR_MS
      ) {
        entries.set(cacheKey, {
          models: previous.models,
          fetchedAt: previous.fetchedAt,
          retryAt: settledAt + V2_CATALOG_RETRY_AFTER_ERROR_MS,
        });
        return previous.models;
      }
      entries.delete(cacheKey);
      if (!isRejectedKey(error)) {
        entries.set(cacheKey, { failure: error, failedUntil: settledAt + V2_CATALOG_RETRY_AFTER_ERROR_MS });
        pruneV2Catalogs(entries, settledAt);
      }
      throw error;
    },
  );
  entries.set(cacheKey, { ...entry, pending });
  return pending;
}

/** @internal Clear the cached v2 model catalogues. For testing only. */
export function _resetMastraGatewayCatalogCache(): void {
  v2CatalogCaches = new WeakMap();
}
