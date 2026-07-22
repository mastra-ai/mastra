/**
 * Base URL for the keyless free tier. No API key required — rate limited per IP
 * (currently 100 searches/day). Livecrawl is not available on this tier.
 */
export const KEYLESS_BASE_URL = 'https://api.you.com';

/**
 * Base URL for the keyed You.com Search API, used when an API key is configured.
 */
export const KEYED_BASE_URL = 'https://ydc-index.io';

const KEYLESS_SEARCH_PATH = '/v1/agents/search';
const KEYED_SEARCH_PATH = '/v1/search';

/**
 * Product token identifying this integration to You.com, per the You.com
 * integration attribution convention. On the keyless tier there is no API key,
 * so the User-Agent is the primary attribution signal.
 */
export const INTEGRATION_USER_AGENT = 'youdotcom-integration/mastra-ai-mastra';

export type YouClientOptions = {
  /**
   * You.com API key. Falls back to the `YDC_API_KEY` environment variable.
   * When neither is set, requests use the keyless free tier
   * (rate limited per IP) — no configuration is required to get started.
   * Get a key with higher limits at https://you.com/platform.
   */
  apiKey?: string;
  /**
   * Override the API base URL. Defaults to `https://ydc-index.io` when an API
   * key is configured, or `https://api.you.com` (keyless free tier) otherwise.
   */
  baseUrl?: string;
  /**
   * Optional `fetch` implementation. Useful for tests, retries, or instrumentation.
   * Defaults to the global `fetch`.
   */
  fetch?: typeof fetch;
};

export type YouWebResult = {
  url?: string;
  title?: string;
  description?: string;
  snippets?: string[];
  page_age?: string;
  thumbnail_url?: string;
  favicon_url?: string;
  authors?: string[];
};

export type YouNewsResult = {
  url?: string;
  title?: string;
  description?: string;
  page_age?: string;
  thumbnail_url?: string;
};

export type YouSearchResponse = {
  results: {
    web: YouWebResult[];
    news: YouNewsResult[];
  };
  metadata?: {
    search_uuid?: string;
    query?: string;
    latency?: number;
  };
};

export type YouSearchRequest = {
  query: string;
  count?: number;
  freshness?: string;
  country?: string;
  language?: string;
  safesearch?: 'off' | 'moderate' | 'strict';
  include_domains?: string[];
  exclude_domains?: string[];
};

function resolveApiKey(explicit?: string): string | undefined {
  return explicit ?? process.env.YDC_API_KEY;
}

/**
 * Performs a search against the You.com Search API.
 *
 * Uses the keyed endpoint when an API key is available (via `options.apiKey`
 * or the `YDC_API_KEY` environment variable) and transparently falls back to
 * the keyless free tier otherwise, so it works with zero configuration.
 */
export async function youSearchRequest(
  request: YouSearchRequest,
  options?: YouClientOptions,
): Promise<YouSearchResponse> {
  const apiKey = resolveApiKey(options?.apiKey);
  const baseUrl = (options?.baseUrl ?? (apiKey ? KEYED_BASE_URL : KEYLESS_BASE_URL)).replace(/\/$/, '');
  const path = apiKey ? KEYED_SEARCH_PATH : KEYLESS_SEARCH_PATH;
  const fetchImpl = options?.fetch ?? fetch;

  const params = new URLSearchParams({ query: request.query });
  if (request.count !== undefined) params.set('count', String(request.count));
  if (request.freshness !== undefined) params.set('freshness', request.freshness);
  if (request.country !== undefined) params.set('country', request.country);
  if (request.language !== undefined) params.set('language', request.language);
  if (request.safesearch !== undefined) params.set('safesearch', request.safesearch);
  if (request.include_domains?.length) params.set('include_domains', request.include_domains.join(','));
  if (request.exclude_domains?.length) params.set('exclude_domains', request.exclude_domains.join(','));

  const headers: Record<string, string> = {
    'User-Agent': INTEGRATION_USER_AGENT,
  };
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  const response = await fetchImpl(`${baseUrl}${path}?${params.toString()}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const rawText = await response.text().catch(() => '');
    const MAX_ERROR_BODY = 1000;
    const text = rawText.length > MAX_ERROR_BODY ? `${rawText.slice(0, MAX_ERROR_BODY)}…` : rawText;
    if (!apiKey && (response.status === 402 || response.status === 429)) {
      throw new Error(
        `You.com keyless search rate limit reached (status ${response.status}). ` +
          'Set the YDC_API_KEY environment variable (or pass { apiKey }) for higher limits — ' +
          `get a free key at https://you.com/platform.${text ? ` Response: ${text}` : ''}`,
      );
    }
    throw new Error(
      `You.com search request failed with status ${response.status}${text ? `: ${text}` : ''}`,
    );
  }

  const json = (await response.json()) as Partial<YouSearchResponse>;
  return {
    results: {
      web: Array.isArray(json.results?.web) ? json.results.web : [],
      news: Array.isArray(json.results?.news) ? json.results.news : [],
    },
    metadata: json.metadata,
  };
}
