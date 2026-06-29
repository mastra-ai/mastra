import { tavily } from '@tavily/core';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getTavilyClient } from '../client.js';

vi.mock('@tavily/core', () => ({
  tavily: vi.fn(() => ({
    search: vi.fn(),
    extract: vi.fn(),
    crawl: vi.fn(),
    map: vi.fn(),
  })),
}));

describe('getTavilyClient', () => {
  const originalEnv = process.env.TAVILY_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TAVILY_API_KEY;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.TAVILY_API_KEY = originalEnv;
    } else {
      delete process.env.TAVILY_API_KEY;
    }
  });

  it('should throw if no API key is provided and env var is not set', () => {
    expect(() => getTavilyClient()).toThrow('Tavily API key is required');
  });

  it('should use the API key from config', () => {
    getTavilyClient({ apiKey: 'test-key-123' });
    expect(tavily).toHaveBeenCalledWith({ apiKey: 'test-key-123', clientSource: 'mastra' });
  });

  it('should fall back to TAVILY_API_KEY env var', () => {
    process.env.TAVILY_API_KEY = 'env-key-456';
    getTavilyClient();
    expect(tavily).toHaveBeenCalledWith({ apiKey: 'env-key-456', clientSource: 'mastra' });
  });

  it('should prefer config.apiKey over env var', () => {
    process.env.TAVILY_API_KEY = 'env-key-456';
    getTavilyClient({ apiKey: 'config-key-789' });
    expect(tavily).toHaveBeenCalledWith({ apiKey: 'config-key-789', clientSource: 'mastra' });
  });

  it('should allow overriding clientSource', () => {
    getTavilyClient({ apiKey: 'test-key', clientSource: 'custom-app' });
    expect(tavily).toHaveBeenCalledWith({ apiKey: 'test-key', clientSource: 'custom-app' });
  });

  it('should return a client object', () => {
    const client = getTavilyClient({ apiKey: 'test-key' });
    expect(client).toBeDefined();
    expect(client.search).toBeDefined();
    expect(client.extract).toBeDefined();
    expect(client.crawl).toBeDefined();
    expect(client.map).toBeDefined();
  });
});
