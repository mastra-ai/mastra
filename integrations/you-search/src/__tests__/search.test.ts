import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createYouSearchTool } from '../search.js';
import { createYouTools } from '../tools.js';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.YDC_API_KEY;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('createYouSearchTool', () => {
  it('exposes the expected tool id, description, and schemas', () => {
    const tool = createYouSearchTool();

    expect(tool.id).toBe('you-search');
    expect(tool.description).toContain('You.com Search API');
    expect(tool.inputSchema).toBeDefined();
    expect(tool.outputSchema).toBeDefined();
  });

  it('executes without any configuration via the keyless tier', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ results: { web: [], news: [] } }));
    const tool = createYouSearchTool({ fetch: fetchMock });

    const out = (await tool.execute!({ query: 'q' }, {} as any)) as { results: unknown[] };

    expect(out.results).toEqual([]);
    expect(String(fetchMock.mock.calls[0]![0])).toContain('https://api.you.com/v1/agents/search');
  });

  it('maps camelCase input to API query parameters', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ results: { web: [], news: [] } }));
    const tool = createYouSearchTool({ apiKey: 'k', fetch: fetchMock });

    await tool.execute!(
      {
        query: 'agent frameworks',
        count: 5,
        freshness: 'month',
        country: 'US',
        includeDomains: ['mastra.ai'],
      },
      {} as any,
    );

    const parsed = new URL(String(fetchMock.mock.calls[0]![0]));
    expect(parsed.searchParams.get('query')).toBe('agent frameworks');
    expect(parsed.searchParams.get('count')).toBe('5');
    expect(parsed.searchParams.get('freshness')).toBe('month');
    expect(parsed.searchParams.get('country')).toBe('US');
    expect(parsed.searchParams.get('include_domains')).toBe('mastra.ai');
  });

  it('flattens web and news sections into a single results list with source tags', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        results: {
          web: [
            {
              title: 'Web A',
              url: 'https://a.test',
              description: 'desc a',
              snippets: ['snippet one'],
              page_age: '2026-01-01T00:00:00',
            },
          ],
          news: [
            {
              title: 'News B',
              url: 'https://b.test',
              description: 'desc b',
              page_age: '2026-02-02T00:00:00',
            },
          ],
        },
      }),
    );
    const tool = createYouSearchTool({ apiKey: 'k', fetch: fetchMock });

    const out = await tool.execute!({ query: 'q' }, {} as any);

    expect(out).toEqual({
      query: 'q',
      results: [
        {
          title: 'Web A',
          url: 'https://a.test',
          description: 'desc a',
          snippets: ['snippet one'],
          publishedDate: '2026-01-01T00:00:00',
          source: 'web',
        },
        {
          title: 'News B',
          url: 'https://b.test',
          description: 'desc b',
          publishedDate: '2026-02-02T00:00:00',
          source: 'news',
        },
      ],
    });
  });

  it('defaults missing result fields to empty strings', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ results: { web: [{ url: 'https://a.test' }], news: [] } }),
    );
    const tool = createYouSearchTool({ apiKey: 'k', fetch: fetchMock });

    const out = (await tool.execute!({ query: 'q' }, {} as any)) as {
      results: Array<{ title: string; description: string }>;
    };

    expect(out.results[0]).toMatchObject({ title: '', description: '', url: 'https://a.test' });
  });

  it('lets API errors propagate to the caller', async () => {
    const fetchMock = vi.fn(async () => new Response('forbidden', { status: 403 }));
    const tool = createYouSearchTool({ apiKey: 'k', fetch: fetchMock });

    await expect(tool.execute!({ query: 'q' }, {} as any)).rejects.toThrow(/403/);
  });

  it('rejects input combining includeDomains and excludeDomains', () => {
    const tool = createYouSearchTool();

    const parsed = tool.inputSchema!.safeParse({
      query: 'q',
      includeDomains: ['a.com'],
      excludeDomains: ['b.com'],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]!.message).toMatch(/cannot be combined/i);
    }
  });

  it('accepts includeDomains or excludeDomains on their own', () => {
    const tool = createYouSearchTool();

    expect(tool.inputSchema!.safeParse({ query: 'q', includeDomains: ['a.com'] }).success).toBe(true);
    expect(tool.inputSchema!.safeParse({ query: 'q', excludeDomains: ['b.com'] }).success).toBe(true);
  });
});

describe('createYouTools', () => {
  it('returns the search tool under the youSearch key', () => {
    const tools = createYouTools();
    expect(Object.keys(tools)).toEqual(['youSearch']);
    expect(tools.youSearch.id).toBe('you-search');
  });
});
