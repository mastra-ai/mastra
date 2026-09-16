import { describe, expect, it, vi } from 'vitest';

const { mockFirecrawl } = vi.hoisted(() => ({
  mockFirecrawl: vi.fn(function FirecrawlClient() {
    return { search: vi.fn(), scrape: vi.fn() };
  }),
}));

vi.mock('firecrawl', () => ({ Firecrawl: mockFirecrawl }));

import { createFirecrawlTools } from '../tools.js';

describe('createFirecrawlTools', () => {
  it('returns both configured tools without constructing clients', () => {
    const tools = createFirecrawlTools({ apiKey: 'fc-test' });

    expect(Object.keys(tools)).toEqual(['firecrawlSearch', 'firecrawlScrape']);
    expect(tools.firecrawlSearch.id).toBe('firecrawl-search');
    expect(tools.firecrawlScrape.id).toBe('firecrawl-scrape');
    expect(tools.firecrawlSearch.inputSchema).toBeDefined();
    expect(tools.firecrawlSearch.outputSchema).toBeDefined();
    expect(tools.firecrawlScrape.inputSchema).toBeDefined();
    expect(tools.firecrawlScrape.outputSchema).toBeDefined();
    expect(mockFirecrawl).not.toHaveBeenCalled();
  });
});
