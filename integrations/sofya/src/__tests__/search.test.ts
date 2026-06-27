import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSearch = vi.fn();

vi.mock('../client.js', () => ({
  getSofyaClient: vi.fn(() => ({
    search: mockSearch,
    fetch: vi.fn(),
    extract: vi.fn(),
    research: vi.fn(),
  })),
}));

import { createSofyaSearchTool } from '../search.js';

describe('createSofyaSearchTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearch.mockResolvedValue({
      query: 'test query',
      answer: 'Test answer',
      results: [
        {
          title: 'Result 1',
          url: 'https://example.com',
          content: 'Full page content',
          description: 'A description',
          fetched: true,
          published_date: '2026-01-01',
        },
      ],
      credits_used: 3,
      credits_remaining: 97,
    });
  });

  it('creates a tool with the correct id and schemas', () => {
    const tool = createSofyaSearchTool({ apiKey: 'test-key' });
    expect(tool.id).toBe('sofya-search');
    expect(tool.description).toBeDefined();
    expect(tool.inputSchema).toBeDefined();
    expect(tool.outputSchema).toBeDefined();
  });

  it('calls client.search with mapped parameters', async () => {
    const tool = createSofyaSearchTool({ apiKey: 'test-key' });

    await tool.execute!(
      { query: 'test query', searchDepth: 'basic', maxResults: 5, includeAnswer: true, topic: 'news', freshness: 'week' },
      {} as any,
    );

    expect(mockSearch).toHaveBeenCalledWith({
      query: 'test query',
      searchDepth: 'basic',
      maxResults: 5,
      includeAnswer: true,
      includeDomains: undefined,
      excludeDomains: undefined,
      topic: 'news',
      freshness: 'week',
    });
  });

  it('maps the snake_case response to camelCase output', async () => {
    const tool = createSofyaSearchTool({ apiKey: 'test-key' });

    const result = (await tool.execute!({ query: 'test query' }, {} as any)) as any;

    expect(result).toEqual({
      query: 'test query',
      answer: 'Test answer',
      results: [
        {
          title: 'Result 1',
          url: 'https://example.com',
          content: 'Full page content',
          description: 'A description',
          fetched: true,
          publishedDate: '2026-01-01',
        },
      ],
      creditsUsed: 3,
      creditsRemaining: 97,
    });
  });

  it('handles empty and missing optional fields', async () => {
    mockSearch.mockResolvedValue({ query: 'test', answer: null, results: undefined, credits_used: 1, credits_remaining: 9 });

    const tool = createSofyaSearchTool({ apiKey: 'test-key' });
    const result = (await tool.execute!({ query: 'test' }, {} as any)) as any;

    expect(result.answer).toBeUndefined();
    expect(result.results).toEqual([]);
  });

  it('lets errors propagate', async () => {
    mockSearch.mockRejectedValue(new Error('rate limit exceeded'));

    const tool = createSofyaSearchTool({ apiKey: 'test-key' });
    await expect(tool.execute!({ query: 'test' }, {} as any)).rejects.toThrow('rate limit exceeded');
  });
});
