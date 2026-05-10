import { bdclient } from '@brightdata/sdk';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getBrightDataClient } from '../client.js';

vi.mock('@brightdata/sdk', () => ({
  bdclient: vi.fn(function () {
    return {
      search: { google: vi.fn(), bing: vi.fn(), yandex: vi.fn() },
      scrapeUrl: vi.fn(),
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
