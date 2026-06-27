import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { getSofyaClient } from '../client.js';

const mockFetch = vi.fn();

function jsonResponse(body: unknown, ok = true, status = 200, statusText = 'OK') {
  return {
    ok,
    status,
    statusText,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe('getSofyaClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
    delete process.env.SOFYA_API_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws when no API key is provided or set in env', () => {
    expect(() => getSofyaClient()).toThrow(/SOFYA_API_KEY/);
  });

  it('reads the API key from the SOFYA_API_KEY env var', () => {
    process.env.SOFYA_API_KEY = 'env-key';
    expect(() => getSofyaClient()).not.toThrow();
  });

  it('sends auth header, attribution, and maps camelCase params to snake_case body', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ query: 'q', results: [], credits_used: 3, credits_remaining: 97 }));

    const client = getSofyaClient({ apiKey: 'test-key' });
    await client.search({ query: 'hello', maxResults: 5, searchDepth: 'basic', topic: 'news', includeAnswer: true });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://sofya.co/v1/search');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer test-key');
    expect(init.headers['X-Client-Source']).toBe('mastra');
    expect(JSON.parse(init.body)).toEqual({
      query: 'hello',
      max_results: 5,
      search_depth: 'basic',
      topic: 'news',
      include_answer: true,
    });
  });

  it('omits undefined params from the request body', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ results: [], credits_used: 1, credits_remaining: 9 }));

    const client = getSofyaClient({ apiKey: 'test-key' });
    await client.fetch({ urls: ['https://example.com'] });

    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ urls: ['https://example.com'] });
  });

  it('honors a custom baseUrl and clientSource', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ content: '', url: 'u', credits_used: 5, credits_remaining: 5 }));

    const client = getSofyaClient({ apiKey: 'k', baseUrl: 'https://proxy.example/v1/', clientSource: 'custom' });
    await client.extract({ url: 'https://example.com', prompt: 'x' });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://proxy.example/v1/extract');
    expect(init.headers['X-Client-Source']).toBe('custom');
  });

  it('throws a descriptive error on a non-ok response', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ error: 'bad key' }, false, 401, 'Unauthorized'));

    const client = getSofyaClient({ apiKey: 'k' });
    await expect(client.search({ query: 'x' })).rejects.toThrow(/401 Unauthorized/);
  });
});
