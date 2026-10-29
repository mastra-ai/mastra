const MODELS_DEV_API_URL = 'https://models.dev/api.json';
const GOOGLE_VERTEX_PROVIDER_ID = 'google-vertex';
const CATALOG_TTL_MS = 60 * 60 * 1000;
const CATALOG_FAILURE_TTL_MS = 60 * 1000;
const CATALOG_FETCH_TIMEOUT_MS = 5_000;

export interface GoogleVertexModelEntry {
  id: string;
}

const GOOGLE_VERTEX_FALLBACK_MODELS: GoogleVertexModelEntry[] = [{ id: 'gemini-3.8-flash' }];

interface CatalogCacheEntry {
  fetchedAt: number;
  ttl: number;
  models: GoogleVertexModelEntry[];
}

let catalogCache: CatalogCacheEntry | null = null;
let inflightFetch: Promise<GoogleVertexModelEntry[]> | null = null;

export function clearGoogleVertexCatalogCache(): void {
  catalogCache = null;
  inflightFetch = null;
}

async function fetchGoogleVertexModels(signal: AbortSignal): Promise<GoogleVertexModelEntry[]> {
  const response = await fetch(MODELS_DEV_API_URL, { signal });
  if (!response.ok) {
    throw new Error(`models.dev returned ${response.status}`);
  }
  const data = (await response.json()) as Record<string, { models?: Record<string, unknown> }>;
  return Object.keys(data[GOOGLE_VERTEX_PROVIDER_ID]?.models ?? {})
    .sort()
    .map(id => ({ id }));
}

export async function getGoogleVertexModelCatalog(): Promise<GoogleVertexModelEntry[]> {
  const now = Date.now();
  if (catalogCache && now - catalogCache.fetchedAt < catalogCache.ttl) {
    return catalogCache.models;
  }
  if (inflightFetch) return inflightFetch;

  inflightFetch = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CATALOG_FETCH_TIMEOUT_MS);
    try {
      const models = await fetchGoogleVertexModels(controller.signal);
      catalogCache = { fetchedAt: Date.now(), ttl: CATALOG_TTL_MS, models };
      return models;
    } catch (error) {
      catalogCache = {
        fetchedAt: Date.now(),
        ttl: CATALOG_FAILURE_TTL_MS,
        models: GOOGLE_VERTEX_FALLBACK_MODELS,
      };
      console.warn(
        'Failed to fetch live Google Vertex models, using fallback list:',
        error instanceof Error ? error.message : error,
      );
      return GOOGLE_VERTEX_FALLBACK_MODELS;
    } finally {
      clearTimeout(timer);
      inflightFetch = null;
    }
  })();

  return inflightFetch;
}
