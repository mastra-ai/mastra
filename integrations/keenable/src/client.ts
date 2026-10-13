export const DEFAULT_BASE_URL = 'https://api.keenable.ai';

// Identifies Mastra traffic to Keenable. Requests without an API key are
// rejected unless this header is present.
const APP_TITLE = 'mastra';

export type KeenableClientOptions = {
  /**
   * Keenable API key. Falls back to the `KEENABLE_API_KEY` environment variable.
   * Optional: without a key the tools use Keenable's keyless endpoints, which are
   * rate limited. A key raises the limit.
   */
  apiKey?: string;
  /**
   * Override the API base URL. Defaults to `https://api.keenable.ai`.
   */
  baseUrl?: string;
  /**
   * Optional `fetch` implementation. Useful for tests, retries, or instrumentation.
   * Defaults to the global `fetch`.
   */
  fetch?: typeof fetch;
};

export type KeenableSearchRequest = {
  query: string;
  max_results?: number;
  site?: string;
  published_after?: string;
  published_before?: string;
  snippet_max_length?: number;
};

export type KeenableSearchResultItem = {
  title?: string;
  url: string;
  snippet?: string;
  description?: string;
  published_at?: string | number;
};

export type KeenableSearchResponse = {
  query?: string;
  results: KeenableSearchResultItem[];
};

export type KeenableFetchRequest = {
  url: string;
  max_chars?: number;
};

export type KeenableFetchResponse = {
  url?: string;
  title?: string;
  content?: string;
  published_at?: string | number;
};

/**
 * Keenable reports publication times either as an ISO 8601 string or as Unix
 * seconds; the tools always return an ISO string.
 */
export function toIsoDate(value: string | number | undefined): string | undefined {
  if (typeof value === 'number') return new Date(value * 1000).toISOString();
  return value || undefined;
}

type ResolvedOptions = {
  apiKey?: string;
  baseUrl: string;
  fetchImpl: typeof fetch;
};

function resolveOptions(options?: KeenableClientOptions): ResolvedOptions {
  return {
    apiKey: (options?.apiKey ?? process.env.KEENABLE_API_KEY)?.trim() || undefined,
    baseUrl: (options?.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, ''),
    fetchImpl: options?.fetch ?? fetch,
  };
}

function headers(apiKey: string | undefined, json: boolean): Record<string, string> {
  const result: Record<string, string> = { 'X-Keenable-Title': APP_TITLE };
  if (json) result['Content-Type'] = 'application/json';
  if (apiKey) result['X-API-Key'] = apiKey;
  return result;
}

async function failure(action: string, response: Response): Promise<Error> {
  const rawText = await response.text().catch(() => '');
  const MAX_ERROR_BODY = 1000;
  const text = rawText.length > MAX_ERROR_BODY ? `${rawText.slice(0, MAX_ERROR_BODY)}…` : rawText;
  return new Error(`Keenable ${action} request failed with status ${response.status}${text ? `: ${text}` : ''}`);
}

/**
 * Calls the Keenable search endpoint. Without an API key the request goes to the
 * keyless `/v1/search/public` endpoint.
 */
export async function keenableSearchRequest(
  body: KeenableSearchRequest,
  options?: KeenableClientOptions,
): Promise<KeenableSearchResponse> {
  const { apiKey, baseUrl, fetchImpl } = resolveOptions(options);
  const path = apiKey ? '/v1/search' : '/v1/search/public';

  const response = await fetchImpl(`${baseUrl}${path}`, {
    method: 'POST',
    headers: headers(apiKey, true),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw await failure('Search', response);
  }

  const json = (await response.json()) as Partial<KeenableSearchResponse>;
  return {
    query: json.query,
    results: Array.isArray(json.results) ? json.results : [],
  };
}

/**
 * Calls the Keenable fetch endpoint, which returns a page's main content as
 * Markdown. Without an API key the request goes to the keyless
 * `/v1/fetch/public` endpoint.
 */
export async function keenableFetchRequest(
  params: KeenableFetchRequest,
  options?: KeenableClientOptions,
): Promise<KeenableFetchResponse> {
  const { apiKey, baseUrl, fetchImpl } = resolveOptions(options);
  const path = apiKey ? '/v1/fetch' : '/v1/fetch/public';
  const query = new URLSearchParams({ url: params.url });
  if (params.max_chars !== undefined) query.set('max_chars', String(params.max_chars));

  const response = await fetchImpl(`${baseUrl}${path}?${query}`, {
    method: 'GET',
    headers: headers(apiKey, false),
  });

  if (!response.ok) {
    throw await failure('Fetch', response);
  }

  return (await response.json()) as KeenableFetchResponse;
}
