import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSearch = vi.fn();

vi.mock('exa-js', () => {
  class FakeExa {
    headers = { set: vi.fn() };
    search = mockSearch;
    findSimilar = vi.fn();
    getContents = vi.fn();
    answer = vi.fn();
  }
  return { default: FakeExa };
});

import { createExaSearchTool } from '../search.js';

describe('createExaSearchTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearch.mockResolvedValue({
      requestId: 'req-123',
      resolvedSearchType: 'neural',
      results: [
        {
          id: 'doc-1',
          url: 'https://example.com',
          title: 'Result 1',
          score: 0.95,
          publishedDate: '2025-01-01',
          author: 'Jane Doe',
          favicon: 'https://example.com/favicon.ico',
          text: 'Full page text',
          highlights: ['highlight one', 'highlight two'],
          summary: 'A summary',
        },
      ],
      costDollars: { total: 0.01 },
    });
  });

  it('creates a tool with the correct id and description', () => {
    const tool = createExaSearchTool({ apiKey: 'test-key' });
    expect(tool.id).toBe('exa-search');
    expect(tool.description).toBeDefined();
    expect(tool.description!.length).toBeGreaterThan(0);
  });

  it('exposes input and output schemas', () => {
    const tool = createExaSearchTool({ apiKey: 'test-key' });
    expect(tool.inputSchema).toBeDefined();
    expect(tool.outputSchema).toBeDefined();
  });

  it('passes mapped parameters and packs content options under contents', async () => {
    const tool = createExaSearchTool({ apiKey: 'test-key' });

    await tool.execute!(
      {
        query: 'quantum computing',
        type: 'neural',
        numResults: 5,
        includeDomains: ['arxiv.org'],
        category: 'research paper',
        text: { maxCharacters: 1000 },
        highlights: true,
        summary: { query: 'key findings' },
        livecrawl: 'fallback',
      },
      {} as any,
    );

    expect(mockSearch).toHaveBeenCalledTimes(1);
    const [query, options] = mockSearch.mock.calls[0]!;
    expect(query).toBe('quantum computing');
    expect(options.type).toBe('neural');
    expect(options.numResults).toBe(5);
    expect(options.includeDomains).toEqual(['arxiv.org']);
    expect(options.category).toBe('research paper');
    expect(options.contents).toEqual({
      text: { maxCharacters: 1000 },
      highlights: true,
      summary: { query: 'key findings' },
      livecrawl: 'fallback',
    });
  });

  it('omits contents entirely when no content options are provided', async () => {
    const tool = createExaSearchTool({ apiKey: 'test-key' });
    await tool.execute!({ query: 'plain search' }, {} as any);

    const [, options] = mockSearch.mock.calls[0]!;
    expect(options.contents).toBeUndefined();
  });

  it('maps response fields and falls back to undefined for missing optional fields', async () => {
    mockSearch.mockResolvedValue({
      requestId: 'req-1',
      results: [{ id: 'a', url: 'https://a.com', title: null }],
      costDollars: { total: 0 },
    });

    const tool = createExaSearchTool({ apiKey: 'test-key' });
    const result = (await tool.execute!({ query: 'q' }, {} as any)) as any;

    expect(result.results[0]).toEqual({
      id: 'a',
      url: 'https://a.com',
      title: null,
      score: undefined,
      publishedDate: undefined,
      author: undefined,
      image: undefined,
      favicon: undefined,
      text: undefined,
      highlights: undefined,
      summary: undefined,
    });
  });

  it('handles cascading content fallbacks (only highlights present)', async () => {
    mockSearch.mockResolvedValue({
      requestId: 'req-2',
      results: [
        {
          id: 'b',
          url: 'https://b.com',
          title: 'B',
          highlights: ['only highlights, no text or summary'],
        },
      ],
    });

    const tool = createExaSearchTool({ apiKey: 'test-key' });
    const result = (await tool.execute!({ query: 'q', highlights: true }, {} as any)) as any;

    expect(result.results[0].highlights).toEqual(['only highlights, no text or summary']);
    expect(result.results[0].text).toBeUndefined();
    expect(result.results[0].summary).toBeUndefined();
  });

  it('returns an empty results array when none come back', async () => {
    mockSearch.mockResolvedValue({ requestId: 'req-3', results: undefined });

    const tool = createExaSearchTool({ apiKey: 'test-key' });
    const result = (await tool.execute!({ query: 'q' }, {} as any)) as any;

    expect(result.results).toEqual([]);
  });

  it('lets errors propagate', async () => {
    mockSearch.mockRejectedValue(new Error('API rate limit exceeded'));

    const tool = createExaSearchTool({ apiKey: 'test-key' });
    await expect(tool.execute!({ query: 'q' }, {} as any)).rejects.toThrow('API rate limit exceeded');
  });
});
