import { bdclient } from '@brightdata/sdk';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { closeClient, getBrightDataClient } from '../client.js';

vi.mock('@brightdata/sdk', () => ({
  bdclient: vi.fn(function () {
    return {
      search: { google: vi.fn(), bing: vi.fn(), yandex: vi.fn() },
      scrapeUrl: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    };
  }),
}));

describe('getBrightDataClient', () => {
  const originalEnv = process.env.BRIGHTDATA_API_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.BRIGHTDATA_API_TOKEN;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.BRIGHTDATA_API_TOKEN = originalEnv;
    } else {
      delete process.env.BRIGHTDATA_API_TOKEN;
    }
  });

  it('should throw if no API token is provided and env var is not set', () => {
    expect(() => getBrightDataClient()).toThrow('Bright Data API token is required');
  });

  it('should use the API key from config', () => {
    getBrightDataClient({ apiKey: 'test-key-123' });
    expect(bdclient).toHaveBeenCalledWith({ apiKey: 'test-key-123' });
  });

  it('should fall back to BRIGHTDATA_API_TOKEN env var', () => {
    process.env.BRIGHTDATA_API_TOKEN = 'env-key-456';
    getBrightDataClient();
    expect(bdclient).toHaveBeenCalledWith({ apiKey: 'env-key-456' });
  });

  it('should prefer config.apiKey over env var', () => {
    process.env.BRIGHTDATA_API_TOKEN = 'env-key-456';
    getBrightDataClient({ apiKey: 'config-key-789' });
    expect(bdclient).toHaveBeenCalledWith({ apiKey: 'config-key-789' });
  });

  it('should pass through additional options', () => {
    getBrightDataClient({ apiKey: 'test-key', timeout: 60000, webUnlockerZone: 'my_zone' });
    expect(bdclient).toHaveBeenCalledWith({
      apiKey: 'test-key',
      timeout: 60000,
      webUnlockerZone: 'my_zone',
    });
  });

  it('should return a client object', () => {
    const client = getBrightDataClient({ apiKey: 'test-key' });
    expect(client).toBeDefined();
    expect(client.search).toBeDefined();
    expect(client.scrapeUrl).toBeDefined();
  });
});

describe('closeClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call close() on the client', async () => {
    const client = getBrightDataClient({ apiKey: 'a' }) as unknown as {
      close: ReturnType<typeof vi.fn>;
    };

    await closeClient(client as any);

    expect(client.close).toHaveBeenCalledTimes(1);
  });

  it('should be a no-op when the client has no close method', async () => {
    const client = { search: {}, scrapeUrl: vi.fn() };

    await expect(closeClient(client as any)).resolves.toBeUndefined();
  });

  it('should swallow errors thrown by close() so they cannot mask the primary error', async () => {
    const client = { close: vi.fn().mockRejectedValue(new Error('close failed')) };

    await expect(closeClient(client as any)).resolves.toBeUndefined();
    expect(client.close).toHaveBeenCalledTimes(1);
  });
});
