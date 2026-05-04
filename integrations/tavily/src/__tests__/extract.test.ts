import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExtract = vi.fn();

vi.mock('@tavily/core', () => ({
  tavily: vi.fn(() => ({
    search: vi.fn(),
    extract: mockExtract,
    crawl: vi.fn(),
    map: vi.fn(),
  })),
}));

import { createTavilyExtractTool } from '../extract.js';

describe('createTavilyExtractTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExtract.mockResolvedValue({
      results: [
        {
          url: 'https://example.com',
          rawContent: '# Example Page\nSome content',
          images: ['https://example.com/img.png'],
        },
      ],
      failedResults: [
        {
          url: 'https://unreachable.com',
          error: 'Connection timeout',
        },
      ],
      responseTime: 2.1,
    });
  });

  it('should create a tool with correct id', () => {
    const tool = createTavilyExtractTool({ apiKey: 'test-key' });
    expect(tool.id).toBe('tavily-extract');
    expect(tool.description).toBeDefined();
  });

  it('should have inputSchema and outputSchema', () => {
    const tool = createTavilyExtractTool({ apiKey: 'test-key' });
    expect(tool.inputSchema).toBeDefined();
    expect(tool.outputSchema).toBeDefined();
  });

  it('should call client.extract with mapped parameters', async () => {
    const tool = createTavilyExtractTool({ apiKey: 'test-key' });

    const result = await tool.execute!(
      {
        urls: ['https://example.com', 'https://unreachable.com'],
        extractDepth: 'advanced',
        query: 'pricing information',
        includeImages: true,
        format: 'markdown',
      },
      {} as any,
    );

    expect(mockExtract).toHaveBeenCalledWith(['https://example.com', 'https://unreachable.com'], {
      extractDepth: 'advanced',
      query: 'pricing information',
      includeImages: true,
      format: 'markdown',
    });

    expect(result).toEqual({
      results: [
        {
          url: 'https://example.com',
          rawContent: '# Example Page\nSome content',
          images: ['https://example.com/img.png'],
        },
      ],
      failedResults: [
        {
          url: 'https://unreachable.com',
          error: 'Connection timeout',
        },
      ],
      responseTime: 2.1,
    });
  });

  it('should handle empty results and failedResults', async () => {
    mockExtract.mockResolvedValue({
      results: [],
      failedResults: [],
      responseTime: 0.5,
    });

    const tool = createTavilyExtractTool({ apiKey: 'test-key' });
    const result = (await tool.execute!({ urls: ['https://example.com'] }, {} as any)) as any;

    expect(result.results).toEqual([]);
    expect(result.failedResults).toEqual([]);
  });

  it('should let errors propagate', async () => {
    mockExtract.mockRejectedValue(new Error('Invalid URL'));

    const tool = createTavilyExtractTool({ apiKey: 'test-key' });
    await expect(tool.execute!({ urls: ['not-a-url'] }, {} as any)).rejects.toThrow('Invalid URL');
  });
});
