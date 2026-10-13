import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { keenableFetchRequest, keenableSearchRequest, toIsoDate } from '../client.js';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('keenableSearchRequest', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    delete process.env.KEENABLE_API_KEY;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it('uses the keyless endpoint when no API key is configured', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ results: [] }));

    await keenableSearchRequest({ query: 'hello' }, { fetch: fetchMock });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.keenable.ai/v1/search/public');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).headers).toEqual({
      'X-Keenable-Title': 'mastra',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ query: 'hello' });
  });

  it('uses the authenticated endpoint with the key from KEENABLE_API_KEY', async () => {
    process.env.KEENABLE_API_KEY = 'env-key';
    const fetchMock = vi.fn(async () => jsonResponse({ results: [] }));

    await keenableSearchRequest({ query: 'hello' }, { fetch: fetchMock });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.keenable.ai/v1/search');
    expect((init as RequestInit).headers).toMatchObject({ 'X-API-Key': 'env-key', 'X-Keenable-Title': 'mastra' });
  });

  it('explicit apiKey overrides the environment variable', async () => {
    process.env.KEENABLE_API_KEY = 'env-key';
    const fetchMock = vi.fn(async () => jsonResponse({ results: [] }));

    await keenableSearchRequest({ query: 'q' }, { apiKey: 'explicit-key', fetch: fetchMock });

    const [, init] = fetchMock.mock.calls[0]!;
    expect((init as RequestInit).headers).toMatchObject({ 'X-API-Key': 'explicit-key' });
  });

  it('honours a custom base URL and strips trailing slashes', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ results: [] }));

    await keenableSearchRequest({ query: 'q' }, { baseUrl: 'https://proxy.example.com/', fetch: fetchMock });

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://proxy.example.com/v1/search/public');
  });

  it('returns an empty result list when the response has none', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ query: 'q' }));

    const out = await keenableSearchRequest({ query: 'q' }, { fetch: fetchMock });

    expect(out).toEqual({ query: 'q', results: [] });
  });

  it('throws with the status and body on a non-2xx response', async () => {
    const fetchMock = vi.fn(async () => new Response('{"error":"Rate limit exceeded"}', { status: 429 }));

    await expect(keenableSearchRequest({ query: 'q' }, { fetch: fetchMock })).rejects.toThrow(
      'Keenable Search request failed with status 429: {"error":"Rate limit exceeded"}',
    );
  });

  it('truncates a long error body', async () => {
    const fetchMock = vi.fn(async () => new Response('x'.repeat(5000), { status: 500 }));

    const error = await keenableSearchRequest({ query: 'q' }, { fetch: fetchMock }).catch(e => e as Error);

    expect(error.message.length).toBeLessThan(1100);
    expect(error.message.endsWith('…')).toBe(true);
  });
});

describe('keenableFetchRequest', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    delete process.env.KEENABLE_API_KEY;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it('sends a GET to the keyless endpoint with the URL encoded', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ url: 'https://a.test/x?y=1', content: '# A' }));

    const out = await keenableFetchRequest({ url: 'https://a.test/x?y=1', max_chars: 2000 }, { fetch: fetchMock });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.keenable.ai/v1/fetch/public?url=https%3A%2F%2Fa.test%2Fx%3Fy%3D1&max_chars=2000');
    expect((init as RequestInit).method).toBe('GET');
    expect((init as RequestInit).headers).toEqual({ 'X-Keenable-Title': 'mastra' });
    expect(out).toEqual({ url: 'https://a.test/x?y=1', content: '# A' });
  });

  it('uses the authenticated endpoint when a key is set', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ content: '# A' }));

    await keenableFetchRequest({ url: 'https://a.test' }, { apiKey: 'k', fetch: fetchMock });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.keenable.ai/v1/fetch?url=https%3A%2F%2Fa.test');
    expect((init as RequestInit).headers).toEqual({ 'X-Keenable-Title': 'mastra', 'X-API-Key': 'k' });
  });

  it('throws with the status and body on a non-2xx response', async () => {
    const fetchMock = vi.fn(async () => new Response('Invalid API key', { status: 401 }));

    await expect(keenableFetchRequest({ url: 'https://a.test' }, { apiKey: 'bad', fetch: fetchMock })).rejects.toThrow(
      'Keenable Fetch request failed with status 401: Invalid API key',
    );
  });
});

describe('toIsoDate', () => {
  it('converts Unix seconds to an ISO string', () => {
    expect(toIsoDate(1789398666)).toBe('2026-09-14T15:11:06.000Z');
  });

  it('passes ISO strings through and drops empty values', () => {
    expect(toIsoDate('2026-10-08T19:34:41Z')).toBe('2026-10-08T19:34:41Z');
    expect(toIsoDate('')).toBeUndefined();
    expect(toIsoDate(undefined)).toBeUndefined();
  });
});
