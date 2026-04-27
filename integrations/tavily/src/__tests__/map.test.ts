import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockMap = vi.fn();

vi.mock('@tavily/core', () => ({
  tavily: vi.fn(() => ({
    search: vi.fn(),
    extract: vi.fn(),
    crawl: vi.fn(),
    map: mockMap,
  })),
}));

import { createTavilyMapTool } from '../map.js';

describe('createTavilyMapTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMap.mockResolvedValue({
      baseUrl: 'https://example.com',
      results: [
        'https://example.com/about',
        'https://example.com/blog',
        'https://example.com/docs',
        'https://example.com/pricing',
      ],
      responseTime: 1.2,
    });
  });

  it('should create a tool with correct id', () => {
    const tool = createTavilyMapTool({ apiKey: 'test-key' });
    expect(tool.id).toBe('tavily-map');
    expect(tool.description).toBeDefined();
  });

  it('should have inputSchema and outputSchema', () => {
    const tool = createTavilyMapTool({ apiKey: 'test-key' });
    expect(tool.inputSchema).toBeDefined();
    expect(tool.outputSchema).toBeDefined();
  });

  it('should call client.map with mapped parameters', async () => {
    const tool = createTavilyMapTool({ apiKey: 'test-key' });

    const result = await tool.execute!(
      {
        url: 'https://example.com',
        maxDepth: 2,
        maxBreadth: 15,
        limit: 100,
        allowExternal: false,
      },
      {} as any,
    );

    expect(mockMap).toHaveBeenCalledWith('https://example.com', {
      maxDepth: 2,
      maxBreadth: 15,
      limit: 100,
      instructions: undefined,
      selectPaths: undefined,
      selectDomains: undefined,
      excludePaths: undefined,
      excludeDomains: undefined,
      allowExternal: false,
    });

    expect(result).toEqual({
      baseUrl: 'https://example.com',
      results: [
        'https://example.com/about',
        'https://example.com/blog',
        'https://example.com/docs',
        'https://example.com/pricing',
      ],
      responseTime: 1.2,
    });
  });

  it('should handle empty results', async () => {
    mockMap.mockResolvedValue({
      baseUrl: 'https://empty-site.com',
      results: [],
      responseTime: 0.3,
    });

    const tool = createTavilyMapTool({ apiKey: 'test-key' });
    const result = (await tool.execute!({ url: 'https://empty-site.com' }, {} as any)) as any;

    expect(result.results).toEqual([]);
  });

  it('should let errors propagate', async () => {
    mockMap.mockRejectedValue(new Error('DNS resolution failed'));

    const tool = createTavilyMapTool({ apiKey: 'test-key' });
    await expect(tool.execute!({ url: 'https://nonexistent.com' }, {} as any)).rejects.toThrow(
      'DNS resolution failed',
    );
  });
});
