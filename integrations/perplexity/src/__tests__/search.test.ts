import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createPerplexitySearchTool } from '../search.js';
import { createPerplexityTools } from '../tools.js';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

beforeEach(() => {
  delete process.env.PERPLEXITY_API_KEY;
  delete process.env.PPLX_API_KEY;
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('createPerplexitySearchTool', () => {
  it('exposes the expected tool id, description, and schemas', () => {
    const tool = createPerplexitySearchTool({ apiKey: 'k' });

    expect(tool.id).toBe('perplexity-search');
    expect(tool.description).toContain('Perplexity Search API');
    expect(tool.description).not.toMatch(/sonar/i);
    expect(tool.inputSchema).toBeDefined();
    expect(tool.outputSchema).toBeDefined();
  });

  it('passes input through to the API in snake_case form', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        id: 'r-1',
        results: [
          { title: 'A', url: 'https://a.test', snippet: 'snip', date: '2026-01-01' },
        ],
      }),
    );

    const tool = createPerplexitySearchTool({ apiKey: 'k', fetch: fetchMock });

    const out = await tool.execute!(
      {
        query: 'agent frameworks',
        maxResults: 5,
        searchDomainFilter: ['mastra.ai'],
        searchRecencyFilter: 'month',
        searchAfterDateFilter: '1/1/2025',
      },
      {} as any,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      query: 'agent frameworks',
      max_results: 5,
      search_domain_filter: ['mastra.ai'],
      search_recency_filter: 'month',
      search_after_date_filter: '1/1/2025',
    });

    expect(out).toEqual({
      query: 'agent frameworks',
      results: [{ title: 'A', url: 'https://a.test', snippet: 'snip', date: '2026-01-01' }],
    });
  });

  it('omits unset filter fields from the request body', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ results: [] }));
    const tool = createPerplexitySearchTool({ apiKey: 'k', fetch: fetchMock });

    await tool.execute!({ query: 'q' }, {} as any);

    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body).toEqual({ query: 'q' });
  });

  it('returns an empty results array when the API returns none', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ results: [] }));
    const tool = createPerplexitySearchTool({ apiKey: 'k', fetch: fetchMock });

    const out = (await tool.execute!({ query: 'q' }, {} as any)) as { results: unknown[] };
    expect(out.results).toEqual([]);
  });

  it('lets API errors propagate to the caller', async () => {
    const fetchMock = vi.fn(async () => new Response('forbidden', { status: 403 }));
    const tool = createPerplexitySearchTool({ apiKey: 'k', fetch: fetchMock });

    await expect(tool.execute!({ query: 'q' }, {} as any)).rejects.toThrow(/403/);
  });

  it('truncates long error response bodies to 1000 chars', async () => {
    const huge = 'x'.repeat(5000);
    const fetchMock = vi.fn(async () => new Response(huge, { status: 500 }));
    const tool = createPerplexitySearchTool({ apiKey: 'k', fetch: fetchMock });

    await expect(tool.execute!({ query: 'q' }, {} as any)).rejects.toThrow(
      new RegExp(`status 500: x{1000}…$`),
    );
  });

  it('rejects searchDomainFilter that mixes allow and deny entries', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ results: [] }));
    const tool = createPerplexitySearchTool({ apiKey: 'k', fetch: fetchMock });

    const parsed = tool.inputSchema!.safeParse({
      query: 'q',
      searchDomainFilter: ['mastra.ai', '-pinterest.com'],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]!.message).toMatch(/cannot mix allow and deny/i);
    }
  });

  it('accepts searchDomainFilter with only allow entries', () => {
    const tool = createPerplexitySearchTool({ apiKey: 'k' });
    const parsed = tool.inputSchema!.safeParse({
      query: 'q',
      searchDomainFilter: ['mastra.ai', 'docs.mastra.ai'],
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts searchDomainFilter with only deny entries', () => {
    const tool = createPerplexitySearchTool({ apiKey: 'k' });
    const parsed = tool.inputSchema!.safeParse({
      query: 'q',
      searchDomainFilter: ['-pinterest.com', '-quora.com'],
    });
    expect(parsed.success).toBe(true);
  });
});

describe('createPerplexityTools', () => {
  it('returns the search tool under the perplexitySearch key', () => {
    const tools = createPerplexityTools({ apiKey: 'k' });
    expect(Object.keys(tools)).toEqual(['perplexitySearch']);
    expect(tools.perplexitySearch.id).toBe('perplexity-search');
  });
});
