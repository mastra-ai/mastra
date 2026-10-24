import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSearch, mockCeramic } = vi.hoisted(() => {
  const mockSearch = vi.fn();
  return {
    mockSearch,
    mockCeramic: vi.fn(function CeramicClient() {
      return { search: mockSearch };
    }),
  };
});

vi.mock('ceramic-ai', () => ({ default: mockCeramic }));

import { createCeramicSearchTool } from './search.js';

describe('createCeramicSearchTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearch.mockResolvedValue({
      requestId: 'ae2ebd93-194f-4460-9996-15e3f86b05d8',
      result: {
        results: [
          {
            title: 'California Tenant Rights Guide',
            url: 'https://example.com/tenant-rights',
            description: 'Comprehensive guide to California rental laws...',
          },
        ],
        searchMetadata: { executionTime: 0.097 },
        totalResults: 1,
      },
    });
  });

  it('creates a Mastra tool without constructing the client', () => {
    const tool = createCeramicSearchTool({ apiKey: 'ceramic-test' });

    expect(tool.id).toBe('ceramic-search');
    expect(tool.description).toContain('Ceramic');
    expect(tool.inputSchema).toBeDefined();
    expect(tool.outputSchema).toBeDefined();
    expect(mockCeramic).not.toHaveBeenCalled();
  });

  it('maps the complete input to the official SDK request', async () => {
    const tool = createCeramicSearchTool({ apiKey: 'ceramic-test' });

    await tool.execute!(
      { query: 'California rental laws', maxResults: 5, maxDescriptionLength: 1500 },
      {} as any,
    );

    expect(mockSearch).toHaveBeenCalledWith({
      query: 'California rental laws',
      maxResults: 5,
      maxDescriptionLength: 1500,
    });
  });

  it('omits unset optional fields because the API rejects unknown properties', async () => {
    const tool = createCeramicSearchTool({ apiKey: 'ceramic-test' });

    await tool.execute!({ query: 'California rental laws' }, {} as any);

    expect(mockSearch).toHaveBeenCalledWith({ query: 'California rental laws' });
  });

  it('flattens the SDK response into the tool output', async () => {
    const tool = createCeramicSearchTool({ apiKey: 'ceramic-test' });

    const result = await tool.execute!({ query: 'California rental laws' }, {} as any);

    expect(result).toEqual({
      requestId: 'ae2ebd93-194f-4460-9996-15e3f86b05d8',
      results: [
        {
          title: 'California Tenant Rights Guide',
          url: 'https://example.com/tenant-rights',
          description: 'Comprehensive guide to California rental laws...',
        },
      ],
      totalResults: 1,
      executionTime: 0.097,
    });
    expect(() => tool.outputSchema!.parse(result)).not.toThrow();
  });

  it('accepts keyword queries with search operators and accented Latin text', () => {
    const tool = createCeramicSearchTool({ apiKey: 'ceramic-test' });
    const query = '(college OR university) "tuition costs" site:example.edu café São Paulo 2026';

    expect(tool.inputSchema!.parse({ query: `  ${query}  ` })).toEqual({ query });
  });

  it('enforces the 1-50 word query limit', () => {
    const tool = createCeramicSearchTool({ apiKey: 'ceramic-test' });

    expect(() => tool.inputSchema!.parse({ query: '   ' })).toThrow('at least one word');
    expect(() => tool.inputSchema!.parse({ query: Array(50).fill('word').join(' ') })).not.toThrow();
    expect(() => tool.inputSchema!.parse({ query: Array(51).fill('word').join(' ') })).toThrow('at most 50 words');
  });

  it('enforces the documented numeric ranges', () => {
    const tool = createCeramicSearchTool({ apiKey: 'ceramic-test' });

    expect(() => tool.inputSchema!.parse({ query: 'Mastra', maxResults: 0 })).toThrow();
    expect(() => tool.inputSchema!.parse({ query: 'Mastra', maxResults: 21 })).toThrow();
    expect(() => tool.inputSchema!.parse({ query: 'Mastra', maxResults: 2.5 })).toThrow();
    expect(() => tool.inputSchema!.parse({ query: 'Mastra', maxDescriptionLength: 999 })).toThrow();
    expect(() => tool.inputSchema!.parse({ query: 'Mastra', maxDescriptionLength: 8001 })).toThrow();
    expect(() =>
      tool.inputSchema!.parse({ query: 'Mastra', maxResults: 20, maxDescriptionLength: 8000 }),
    ).not.toThrow();
  });

  it('propagates SDK errors', async () => {
    mockSearch.mockRejectedValue(new Error('Ceramic rate limit exceeded'));
    const tool = createCeramicSearchTool({ apiKey: 'ceramic-test' });

    await expect(tool.execute!({ query: 'Mastra docs' }, {} as any)).rejects.toThrow('Ceramic rate limit exceeded');
  });
});
