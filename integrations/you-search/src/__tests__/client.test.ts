import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { youSearchRequest, INTEGRATION_USER_AGENT } from '../client.js';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const EMPTY_RESULTS = { results: { web: [], news: [] } };

describe('youSearchRequest', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    delete process.env.YDC_API_KEY;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it('uses the keyless endpoint with no API key header when no key is configured', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(EMPTY_RESULTS));

    await youSearchRequest({ query: 'hello' }, { fetch: fetchMock });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://api.you.com/v1/agents/search?query=hello');
    expect((init as RequestInit).headers).not.toHaveProperty('X-API-Key');
  });

  it('uses the keyed endpoint with the X-API-Key header when a key is passed explicitly', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(EMPTY_RESULTS));

    await youSearchRequest({ query: 'hello' }, { apiKey: 'explicit-key', fetch: fetchMock });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://ydc-index.io/v1/search?query=hello');
    expect((init as RequestInit).headers).toMatchObject({ 'X-API-Key': 'explicit-key' });
  });

  it('falls back to the YDC_API_KEY environment variable', async () => {
    process.env.YDC_API_KEY = 'env-key';

    const fetchMock = vi.fn(async () => jsonResponse(EMPTY_RESULTS));

    await youSearchRequest({ query: 'hello' }, { fetch: fetchMock });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('https://ydc-index.io/v1/search');
    expect((init as RequestInit).headers).toMatchObject({ 'X-API-Key': 'env-key' });
  });

  it('explicit apiKey overrides the environment variable', async () => {
    process.env.YDC_API_KEY = 'env-key';

    const fetchMock = vi.fn(async () => jsonResponse(EMPTY_RESULTS));

    await youSearchRequest({ query: 'q' }, { apiKey: 'explicit-key', fetch: fetchMock });

    const [, init] = fetchMock.mock.calls[0]!;
    expect((init as RequestInit).headers).toMatchObject({ 'X-API-Key': 'explicit-key' });
  });

  it('always sends the integration User-Agent on both tiers', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(EMPTY_RESULTS));

    await youSearchRequest({ query: 'q' }, { fetch: fetchMock });
    await youSearchRequest({ query: 'q' }, { apiKey: 'k', fetch: fetchMock });

    for (const call of fetchMock.mock.calls) {
      expect((call[1] as RequestInit).headers).toMatchObject({
        'User-Agent': INTEGRATION_USER_AGENT,
      });
    }
  });

  it('serializes request parameters as query string values', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(EMPTY_RESULTS));

    await youSearchRequest(
      {
        query: 'mastra agent framework',
        count: 7,
        freshness: 'week',
        country: 'US',
        language: 'EN',
        safesearch: 'moderate',
        include_domains: ['mastra.ai', 'docs.mastra.ai'],
      },
      { apiKey: 'k', fetch: fetchMock, baseUrl: 'https://example.test/' },
    );

    const [url] = fetchMock.mock.calls[0]!;
    const parsed = new URL(String(url));
    expect(parsed.origin + parsed.pathname).toBe('https://example.test/v1/search');
    expect(parsed.searchParams.get('query')).toBe('mastra agent framework');
    expect(parsed.searchParams.get('count')).toBe('7');
    expect(parsed.searchParams.get('freshness')).toBe('week');
    expect(parsed.searchParams.get('country')).toBe('US');
    expect(parsed.searchParams.get('language')).toBe('EN');
    expect(parsed.searchParams.get('safesearch')).toBe('moderate');
    expect(parsed.searchParams.get('include_domains')).toBe('mastra.ai,docs.mastra.ai');
    expect(parsed.searchParams.get('exclude_domains')).toBeNull();
  });

  it('omits unset parameters from the query string', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(EMPTY_RESULTS));

    await youSearchRequest({ query: 'q' }, { apiKey: 'k', fetch: fetchMock });

    const [url] = fetchMock.mock.calls[0]!;
    const parsed = new URL(String(url));
    expect([...parsed.searchParams.keys()]).toEqual(['query']);
  });

  it('throws a rate-limit error with upgrade guidance on keyless 402/429 responses', async () => {
    for (const status of [402, 429]) {
      const fetchMock = vi.fn(async () =>
        new Response(JSON.stringify({ error: 'rate_limit_exceeded' }), { status }),
      );

      await expect(youSearchRequest({ query: 'q' }, { fetch: fetchMock })).rejects.toThrow(
        /rate limit reached.*YDC_API_KEY.*you\.com\/platform/s,
      );
    }
  });

  it('throws a descriptive error on keyed non-2xx responses', async () => {
    const fetchMock = vi.fn(async () => new Response('invalid key', { status: 401 }));

    await expect(
      youSearchRequest({ query: 'q' }, { apiKey: 'k', fetch: fetchMock }),
    ).rejects.toThrow(/401.*invalid key/);
  });

  it('truncates long error response bodies to 1000 chars', async () => {
    const huge = 'x'.repeat(5000);
    const fetchMock = vi.fn(async () => new Response(huge, { status: 500 }));

    await expect(
      youSearchRequest({ query: 'q' }, { apiKey: 'k', fetch: fetchMock }),
    ).rejects.toThrow(new RegExp(`status 500: x{1000}…$`));
  });

  it('normalizes missing result sections to empty arrays', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ metadata: { query: 'q' } }));

    const out = await youSearchRequest({ query: 'q' }, { apiKey: 'k', fetch: fetchMock });

    expect(out.results).toEqual({ web: [], news: [] });
    expect(out.metadata).toEqual({ query: 'q' });
  });
});
