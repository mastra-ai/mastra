import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { closeClient, getBrightDataClient } from '../client.js';

const fetchMock = vi.fn();

describe('getBrightDataClient', () => {
  const originalApiToken = process.env.BRIGHTDATA_API_TOKEN;
  const originalSerpZone = process.env.BRIGHTDATA_SERP_ZONE;
  const originalWebUnlockerZone = process.env.BRIGHTDATA_WEB_UNLOCKER_ZONE;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    delete process.env.BRIGHTDATA_API_TOKEN;
    delete process.env.BRIGHTDATA_SERP_ZONE;
    delete process.env.BRIGHTDATA_WEB_UNLOCKER_ZONE;
    fetchMock.mockImplementation(async (_url, init: RequestInit) => {
      const body = typeof init.body === 'string' ? (JSON.parse(init.body) as { format?: string }) : {};

      return body.format === 'json' ? Response.json({}) : new Response('ok');
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();

    if (originalApiToken !== undefined) {
      process.env.BRIGHTDATA_API_TOKEN = originalApiToken;
    } else {
      delete process.env.BRIGHTDATA_API_TOKEN;
    }

    if (originalSerpZone !== undefined) {
      process.env.BRIGHTDATA_SERP_ZONE = originalSerpZone;
    } else {
      delete process.env.BRIGHTDATA_SERP_ZONE;
    }

    if (originalWebUnlockerZone !== undefined) {
      process.env.BRIGHTDATA_WEB_UNLOCKER_ZONE = originalWebUnlockerZone;
    } else {
      delete process.env.BRIGHTDATA_WEB_UNLOCKER_ZONE;
    }
  });

  it('should throw if no API token is provided and env var is not set', () => {
    expect(() => getBrightDataClient()).toThrow('Bright Data API token is required');
  });

  it('should use the API key from config', async () => {
    const client = getBrightDataClient({ apiKey: 'test-key-123' });

    await client.scrapeUrl('https://example.com');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.brightdata.com/request',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key-123',
        }),
      }),
    );
  });

  it('should fall back to BRIGHTDATA_API_TOKEN env var', async () => {
    process.env.BRIGHTDATA_API_TOKEN = 'env-key-456';
    const client = getBrightDataClient();

    await client.scrapeUrl('https://example.com');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.brightdata.com/request',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer env-key-456',
        }),
      }),
    );
  });

  it('should prefer config.apiKey over env var', async () => {
    process.env.BRIGHTDATA_API_TOKEN = 'env-key-456';
    const client = getBrightDataClient({ apiKey: 'config-key-789' });

    await client.scrapeUrl('https://example.com');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.brightdata.com/request',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer config-key-789',
        }),
      }),
    );
  });

  it('should use custom zones from config', async () => {
    const client = getBrightDataClient({
      apiKey: 'test-key',
      serpZone: 'my_serp',
      webUnlockerZone: 'my_unlocker',
    });

    await client.search.google('pizza');
    await client.scrapeUrl('https://example.com');

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      zone: 'my_serp',
    });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      zone: 'my_unlocker',
    });
  });

  it('should use custom zones from env vars', async () => {
    process.env.BRIGHTDATA_SERP_ZONE = 'env_serp';
    process.env.BRIGHTDATA_WEB_UNLOCKER_ZONE = 'env_unlocker';
    const client = getBrightDataClient({ apiKey: 'test-key' });

    await client.search.google('pizza');
    await client.scrapeUrl('https://example.com');

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      zone: 'env_serp',
    });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      zone: 'env_unlocker',
    });
  });

  it('should allow callers to override the Google results language', async () => {
    const client = getBrightDataClient({ apiKey: 'test-key' });

    await client.search.google('pizza', { language: 'es' });

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.url).toContain('hl=es');
  });

  it('should normalize the language code to lowercase', async () => {
    const client = getBrightDataClient({ apiKey: 'test-key' });

    await client.search.google('pizza', { language: 'EN' });

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.url).toContain('hl=en');
  });

  it('should reject an invalid language code before making a request', async () => {
    const client = getBrightDataClient({ apiKey: 'test-key' });

    await expect(client.search.google('pizza', { language: '1_' })).rejects.toThrow(
      'language must be a two-letter code',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should not request structured JSON when raw format is requested', async () => {
    const client = getBrightDataClient({ apiKey: 'test-key' });

    await client.search.google('pizza', { format: 'raw' });

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.url).not.toContain('brd_json');
  });

  it('should return a client object', () => {
    const client = getBrightDataClient({ apiKey: 'test-key' });
    expect(client).toBeDefined();
    expect(client.search.google).toBeDefined();
    expect(client.scrapeUrl).toBeDefined();
  });

  it('should map auth errors to the SDK-compatible message', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 401 }));
    const client = getBrightDataClient({ apiKey: 'test-key' });

    await expect(client.scrapeUrl('https://example.com')).rejects.toThrow(
      'invalid API key or insufficient permissions',
    );
  });
});

describe('closeClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call close() on the client', async () => {
    const client = {
      close: vi.fn().mockResolvedValue(undefined),
      scrapeUrl: vi.fn(),
      search: { google: vi.fn() },
    };

    await closeClient(client);

    expect(client.close).toHaveBeenCalledTimes(1);
  });

  it('should swallow errors thrown by close() so they cannot mask the primary error', async () => {
    const client = {
      close: vi.fn().mockRejectedValue(new Error('close failed')),
      scrapeUrl: vi.fn(),
      search: { google: vi.fn() },
    };

    await expect(closeClient(client)).resolves.toBeUndefined();
    expect(client.close).toHaveBeenCalledTimes(1);
  });
});
