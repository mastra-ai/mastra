import { afterEach, describe, expect, it, vi } from 'vitest';

import { webFetchTool as exportedWebFetchTool } from '../index';
import { webFetchTool } from './web-fetch';

const originalFetch = globalThis.fetch;

function mockFetch(response: Response) {
  const fetchMock = vi.fn(async () => response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('webFetchTool', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = originalFetch;
  });

  it('fetches a URL and returns response metadata', async () => {
    const fetchMock = mockFetch(
      new Response('Hello world', {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
      }),
    );

    const result = await (webFetchTool as any).execute({ url: 'https://example.com/page' }, {});

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/page',
      expect.objectContaining({
        headers: expect.objectContaining({
          'user-agent': 'Mastra Web Fetch Tool/1.0',
        }),
      }),
    );
    expect(result).toEqual({
      content: 'Hello world',
      truncated: false,
      status: 200,
      statusText: 'OK',
      contentType: 'text/plain',
      url: '',
      ok: true,
    });
  });

  it('truncates long response bodies', async () => {
    mockFetch(new Response('a'.repeat(100_001), { status: 200 }));

    const result = await (webFetchTool as any).execute({ url: 'https://example.com/large' }, {});

    expect(result.content).toHaveLength(100_000);
    expect(result.truncated).toBe(true);
  });

  it('returns non-2xx responses without marking them as tool errors', async () => {
    mockFetch(new Response('Not found', { status: 404, statusText: 'Not Found' }));

    const result = await (webFetchTool as any).execute({ url: 'https://example.com/missing' }, {});

    expect(result).toMatchObject({
      content: 'Not found',
      status: 404,
      statusText: 'Not Found',
      ok: false,
    });
    expect(result.isError).toBeUndefined();
  });

  it('rejects non-HTTP URLs', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await (webFetchTool as any).execute({ url: 'file:///etc/passwd' }, {});

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      content: 'Failed to fetch URL: only HTTP and HTTPS URLs are supported.',
      isError: true,
    });
  });

  it('returns fetch errors as tool errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );

    const result = await (webFetchTool as any).execute({ url: 'https://example.com' }, {});

    expect(result).toEqual({
      content: 'Failed to fetch URL: network down',
      isError: true,
    });
  });

  it('is exported from the tools index', () => {
    expect(exportedWebFetchTool).toBe(webFetchTool);
  });
});
