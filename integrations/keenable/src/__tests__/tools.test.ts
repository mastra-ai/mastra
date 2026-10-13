import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createKeenableFetchTool } from '../fetch.js';
import { createKeenableSearchTool } from '../search.js';
import { createKeenableTools } from '../tools.js';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

beforeEach(() => {
  delete process.env.KEENABLE_API_KEY;
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Shaped like a real response: `description` is empty and `snippet` holds the
// page text with its line breaks.
const SEARCH_RESPONSE = {
  query: 'agent frameworks',
  mode: 'pro',
  results: [
    {
      title: 'Mastra',
      url: 'https://mastra.ai',
      description: '',
      snippet: 'Mastra is a TypeScript\nagent framework.\n\n  It ships tools.',
      published_at: '2026-10-08T19:34:41Z',
      acquired_at: '2026-10-09T00:00:00Z',
    },
    {
      title: 'Docs',
      url: 'https://mastra.ai/docs',
      description: 'Mastra documentation',
      snippet: '',
    },
    { title: 'No URL', url: '', description: '', snippet: 'dropped' },
  ],
};

describe('createKeenableSearchTool', () => {
  it('exposes the expected tool id, description, and schemas', () => {
    const tool = createKeenableSearchTool();

    expect(tool.id).toBe('keenable-search');
    expect(tool.description).toContain('Keenable Search API');
    expect(tool.inputSchema).toBeDefined();
    expect(tool.outputSchema).toBeDefined();
  });

  it('maps input to the API in snake_case form and normalizes results', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(SEARCH_RESPONSE));
    const tool = createKeenableSearchTool({ fetch: fetchMock });

    const out = await tool.execute!(
      {
        query: 'agent frameworks',
        maxResults: 5,
        site: 'mastra.ai',
        publishedAfter: '2026-01-01',
        publishedBefore: '2026-12-31',
      },
      {} as any,
    );

    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      query: 'agent frameworks',
      max_results: 5,
      site: 'mastra.ai',
      published_after: '2026-01-01',
      published_before: '2026-12-31',
      snippet_max_length: 500,
    });
    expect(out).toEqual({
      query: 'agent frameworks',
      results: [
        {
          title: 'Mastra',
          url: 'https://mastra.ai',
          snippet: 'Mastra is a TypeScript agent framework. It ships tools.',
          publishedAt: '2026-10-08T19:34:41Z',
        },
        {
          title: 'Docs',
          url: 'https://mastra.ai/docs',
          snippet: 'Mastra documentation',
          publishedAt: undefined,
        },
      ],
    });
  });

  it('omits unset filters from the request body', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ results: [] }));
    const tool = createKeenableSearchTool({ fetch: fetchMock });

    await tool.execute!({ query: 'q' }, {} as any);

    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ query: 'q', snippet_max_length: 500 });
  });
});

describe('createKeenableFetchTool', () => {
  it('exposes the expected tool id', () => {
    const tool = createKeenableFetchTool();

    expect(tool.id).toBe('keenable-fetch');
    expect(tool.description).toContain('Keenable Fetch API');
  });

  it('returns the page content and converts a Unix timestamp to ISO', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        url: 'https://mastra.ai/docs',
        title: 'Docs | Mastra',
        content: '# Docs',
        description: '',
        published_at: 1789398666,
      }),
    );
    const tool = createKeenableFetchTool({ fetch: fetchMock });

    const out = await tool.execute!({ url: 'https://mastra.ai/docs', maxChars: 300 }, {} as any);

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.keenable.ai/v1/fetch/public?url=https%3A%2F%2Fmastra.ai%2Fdocs&max_chars=300');
    expect(out).toEqual({
      url: 'https://mastra.ai/docs',
      title: 'Docs | Mastra',
      content: '# Docs',
      publishedAt: '2026-09-14T15:11:06.000Z',
    });
  });

  it('falls back to the requested URL and empty content', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}));
    const tool = createKeenableFetchTool({ fetch: fetchMock });

    const out = await tool.execute!({ url: 'https://a.test' }, {} as any);

    expect(out).toEqual({ url: 'https://a.test', title: undefined, content: '', publishedAt: undefined });
  });
});

describe('createKeenableTools', () => {
  it('returns both tools sharing the configuration', () => {
    const tools = createKeenableTools({ apiKey: 'k' });

    expect(Object.keys(tools)).toEqual(['keenableSearch', 'keenableFetch']);
    expect(tools.keenableSearch.id).toBe('keenable-search');
    expect(tools.keenableFetch.id).toBe('keenable-fetch');
  });
});
