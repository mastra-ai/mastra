import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { createKeenableFetchTool } from '../fetch.js';

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('createKeenableFetchTool', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    delete process.env.KEENABLE_API_KEY;
    mockFetch = vi.fn().mockResolvedValue(
      jsonResponse({
        url: 'https://example.com/article',
        title: 'Article',
        content: '# Article\n\nBody',
        author: 'Jane',
        published_at: '2026-02-03',
      }),
    );
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('creates a tool with the correct id and schemas', () => {
    const tool = createKeenableFetchTool();
    expect(tool.id).toBe('keenable-fetch');
    expect(tool.description!.length).toBeGreaterThan(0);
    expect(tool.inputSchema).toBeDefined();
    expect(tool.outputSchema).toBeDefined();
  });

  it('fetches a URL and maps the page fields', async () => {
    const tool = createKeenableFetchTool();
    const page = await tool.execute!({ url: 'https://example.com/article' }, {} as any);

    expect(mockFetch.mock.calls[0][0]).toContain('/v1/fetch/public?url=');
    expect(page).toEqual({
      url: 'https://example.com/article',
      title: 'Article',
      content: '# Article\n\nBody',
      description: undefined,
      author: 'Jane',
      publishedAt: '2026-02-03',
    });
  });
});
