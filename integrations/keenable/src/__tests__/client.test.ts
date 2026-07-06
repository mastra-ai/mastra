import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { getKeenableClient } from '../client.js';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('getKeenableClient', () => {
  const originalKey = process.env.KEENABLE_API_KEY;
  const originalUrl = process.env.KEENABLE_API_URL;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    delete process.env.KEENABLE_API_KEY;
    delete process.env.KEENABLE_API_URL;
    mockFetch = vi.fn().mockResolvedValue(jsonResponse({ query: 'q', results: [] }));
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalKey !== undefined) process.env.KEENABLE_API_KEY = originalKey;
    else delete process.env.KEENABLE_API_KEY;
    if (originalUrl !== undefined) process.env.KEENABLE_API_URL = originalUrl;
    else delete process.env.KEENABLE_API_URL;
  });

  it('uses the keyless public endpoint and attribution header when no key is set', async () => {
    await getKeenableClient().search('hello');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.keenable.ai/v1/search/public');
    expect(init.method).toBe('POST');
    expect(init.headers['X-Keenable-Title']).toBe('Mastra');
    expect(init.headers['X-API-Key']).toBeUndefined();
    expect(JSON.parse(init.body)).toMatchObject({ query: 'hello', mode: 'pro' });
  });

  it('switches to the keyed endpoint and sends X-API-Key when a key is set', async () => {
    await getKeenableClient({ apiKey: 'keen_test' }).search('hello');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.keenable.ai/v1/search');
    expect(init.headers['X-API-Key']).toBe('keen_test');
  });

  it('falls back to KEENABLE_API_KEY env var', async () => {
    process.env.KEENABLE_API_KEY = 'keen_env';
    await getKeenableClient().search('hi');
    expect(mockFetch.mock.calls[0][1].headers['X-API-Key']).toBe('keen_env');
  });

  it('honors a custom baseUrl and clientSource', async () => {
    await getKeenableClient({ baseUrl: 'https://api.example.com/', clientSource: 'custom-app' }).search('hi');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.example.com/v1/search/public');
    expect(init.headers['X-Keenable-Title']).toBe('custom-app');
  });

  it('maps search results and trims to maxResults', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        query: 'ts',
        results: [
          {
            title: 'A',
            url: 'https://a.com',
            description: 'da',
            published_at: '2026-01-01',
            acquired_at: '2026-01-02',
          },
          { title: 'B', url: 'https://b.com' },
          { title: 'C', url: 'https://c.com' },
        ],
      }),
    );
    const res = await getKeenableClient().search('ts', { maxResults: 2 });
    expect(res.results).toHaveLength(2);
    expect(res.results[0]).toEqual({
      title: 'A',
      url: 'https://a.com',
      description: 'da',
      publishedAt: '2026-01-01',
      acquiredAt: '2026-01-02',
    });
  });

  it('fetches a page from the keyless endpoint with the url query param', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ url: 'https://x.com', title: 'X', content: '# X' }));
    const page = await getKeenableClient().fetch('https://x.com/a b');
    expect(mockFetch.mock.calls[0][0]).toBe('https://api.keenable.ai/v1/fetch/public?url=https%3A%2F%2Fx.com%2Fa%20b');
    expect(page).toMatchObject({ url: 'https://x.com', title: 'X', content: '# X' });
  });

  it('throws a helpful error on a non-2xx response', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ message: 'rate limited' }, false, 429));
    await expect(getKeenableClient().search('x')).rejects.toThrow(/Keenable search failed \(429\): rate limited/);
  });
});
