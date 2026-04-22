import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCrawl = vi.fn();

vi.mock('@tavily/core', () => ({
  tavily: vi.fn(() => ({
    search: vi.fn(),
    extract: vi.fn(),
    crawl: mockCrawl,
    map: vi.fn(),
  })),
}));

import { createTavilyCrawlTool } from '../crawl.js';

describe('createTavilyCrawlTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCrawl.mockResolvedValue({
      baseUrl: 'https://docs.example.com',
      results: [
        {
          url: 'https://docs.example.com/getting-started',
          rawContent: '# Getting Started\nWelcome to the docs.',
        },
        {
          url: 'https://docs.example.com/api',
          rawContent: '# API Reference\nEndpoints documented here.',
          images: ['https://docs.example.com/diagram.png'],
        },
      ],
      responseTime: 5.3,
    });
  });

  it('should create a tool with correct id', () => {
    const tool = createTavilyCrawlTool({ apiKey: 'test-key' });
    expect(tool.id).toBe('tavily-crawl');
    expect(tool.description).toBeDefined();
  });

  it('should have inputSchema and outputSchema', () => {
    const tool = createTavilyCrawlTool({ apiKey: 'test-key' });
    expect(tool.inputSchema).toBeDefined();
    expect(tool.outputSchema).toBeDefined();
  });

  it('should call client.crawl with all parameters', async () => {
    const tool = createTavilyCrawlTool({ apiKey: 'test-key' });

    const result = await tool.execute!(
      {
        url: 'https://docs.example.com',
        maxDepth: 3,
        maxBreadth: 10,
        limit: 50,
        instructions: 'Only crawl documentation pages',
        selectPaths: ['/docs/.*'],
        selectDomains: ['^docs\\.example\\.com$'],
        allowExternal: false,
        extractDepth: 'advanced',
      },
      {} as any,
    );

    expect(mockCrawl).toHaveBeenCalledWith('https://docs.example.com', {
      maxDepth: 3,
      maxBreadth: 10,
      limit: 50,
      instructions: 'Only crawl documentation pages',
      selectPaths: ['/docs/.*'],
      selectDomains: ['^docs\\.example\\.com$'],
      excludePaths: undefined,
      excludeDomains: undefined,
      allowExternal: false,
      extractDepth: 'advanced',
      includeImages: undefined,
      format: undefined,
    });

    expect(result).toEqual({
      baseUrl: 'https://docs.example.com',
      results: [
        {
          url: 'https://docs.example.com/getting-started',
          rawContent: '# Getting Started\nWelcome to the docs.',
          images: undefined,
        },
        {
          url: 'https://docs.example.com/api',
          rawContent: '# API Reference\nEndpoints documented here.',
          images: ['https://docs.example.com/diagram.png'],
        },
      ],
      responseTime: 5.3,
    });
  });

  it('should let errors propagate', async () => {
    mockCrawl.mockRejectedValue(new Error('Crawl timeout'));

    const tool = createTavilyCrawlTool({ apiKey: 'test-key' });
    await expect(tool.execute!({ url: 'https://huge-site.com' }, {} as any)).rejects.toThrow('Crawl timeout');
  });
});
