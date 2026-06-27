const DEFAULT_BASE_URL = 'https://sofya.co/v1';

export interface SofyaClientOptions {
  /** Sofya API key. Falls back to the `SOFYA_API_KEY` environment variable. */
  apiKey?: string;
  /** Base URL for the Sofya API. Defaults to `https://sofya.co/v1`. */
  baseUrl?: string;
  /** Attribution string sent with each request. Defaults to `mastra`. */
  clientSource?: string;
}

export interface SofyaSearchParams {
  query: string;
  searchDepth?: 'snippets' | 'basic';
  maxResults?: number;
  includeAnswer?: boolean;
  includeDomains?: string[];
  excludeDomains?: string[];
  topic?: 'general' | 'news';
  freshness?: string;
}

export interface SofyaSearchResult {
  title: string;
  url: string;
  content: string;
  description?: string | null;
  fetched?: boolean;
  published_date?: string | null;
}

export interface SofyaSearchResponse {
  query: string;
  answer?: string | null;
  results: SofyaSearchResult[];
  search_depth?: string;
  topic?: string;
  credits_used: number;
  credits_remaining: number;
}

export interface SofyaFetchParams {
  urls: string[];
  includeRawHtml?: boolean;
}

export interface SofyaFetchResult {
  title?: string | null;
  url: string;
  content: string;
  raw_html?: string | null;
  published_time?: string | null;
  success: boolean;
  error?: string | null;
}

export interface SofyaFetchResponse {
  results: SofyaFetchResult[];
  credits_used: number;
  credits_remaining: number;
}

export interface SofyaExtractParams {
  url: string;
  prompt: string;
}

export interface SofyaExtractResponse {
  content: string;
  url: string;
  credits_used: number;
  credits_remaining: number;
  usage?: Record<string, unknown>;
}

export interface SofyaResearchParams {
  query: string;
  topic?: 'general' | 'news';
  freshness?: string;
  maxSources?: number;
}

export interface SofyaResearchSource {
  title: string;
  url: string;
  fetched?: boolean;
}

export interface SofyaResearchResponse {
  query: string;
  report: string;
  sources: SofyaResearchSource[];
  sub_queries?: string[];
  credits_used: number;
  credits_remaining: number;
  usage?: Record<string, unknown>;
}

export interface SofyaClient {
  search(params: SofyaSearchParams): Promise<SofyaSearchResponse>;
  fetch(params: SofyaFetchParams): Promise<SofyaFetchResponse>;
  extract(params: SofyaExtractParams): Promise<SofyaExtractResponse>;
  research(params: SofyaResearchParams): Promise<SofyaResearchResponse>;
}

function dropUndefined(body: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined));
}

export function getSofyaClient(config?: SofyaClientOptions): SofyaClient {
  const apiKey = config?.apiKey ?? process.env.SOFYA_API_KEY;
  if (!apiKey) {
    throw new Error('Sofya API key is required. Pass { apiKey } or set SOFYA_API_KEY env var.');
  }

  const baseUrl = (config?.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  const clientSource = config?.clientSource ?? 'mastra';

  async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-Client-Source': clientSource,
      },
      body: JSON.stringify(dropUndefined(body)),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Sofya request to ${path} failed: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ''}`);
    }

    return (await response.json()) as T;
  }

  return {
    search(params) {
      return post<SofyaSearchResponse>('/search', {
        query: params.query,
        search_depth: params.searchDepth,
        max_results: params.maxResults,
        include_answer: params.includeAnswer,
        include_domains: params.includeDomains,
        exclude_domains: params.excludeDomains,
        topic: params.topic,
        freshness: params.freshness,
      });
    },
    fetch(params) {
      return post<SofyaFetchResponse>('/fetch', {
        urls: params.urls,
        include_raw_html: params.includeRawHtml,
      });
    },
    extract(params) {
      return post<SofyaExtractResponse>('/extract', {
        url: params.url,
        prompt: params.prompt,
      });
    },
    research(params) {
      return post<SofyaResearchResponse>('/research', {
        query: params.query,
        topic: params.topic,
        freshness: params.freshness,
        max_sources: params.maxSources,
      });
    },
  };
}
