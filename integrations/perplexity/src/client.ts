export const DEFAULT_BASE_URL = 'https://api.perplexity.ai';

export type PerplexityClientOptions = {
  /**
   * Perplexity API key. Falls back to `PERPLEXITY_API_KEY` then `PPLX_API_KEY`
   * environment variables when not provided.
   */
  apiKey?: string;
  /**
   * Override the API base URL. Defaults to `https://api.perplexity.ai`.
   */
  baseUrl?: string;
  /**
   * Optional `fetch` implementation. Useful for tests, retries, or instrumentation.
   * Defaults to the global `fetch`.
   */
  fetch?: typeof fetch;
};

export type PerplexitySearchResultItem = {
  title: string;
  url: string;
  snippet: string;
  date?: string;
};

export type PerplexitySearchResponse = {
  id?: string;
  results: PerplexitySearchResultItem[];
};

export type PerplexitySearchRequest = {
  query: string;
  max_results?: number;
  max_tokens_per_page?: number;
  search_domain_filter?: string[];
  search_recency_filter?: 'hour' | 'day' | 'week' | 'month' | 'year';
  search_after_date_filter?: string;
  search_before_date_filter?: string;
};

function resolveApiKey(explicit?: string): string {
  const key = explicit ?? process.env.PERPLEXITY_API_KEY ?? process.env.PPLX_API_KEY;
  if (!key) {
    throw new Error(
      'Perplexity API key is required. Pass { apiKey } or set the PERPLEXITY_API_KEY (or PPLX_API_KEY) environment variable.',
    );
  }
  return key;
}

export async function perplexitySearchRequest(
  body: PerplexitySearchRequest,
  options?: PerplexityClientOptions,
): Promise<PerplexitySearchResponse> {
  const apiKey = resolveApiKey(options?.apiKey);
  const baseUrl = options?.baseUrl ?? DEFAULT_BASE_URL;
  const fetchImpl = options?.fetch ?? fetch;

  const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const rawText = await response.text().catch(() => '');
    const MAX_ERROR_BODY = 1000;
    const text =
      rawText.length > MAX_ERROR_BODY ? `${rawText.slice(0, MAX_ERROR_BODY)}…` : rawText;
    throw new Error(
      `Perplexity Search request failed with status ${response.status}${text ? `: ${text}` : ''}`,
    );
  }

  const json = (await response.json()) as Partial<PerplexitySearchResponse>;
  return {
    id: json.id,
    results: Array.isArray(json.results) ? json.results : [],
  };
}
