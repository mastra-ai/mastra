import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { createKeenableSearchTool } from '../search.js';

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('createKeenableSearchTool', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    delete process.env.KEENABLE_API_KEY;
    mockFetch = vi.fn().mockResolvedValue(
      jsonResponse({
        query: 'test query',
        results: [{ title: 'Result 1', url: 'https://example.com', description: 'Snippet' }],
      }),
    );
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('creates a tool with the correct id and schemas', () => {
    const tool = createKeenableSearchTool();
    expect(tool.id).toBe('keenable-search');
    expect(tool.description!.length).toBeGreaterThan(0);
    expect(tool.inputSchema).toBeDefined();
    expect(tool.outputSchema).toBeDefined();
  });

  it('maps filter params into the request body and returns mapped results', async () => {
    const tool = createKeenableSearchTool();
    const result = await tool.execute!(
      { query: 'test query', site: 'github.com', publishedAfter: '2026-01-01', maxResults: 5 },
      {} as any,
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toMatchObject({ query: 'test query', mode: 'pro', site: 'github.com', published_after: '2026-01-01' });
    expect(result.results[0]).toEqual({ title: 'Result 1', url: 'https://example.com', description: 'Snippet' });
  });
});
