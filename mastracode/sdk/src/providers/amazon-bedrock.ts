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
 * A models.dev catalog entry for one Bedrock model.
 *
 * Most entries carry no `provider` block: they are served by the SigV4
 * `bedrock-runtime` Converse API, which is what this catalog feeds. An entry
 * that *does* carry one is overriding that transport.
 */
interface BedrockCatalogEntry {
  provider?: {
    npm?: string;
    api?: string;
    shape?: string;
  };
}

/**
 * True when the catalog entry asks for a transport this catalog cannot serve.
 *
 * Every id returned here is handed to `createAmazonBedrock()(modelId)` by
 * `amazon-bedrock-gateway.ts`, i.e. the Converse API, unconditionally. A
 * `provider` override in the catalog means the model wants a different endpoint
 * and API shape: the nine `bedrock-mantle` models point at
 * `https://bedrock-mantle.${AWS_REGION}.api.aws/openai/v1` with
 * `shape: "responses"`. Advertising them makes them selectable in `/models` and
 * in packs even though the request that follows cannot reach them.
 *
 * Filtering is deliberately conservative: it hides what is currently unusable
 * rather than guessing at a transport. Routing these to Mantle properly is a
 * separate change and a design call for the maintainers.
 */
function needsUnsupportedTransport(entry: unknown): boolean {
  const provider = (entry as BedrockCatalogEntry | null)?.provider;
  return Boolean(provider && (provider.npm || provider.api || provider.shape));
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
  return Object.entries(models)
    .filter(([, entry]) => !needsUnsupportedTransport(entry))
    .map(([id]) => id)
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
