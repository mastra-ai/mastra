import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSearch } = vi.hoisted(() => ({ mockSearch: vi.fn() }));

vi.mock('firecrawl', () => ({
  Firecrawl: vi.fn(function FirecrawlClient() {
    return { search: mockSearch, scrape: vi.fn() };
  }),
}));

import { createFirecrawlSearchTool, toSearchRequest } from '../search.js';

const context = {} as any;

describe('createFirecrawlSearchTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearch.mockResolvedValue({
      web: [{ url: 'https://example.com', title: 'Example', description: 'An example site', category: 'github' }],
      news: [{ url: 'https://news.example.com/a', title: 'News', snippet: 'Snippet', date: '2 hours ago' }],
      images: [{ url: 'https://example.com/page', imageUrl: 'https://example.com/i.png', imageWidth: 10 }],
    });
  });

  it('has the expected id, description and schemas', () => {
    const tool = createFirecrawlSearchTool({ apiKey: 'fc-test' });
    expect(tool.id).toBe('firecrawl-search');
    expect(tool.description).toContain('Firecrawl');
    expect(tool.inputSchema).toBeDefined();
    expect(tool.outputSchema).toBeDefined();
  });

  it('calls search(query, options) with mapped parameters', async () => {
    const tool = createFirecrawlSearchTool({ apiKey: 'fc-test' });
    await tool.execute!(
      {
        query: 'mastra',
        limit: 5,
        sources: ['web', 'news'],
        categories: ['github'],
        includeDomains: ['github.com'],
        excludeDomains: ['spam.example'],
        tbs: 'qdr:w',
        location: 'Germany',
        timeout: 30_000,
        scrapeContent: true,
      },
      context,
    );

    expect(mockSearch).toHaveBeenCalledWith('mastra', {
      limit: 5,
      sources: ['web', 'news'],
      categories: ['github'],
      includeDomains: ['github.com'],
      excludeDomains: ['spam.example'],
      tbs: 'qdr:w',
      location: 'Germany',
      timeout: 30_000,
      scrapeOptions: { formats: ['markdown'] },
    });
  });

  it('omits undefined options so the SDK defaults apply', () => {
    expect(toSearchRequest({ query: 'q' })).toEqual({ query: 'q' });
    expect(toSearchRequest({ query: 'q', scrapeContent: false })).toEqual({ query: 'q' });
  });

  it('normalizes web, news and image results', async () => {
    const tool = createFirecrawlSearchTool({ apiKey: 'fc-test' });
    const output = await tool.execute!({ query: 'mastra' }, context);

    expect(output).toEqual({
      web: [{ url: 'https://example.com', title: 'Example', description: 'An example site', category: 'github' }],
      news: [{ url: 'https://news.example.com/a', title: 'News', snippet: 'Snippet', date: '2 hours ago' }],
      images: [{ url: 'https://example.com/page', imageUrl: 'https://example.com/i.png', imageWidth: 10 }],
    });
  });

  it('maps scraped documents in web results to url/title/markdown', async () => {
    mockSearch.mockResolvedValue({
      web: [
        {
          markdown: '# Hello',
          metadata: { sourceURL: 'https://example.com/doc', title: 'Doc', description: 'D', statusCode: 200 },
        },
      ],
    });
    const tool = createFirecrawlSearchTool({ apiKey: 'fc-test' });
    const output = await tool.execute!({ query: 'mastra', scrapeContent: true }, context);

    expect(output).toEqual({
      web: [{ url: 'https://example.com/doc', title: 'Doc', description: 'D', markdown: '# Hello' }],
      news: [],
      images: [],
    });
  });

  it('returns empty arrays when the SDK omits a source', async () => {
    mockSearch.mockResolvedValue({});
    const tool = createFirecrawlSearchTool({ apiKey: 'fc-test' });
    await expect(tool.execute!({ query: 'mastra' }, context)).resolves.toEqual({ web: [], news: [], images: [] });
  });

  it('propagates SDK errors', async () => {
    mockSearch.mockRejectedValue(new Error('rate limited'));
    const tool = createFirecrawlSearchTool({ apiKey: 'fc-test' });
    await expect(tool.execute!({ query: 'mastra' }, context)).rejects.toThrow('rate limited');
  });
});
