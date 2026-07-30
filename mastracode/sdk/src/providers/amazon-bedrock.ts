/**
 * Amazon Bedrock model catalog.
 *
 * Bedrock is not part of mastracode's gateway-synced model router (it
 * authenticates with AWS SigV4 rather than an API key / base URL, so it is
 * resolved directly in `agents/model.ts`). To still offer Bedrock models in the
 * `/models` picker and packs, we fetch the public models.dev catalog — the same
 * source the model router uses — and expose the `amazon-bedrock` provider's
 * model list. This mirrors the GitHub Copilot catalog approach.
 */

const MODELS_DEV_API_URL = 'https://models.dev/api.json';
const BEDROCK_PROVIDER_ID = 'amazon-bedrock';

const CATALOG_TTL_MS = 60 * 60 * 1000;
const CATALOG_FAILURE_TTL_MS = 60 * 1000;
const CATALOG_FETCH_TIMEOUT_MS = 5_000;

export interface BedrockModelEntry {
  id: string;
}

/**
 * A small, stable fallback so Bedrock packs keep working offline or when
 * models.dev is unreachable. Intentionally minimal — the live catalog is the
 * source of truth and supersedes this within one fetch.
 */
const BEDROCK_FALLBACK_MODELS: BedrockModelEntry[] = [
  { id: 'us.anthropic.claude-opus-4-6-v1' },
  { id: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0' },
  { id: 'us.anthropic.claude-haiku-4-5-20251001-v1:0' },
];

interface CatalogCacheEntry {
  fetchedAt: number;
  ttl: number;
  models: BedrockModelEntry[];
}

let catalogCache: CatalogCacheEntry | null = null;
let inflightFetch: Promise<BedrockModelEntry[]> | null = null;

/** Reset the in-process Bedrock catalog cache (test seam). */
export function clearBedrockCatalogCache(): void {
  catalogCache = null;
  inflightFetch = null;
}

async function fetchBedrockModels(signal: AbortSignal): Promise<BedrockModelEntry[]> {
  const response = await fetch(MODELS_DEV_API_URL, { signal });
  if (!response.ok) {
    throw new Error(`models.dev returned ${response.status}`);
  }
  const data = (await response.json()) as Record<string, { models?: Record<string, unknown> }>;
  const provider = data[BEDROCK_PROVIDER_ID];
  const models = provider?.models ?? {};
  return Object.keys(models)
    .sort()
    .map(id => ({ id }));
}

/**
 * Return the available Amazon Bedrock models.
 *
 * - Returns the cached list when a recent fetch succeeded.
 * - On cache miss / expiry, fetches the models.dev catalog with a 5s timeout and
 *   caches it for an hour.
 * - On fetch failure, returns a small hard-coded fallback (so packs still work
 *   offline) and caches that briefly to avoid hammering the network.
 *
 * Concurrent calls during a fetch share the inflight promise.
 */
export async function getBedrockModelCatalog(): Promise<BedrockModelEntry[]> {
  const now = Date.now();
  if (catalogCache && now - catalogCache.fetchedAt < catalogCache.ttl) {
    return catalogCache.models;
  }

  if (inflightFetch) return inflightFetch;

  inflightFetch = (async (): Promise<BedrockModelEntry[]> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CATALOG_FETCH_TIMEOUT_MS);
    try {
      const models = await fetchBedrockModels(controller.signal);
      catalogCache = { fetchedAt: Date.now(), ttl: CATALOG_TTL_MS, models };
      return models;
    } catch (error) {
      catalogCache = {
        fetchedAt: Date.now(),
        ttl: CATALOG_FAILURE_TTL_MS,
        models: BEDROCK_FALLBACK_MODELS,
      };
      console.warn(
        'Failed to fetch live Amazon Bedrock models, using fallback list:',
        error instanceof Error ? error.message : error,
      );
      return BEDROCK_FALLBACK_MODELS;
    } finally {
      clearTimeout(timer);
      inflightFetch = null;
    }
  })();

  return inflightFetch;
}
