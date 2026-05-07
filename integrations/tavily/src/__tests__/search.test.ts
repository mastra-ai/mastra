import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSearch = vi.fn();

vi.mock('@tavily/core', () => ({
  tavily: vi.fn(() => ({
    search: mockSearch,
    extract: vi.fn(),
    crawl: vi.fn(),
    map: vi.fn(),
  })),
}));

import { createTavilySearchTool } from '../search.js';

describe('createTavilySearchTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearch.mockResolvedValue({
      query: 'test query',
      answer: 'Test answer',
      images: [{ url: 'https://example.com/img.png', description: 'An image' }],
      results: [
        {
          title: 'Result 1',
          url: 'https://example.com',
          content: 'Content of result 1',
          score: 0.95,
          rawContent: 'Raw content',
        },
      ],
      responseTime: 1.5,
    });
  });

  it('should create a tool with correct id and description', () => {
    const tool = createTavilySearchTool({ apiKey: 'test-key' });
    expect(tool.id).toBe('tavily-search');
    expect(tool.description).toBeDefined();
    expect(tool.description!.length).toBeGreaterThan(0);
  });

  it('should have inputSchema and outputSchema', () => {
    const tool = createTavilySearchTool({ apiKey: 'test-key' });
    expect(tool.inputSchema).toBeDefined();
    expect(tool.outputSchema).toBeDefined();
  });

  it('should call client.search with mapped parameters', async () => {
    const tool = createTavilySearchTool({ apiKey: 'test-key' });

    const result = await tool.execute!(
      {
        query: 'test query',
        searchDepth: 'advanced',
        maxResults: 5,
        includeAnswer: true,
        includeImages: true,
        timeRange: 'week',
      },
      {} as any,
    );

    expect(mockSearch).toHaveBeenCalledWith('test query', {
      searchDepth: 'advanced',
      maxResults: 5,
      includeAnswer: true,
      includeImages: true,
      includeImageDescriptions: undefined,
      includeRawContent: undefined,
      includeDomains: undefined,
      excludeDomains: undefined,
      timeRange: 'week',
    });

    expect(result).toEqual({
      query: 'test query',
      answer: 'Test answer',
      images: [{ url: 'https://example.com/img.png', description: 'An image' }],
      results: [
        {
          title: 'Result 1',
          url: 'https://example.com',
          content: 'Content of result 1',
          score: 0.95,
          rawContent: 'Raw content',
        },
      ],
      responseTime: 1.5,
    });
  });

  it('should handle minimal input (only query)', async () => {
    const tool = createTavilySearchTool({ apiKey: 'test-key' });

    await tool.execute!({ query: 'simple search' }, {} as any);

    expect(mockSearch).toHaveBeenCalledWith('simple search', {
      searchDepth: undefined,
      maxResults: undefined,
      includeAnswer: undefined,
      includeImages: undefined,
      includeImageDescriptions: undefined,
      includeRawContent: undefined,
      includeDomains: undefined,
      excludeDomains: undefined,
      timeRange: undefined,
    });
  });

  it('should handle string images in response', async () => {
    mockSearch.mockResolvedValue({
      query: 'test',
      results: [],
      images: ['https://example.com/img1.png', 'https://example.com/img2.png'],
      responseTime: 1.0,
    });

    const tool = createTavilySearchTool({ apiKey: 'test-key' });
    const result = (await tool.execute!({ query: 'test' }, {} as any)) as any;

    expect(result.images).toEqual([
      { url: 'https://example.com/img1.png', description: undefined },
      { url: 'https://example.com/img2.png', description: undefined },
    ]);
  });

  it('should let errors propagate', async () => {
    mockSearch.mockRejectedValue(new Error('API rate limit exceeded'));

    const tool = createTavilySearchTool({ apiKey: 'test-key' });

    await expect(tool.execute!({ query: 'test' }, {} as any)).rejects.toThrow('API rate limit exceeded');
  });

  it('should handle empty results', async () => {
    mockSearch.mockResolvedValue({
      query: 'test',
      results: undefined,
      responseTime: 1.0,
    });

    const tool = createTavilySearchTool({ apiKey: 'test-key' });
    const result = (await tool.execute!({ query: 'test' }, {} as any)) as any;

    expect(result.results).toEqual([]);
  });
});
