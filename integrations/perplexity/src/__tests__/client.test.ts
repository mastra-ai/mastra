import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { perplexitySearchRequest } from '../client.js';

describe('perplexitySearchRequest', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    delete process.env.PERPLEXITY_API_KEY;
    delete process.env.PPLX_API_KEY;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it('throws when no API key is configured', async () => {
    await expect(perplexitySearchRequest({ query: 'hello' })).rejects.toThrow(/API key is required/);
  });

  it('falls back to PPLX_API_KEY when PERPLEXITY_API_KEY is missing', async () => {
    process.env.PPLX_API_KEY = 'env-key';

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: 'r-1', results: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await perplexitySearchRequest({ query: 'hello' }, { fetch: fetchMock });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0]!;
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer env-key' });
  });

  it('explicit apiKey overrides environment variables', async () => {
    process.env.PERPLEXITY_API_KEY = 'env-key';

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ results: [] }), { status: 200 }),
    );

    await perplexitySearchRequest({ query: 'q' }, { apiKey: 'explicit-key', fetch: fetchMock });

    const [, init] = fetchMock.mock.calls[0]!;
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer explicit-key' });
  });

  it('posts to /search at the configured base URL with the request body', async () => {
    process.env.PERPLEXITY_API_KEY = 'k';

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ results: [] }), { status: 200 }),
    );

    await perplexitySearchRequest(
      {
        query: 'mastra agent framework',
        max_results: 7,
        search_recency_filter: 'week',
        search_domain_filter: ['mastra.ai', '-pinterest.com'],
      },
      { apiKey: 'k', fetch: fetchMock, baseUrl: 'https://example.test/' },
    );

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.test/search');
    expect((init as RequestInit).method).toBe('POST');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      query: 'mastra agent framework',
      max_results: 7,
      search_recency_filter: 'week',
      search_domain_filter: ['mastra.ai', '-pinterest.com'],
    });
  });

  it('throws a descriptive error on non-2xx responses', async () => {
    const fetchMock = vi.fn(async () =>
      new Response('rate limited', { status: 429 }),
    );

    await expect(
      perplexitySearchRequest({ query: 'q' }, { apiKey: 'k', fetch: fetchMock }),
    ).rejects.toThrow(/429.*rate limited/);
  });

  it('normalizes a missing results field to an empty array', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: 'r' }), { status: 200 }),
    );

    const out = await perplexitySearchRequest(
      { query: 'q' },
      { apiKey: 'k', fetch: fetchMock },
    );

    expect(out).toEqual({ id: 'r', results: [] });
  });
});
