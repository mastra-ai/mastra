const DEFAULT_BASE_URL = 'https://api.keenable.ai';

export interface KeenableClientOptions {
  /** Keenable API key. Keyless by default (rate-limited); a key lifts the hourly cap. Falls back to `KEENABLE_API_KEY`. */
  apiKey?: string;
  /** API base URL. Falls back to `KEENABLE_API_URL`, then `https://api.keenable.ai`. */
  baseUrl?: string;
  /** Attribution tag Keenable segments integration traffic by. Defaults to `'Mastra'`. */
  clientSource?: string;
}

export interface KeenableSearchOptions {
  /** Restrict results to a single domain, e.g. `'techcrunch.com'`. */
  site?: string;
  /** Only pages published on or after this date (YYYY-MM-DD). */
  publishedAfter?: string;
  /** Only pages published on or before this date (YYYY-MM-DD). */
  publishedBefore?: string;
  /** Only pages indexed on or after this date (YYYY-MM-DD). */
  acquiredAfter?: string;
  /** Only pages indexed on or before this date (YYYY-MM-DD). */
  acquiredBefore?: string;
  /** Cap the number of results returned (the API returns a fixed-size set; extras are trimmed client-side). */
  maxResults?: number;
}

export interface KeenableSearchResult {
  title: string;
  url: string;
  description?: string;
  publishedAt?: string;
  acquiredAt?: string;
}

export interface KeenableSearchResponse {
  query: string;
  results: KeenableSearchResult[];
}

export interface KeenablePage {
  url: string;
  title?: string;
  content?: string;
  description?: string;
  author?: string;
  publishedAt?: string;
}

export interface KeenableClient {
  search(query: string, options?: KeenableSearchOptions): Promise<KeenableSearchResponse>;
  fetch(url: string): Promise<KeenablePage>;
}

async function readError(res: Response): Promise<string> {
  // Read the body exactly once: a Response stream can only be consumed a single
  // time, so we cannot call json() and then fall back to text(). Read text and
  // opportunistically parse it as JSON.
  let raw = '';
  try {
    raw = await res.text();
  } catch {
    return '';
  }
  try {
    const body: any = JSON.parse(raw);
    if (body && typeof body === 'object') {
      return String(body.message || body.error || body.detail || '');
    }
  } catch {
    // Not JSON; fall through to the raw text.
  }
  return raw.trim();
}

/**
 * Build a Keenable API client. Keyless by default: with no key it calls the
 * public endpoints (rate-limited); a key switches to the authenticated
 * endpoints and lifts the cap. No third-party SDK, just a thin `fetch` wrapper.
 */
export function getKeenableClient(config?: KeenableClientOptions): KeenableClient {
  const apiKey = (config?.apiKey ?? process.env.KEENABLE_API_KEY)?.trim() || undefined;
  const baseUrl = (config?.baseUrl ?? process.env.KEENABLE_API_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const clientSource = config?.clientSource ?? 'Mastra';

  function headers(json: boolean): Record<string, string> {
    const h: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'keenable-mastra',
      'X-Keenable-Title': clientSource,
    };
    if (json) h['Content-Type'] = 'application/json';
    if (apiKey) h['X-API-Key'] = apiKey;
    return h;
  }

  return {
    async search(query, options = {}) {
      const payload: Record<string, unknown> = { query, mode: 'pro' };
      if (options.site) payload.site = options.site;
      if (options.publishedAfter) payload.published_after = options.publishedAfter;
      if (options.publishedBefore) payload.published_before = options.publishedBefore;
      if (options.acquiredAfter) payload.acquired_after = options.acquiredAfter;
      if (options.acquiredBefore) payload.acquired_before = options.acquiredBefore;

      const path = apiKey ? '/v1/search' : '/v1/search/public';
      const res = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: headers(true),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(`Keenable search failed (${res.status}): ${await readError(res)}`.trim());
      }
      const data: any = await res.json();
      let results: KeenableSearchResult[] = (data?.results ?? []).map((r: any) => ({
        title: r.title,
        url: r.url,
        description: r.description || undefined,
        publishedAt: r.published_at || undefined,
        acquiredAt: r.acquired_at || undefined,
      }));
      if (typeof options.maxResults === 'number') {
        results = results.slice(0, options.maxResults);
      }
      return { query: data?.query ?? query, results };
    },

    async fetch(url) {
      const path = apiKey ? '/v1/fetch' : '/v1/fetch/public';
      const res = await fetch(`${baseUrl}${path}?url=${encodeURIComponent(url)}`, {
        method: 'GET',
        headers: headers(false),
      });
      if (!res.ok) {
        throw new Error(`Keenable fetch failed (${res.status}): ${await readError(res)}`.trim());
      }
      const data: any = await res.json();
      return {
        url: data?.url ?? url,
        title: data?.title || undefined,
        content: data?.content || undefined,
        description: data?.description || undefined,
        author: data?.author || undefined,
        publishedAt: data?.published_at || undefined,
      };
    },
  };
}
