import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSearch, mockExtract, mockParallel } = vi.hoisted(() => {
  const mockSearch = vi.fn();
  const mockExtract = vi.fn();
  return {
    mockSearch,
    mockExtract,
    mockParallel: vi.fn(function ParallelClient() {
      return { search: mockSearch, extract: mockExtract };
    }),
  };
});

vi.mock('parallel-web', () => ({ default: mockParallel }));

import { createParallelSearchTool } from './search.js';

describe('createParallelSearchTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearch.mockResolvedValue({
      search_id: 'search_test',
      session_id: 'session_test',
      results: [
        {
          url: 'https://mastra.ai/docs',
          title: 'Mastra documentation',
          publish_date: '2026-08-21',
          excerpts: ['Mastra is a TypeScript framework for building AI applications.'],
        },
      ],
      usage: [{ name: 'sku_search', count: 1 }],
      warnings: [
        {
          type: 'warning',
          message: 'A test warning',
          detail: { source: 'fixture' },
        },
      ],
    });
  });

  it('creates a Mastra tool without constructing the client', () => {
    const tool = createParallelSearchTool({ apiKey: 'parallel-test' });

    expect(tool.id).toBe('parallel-search');
    expect(tool.description).toContain('Parallel');
    expect(tool.inputSchema).toBeDefined();
    expect(tool.outputSchema).toBeDefined();
    expect(mockParallel).not.toHaveBeenCalled();
  });

  it('maps the complete camel-case input to the official SDK request', async () => {
    const tool = createParallelSearchTool({ apiKey: 'parallel-test' });

    const result = await tool.execute!(
      {
        searchQueries: ['Mastra agent framework', 'Mastra tools docs'],
        objective: 'Find current Mastra agent and tool documentation.',
        mode: 'advanced',
        clientModel: 'anthropic/claude-sonnet-4-6',
        maxResults: 5,
        excerptMaxCharsPerResult: 2000,
        maxCharsTotal: 8000,
        location: 'US',
        includeDomains: ['mastra.ai'],
        excludeDomains: ['example.com'],
        afterDate: '2026-01-01',
        fetchPolicy: { maxAgeSeconds: 600, timeoutSeconds: 10, disableCacheFallback: true },
        sessionId: 'session_input',
      },
      {} as any,
    );

    expect(mockSearch).toHaveBeenCalledWith({
      search_queries: ['Mastra agent framework', 'Mastra tools docs'],
      objective: 'Find current Mastra agent and tool documentation.',
      mode: 'advanced',
      client_model: 'anthropic/claude-sonnet-4-6',
      max_chars_total: 8000,
      session_id: 'session_input',
      advanced_settings: {
        max_results: 5,
        excerpt_settings: { max_chars_per_result: 2000 },
        location: 'US',
        source_policy: {
          include_domains: ['mastra.ai'],
          exclude_domains: ['example.com'],
          after_date: '2026-01-01',
        },
        fetch_policy: {
          max_age_seconds: 600,
          timeout_seconds: 10,
          disable_cache_fallback: true,
        },
      },
    });
    expect(result).toEqual({
      searchId: 'search_test',
      sessionId: 'session_test',
      results: [
        {
          url: 'https://mastra.ai/docs',
          title: 'Mastra documentation',
          publishDate: '2026-08-21',
          excerpts: ['Mastra is a TypeScript framework for building AI applications.'],
        },
      ],
      usage: [{ name: 'sku_search', count: 1 }],
      warnings: [{ type: 'warning', message: 'A test warning', detail: { source: 'fixture' } }],
    });
  });

  it('sends only the required field for minimal input and reuses the client', async () => {
    const tool = createParallelSearchTool({ apiKey: 'parallel-test' });

    await tool.execute!({ searchQueries: ['Mastra docs'] }, {} as any);
    await tool.execute!({ searchQueries: ['Mastra agents'] }, {} as any);

    expect(mockSearch).toHaveBeenNthCalledWith(1, { search_queries: ['Mastra docs'] });
    expect(mockSearch).toHaveBeenNthCalledWith(2, { search_queries: ['Mastra agents'] });
    expect(mockParallel).toHaveBeenCalledTimes(1);
  });

  it('normalizes nullable optional response fields', async () => {
    mockSearch.mockResolvedValue({
      search_id: 'search_empty',
      session_id: 'session_empty',
      results: [{ url: 'https://example.com', title: null, publish_date: null, excerpts: [] }],
      usage: null,
      warnings: null,
    });
    const tool = createParallelSearchTool({ apiKey: 'parallel-test' });

    await expect(tool.execute!({ searchQueries: ['example'] }, {} as any)).resolves.toEqual({
      searchId: 'search_empty',
      sessionId: 'session_empty',
      results: [{ url: 'https://example.com', title: undefined, publishDate: undefined, excerpts: [] }],
      usage: undefined,
      warnings: undefined,
    });
  });

  it('rejects an empty query list before execution', () => {
    const tool = createParallelSearchTool({ apiKey: 'parallel-test' });

    expect(() => tool.inputSchema!.parse({ searchQueries: [] })).toThrow();
  });

  it('rejects an upstream-invalid combined domain policy', () => {
    const tool = createParallelSearchTool({ apiKey: 'parallel-test' });

    expect(() =>
      tool.inputSchema!.parse({
        searchQueries: ['example'],
        includeDomains: Array.from({ length: 101 }, (_, index) => `include-${index}.com`),
        excludeDomains: Array.from({ length: 100 }, (_, index) => `exclude-${index}.com`),
      }),
    ).toThrow('at most 200 domains combined');
  });

  it('accepts future warning types in the output schema', async () => {
    mockSearch.mockResolvedValue({
      search_id: 'search_future_warning',
      session_id: 'session_future_warning',
      results: [],
      warnings: [{ type: 'future_warning', message: 'A future warning type' }],
    });
    const tool = createParallelSearchTool({ apiKey: 'parallel-test' });

    const result = await tool.execute!({ searchQueries: ['example'] }, {} as any);

    expect(() => tool.outputSchema!.parse(result)).not.toThrow();
  });

  it('validates country codes against ISO 3166-1 alpha-2', () => {
    const tool = createParallelSearchTool({ apiKey: 'parallel-test' });

    expect(tool.inputSchema!.parse({ searchQueries: ['example'], location: 'us' })).toMatchObject({
      location: 'us',
    });
    expect(() => tool.inputSchema!.parse({ searchQueries: ['example'], location: '!!' })).toThrow(
      'valid ISO 3166-1 alpha-2 country code',
    );
    expect(() => tool.inputSchema!.parse({ searchQueries: ['example'], location: 'ZZ' })).toThrow(
      'valid ISO 3166-1 alpha-2 country code',
    );
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('validates afterDate as a real calendar date', () => {
    const tool = createParallelSearchTool({ apiKey: 'parallel-test' });

    expect(tool.inputSchema!.parse({ searchQueries: ['example'], afterDate: '2024-02-29' })).toMatchObject({
      afterDate: '2024-02-29',
    });
    expect(() => tool.inputSchema!.parse({ searchQueries: ['example'], afterDate: '2026-02-30' })).toThrow(
      'valid calendar date',
    );
    expect(() => tool.inputSchema!.parse({ searchQueries: ['example'], afterDate: '2025-02-29' })).toThrow(
      'valid calendar date',
    );
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('propagates SDK errors', async () => {
    mockSearch.mockRejectedValue(new Error('Parallel rate limit exceeded'));
    const tool = createParallelSearchTool({ apiKey: 'parallel-test' });

    await expect(tool.execute!({ searchQueries: ['Mastra docs'] }, {} as any)).rejects.toThrow(
      'Parallel rate limit exceeded',
    );
  });
});
