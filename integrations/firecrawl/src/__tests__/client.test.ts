import { Firecrawl } from 'firecrawl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSearch, mockScrape } = vi.hoisted(() => ({
  mockSearch: vi.fn(),
  mockScrape: vi.fn(),
}));

vi.mock('firecrawl', () => ({
  Firecrawl: vi.fn(function FirecrawlClient() {
    return { search: mockSearch, scrape: mockScrape };
  }),
}));

import { createLazyFirecrawlClient, getFirecrawlClient } from '../client.js';

describe('getFirecrawlClient', () => {
  const originalApiKey = process.env.FIRECRAWL_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.FIRECRAWL_API_KEY;
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.FIRECRAWL_API_KEY;
    } else {
      process.env.FIRECRAWL_API_KEY = originalApiKey;
    }
  });

  it('throws a clear error when no API key is available', () => {
    expect(() => getFirecrawlClient()).toThrow(
      'Firecrawl API key is required. Pass { apiKey } or set the FIRECRAWL_API_KEY environment variable.',
    );
    expect(Firecrawl).not.toHaveBeenCalled();
  });

  it('passes explicit client options to the official SDK', () => {
    getFirecrawlClient({ apiKey: 'fc-explicit', apiUrl: 'https://firecrawl.example.test', maxRetries: 0 });

    expect(Firecrawl).toHaveBeenCalledWith({
      apiKey: 'fc-explicit',
      apiUrl: 'https://firecrawl.example.test',
      maxRetries: 0,
    });
  });

  it('falls back to FIRECRAWL_API_KEY', () => {
    process.env.FIRECRAWL_API_KEY = 'fc-env';

    getFirecrawlClient();

    expect(Firecrawl).toHaveBeenCalledWith({ apiKey: 'fc-env' });
  });

  it('prefers an explicit API key over the environment', () => {
    process.env.FIRECRAWL_API_KEY = 'fc-env';

    getFirecrawlClient({ apiKey: 'fc-explicit' });

    expect(Firecrawl).toHaveBeenCalledWith({ apiKey: 'fc-explicit' });
  });
});

describe('createLazyFirecrawlClient', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not construct a client until first use, then reuses it', () => {
    const getClient = createLazyFirecrawlClient({ apiKey: 'fc-lazy' });
    expect(Firecrawl).not.toHaveBeenCalled();

    const first = getClient();
    const second = getClient();

    expect(first).toBe(second);
    expect(Firecrawl).toHaveBeenCalledTimes(1);
  });
});
