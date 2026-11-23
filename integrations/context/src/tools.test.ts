import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import ContextDev from 'context.dev';
import type { WebScrapeResponse, WebSearchResponse } from 'context.dev/resources/web';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createContextScrapeTool, createContextSearchTool, createContextTools, getContextClient } from './index.js';

interface APIRequest {
  path: string | undefined;
  method: string | undefined;
  authorization: string | undefined;
  body: unknown;
}

const requests: APIRequest[] = [];
let reply: { status: number; body: unknown };
let baseURL: string;
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  requests.push({
    path: request.url,
    method: request.method,
    authorization: request.headers.authorization,
    body: JSON.parse(Buffer.concat(chunks).toString()),
  });
  response.writeHead(reply.status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(reply.body));
});

const searchResponse: WebSearchResponse = {
  query: 'Mastra documentation',
  request_id: 'search-1',
  cache_metadata: { status: 'miss', age_ms: 0 },
  results: [
    {
      title: 'Mastra docs',
      url: 'https://mastra.ai/docs',
      description: 'Build agents with Mastra.',
      relevance: 'high',
      markdown: { code: 'NOT_REQUESTED', markdown: null },
      highlights: { code: 'NOT_REQUESTED', highlights: null },
    },
  ],
};

const scrapeResponse = {
  url: 'https://mastra.ai/docs',
  request_id: 'scrape-1',
  cache_metadata: { status: 'hit', age_ms: 1_000 },
  markdown: { requested: true, success: true, data: '# Mastra\nBuild agents.' },
} satisfies Pick<WebScrapeResponse, 'url' | 'request_id' | 'cache_metadata' | 'markdown'>;

beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
});
beforeEach(() => {
  requests.length = 0;
  reply = { status: 200, body: searchResponse };
  vi.stubEnv('CONTEXT_DEV_API_KEY', 'environment-key');
  vi.stubEnv('CONTEXT_DEV_BASE_URL', baseURL);
});
afterEach(() => vi.unstubAllEnvs());

describe('Context.dev native tools over HTTP', () => {
  it.each(['environment', 'explicit'] as const)(
    'searches with %s credentials and returns typed source results',
    async credentials => {
      const tools = createContextTools(credentials === 'explicit' ? { apiKey: 'explicit-key', baseURL } : undefined);
      const result = await tools.contextSearch.execute!(
        {
          query: 'Mastra documentation',
          numResults: 3,
          includeDomains: ['mastra.ai'],
          excludeDomains: ['example.com'],
          freshness: 'last_week',
        },
        {},
      );
      expect(requests).toEqual([
        {
          path: '/v1/web/search',
          method: 'POST',
          authorization: `Bearer ${credentials === 'explicit' ? 'explicit-key' : 'environment-key'}`,
          body: {
            query: 'Mastra documentation',
            numResults: 3,
            includeDomains: ['mastra.ai'],
            excludeDomains: ['example.com'],
            freshness: 'last_week',
          },
        },
      ]);
      expect(result).toEqual({
        query: 'Mastra documentation',
        requestId: 'search-1',
        cacheMetadata: { status: 'miss', ageMs: 0 },
        results: [
          {
            title: 'Mastra docs',
            url: 'https://mastra.ai/docs',
            description: 'Build agents with Mastra.',
            relevance: 'high',
          },
        ],
      });
    },
  );

  it('preserves empty and partial search responses without fabricating sources', async () => {
    reply.body = { ...searchResponse, results: [], partial: true } satisfies WebSearchResponse;
    const tool = createContextSearchTool();
    expect(await tool.execute!({ query: 'no matches' }, {})).toEqual({
      query: 'Mastra documentation',
      requestId: 'search-1',
      cacheMetadata: { status: 'miss', ageMs: 0 },
      results: [],
      partial: true,
    });
  });

  it.each([
    { input: { url: 'https://mastra.ai/docs' }, shared: true, cache: undefined },
    { input: { url: 'https://mastra.ai/docs', mainContentOnly: false, maxAgeMs: 0 }, shared: false, cache: 0 },
    { input: { url: 'https://mastra.ai/docs', maxAgeMs: 60_000 }, shared: true, cache: 60_000 },
  ])('scrapes Markdown with cache and content controls: $input', async ({ input, shared, cache }) => {
    reply.body = scrapeResponse;
    const { contextScrape } = createContextTools();
    const result = await contextScrape.execute!(input, {});
    expect(result).toEqual({
      url: 'https://mastra.ai/docs',
      markdown: '# Mastra\nBuild agents.',
      requestId: 'scrape-1',
      cacheMetadata: { status: 'hit', ageMs: 1_000 },
    });
    expect(requests[0]).toEqual({
      path: '/v1/web/scrape',
      method: 'POST',
      authorization: 'Bearer environment-key',
      body: {
        url: input.url,
        formats: { markdown: true },
        sharedParams: { mainContentOnly: shared },
        ...(cache === undefined ? {} : { maxAgeMs: cache }),
      },
    });
  });

  it.each([
    {
      requested: true,
      success: false,
      data: 'Do not treat failed output as content',
      error_code: 'WEBSITE_BLOCKED',
      message: 'private remote detail',
    },
    { requested: false, success: null, data: null },
    { requested: true, success: true, data: null },
    { requested: true, success: true, data: '' },
    { requested: true, success: true, data: '   ' },
  ] satisfies WebScrapeResponse.Markdown[])(
    'rejects failed or empty Markdown even when HTTP succeeds: %j',
    async markdown => {
      reply.body = { ...scrapeResponse, markdown };
      await expect(createContextScrapeTool().execute!({ url: 'https://mastra.ai/docs' }, {})).rejects.toThrow(
        'Context.dev did not return Markdown for this page.',
      );
      expect(requests).toHaveLength(1);
    },
  );

  it.each(['search', 'scrape'] as const)(
    'propagates HTTP authentication failures for %s instead of returning success',
    async operation => {
      reply = { status: 401, body: { error_code: 'DISABLED', message: 'Invalid API key' } };
      const tools = createContextTools({ maxRetries: 0 });
      const run =
        operation === 'search'
          ? tools.contextSearch.execute!({ query: 'example' }, {})
          : tools.contextScrape.execute!({ url: 'https://example.com' }, {});
      await expect(run).rejects.toBeInstanceOf(ContextDev.AuthenticationError);
      expect(requests).toHaveLength(1);
    },
  );

  it('allows tool registration without credentials but fails clearly on first use', async () => {
    vi.stubEnv('CONTEXT_DEV_API_KEY', '');
    const tools = createContextTools();
    await expect(tools.contextSearch.execute!({ query: 'example' }, {})).rejects.toThrow('CONTEXT_DEV_API_KEY');
    await expect(tools.contextScrape.execute!({ url: 'https://example.com' }, {})).rejects.toThrow(
      'CONTEXT_DEV_API_KEY',
    );
    expect(requests).toEqual([]);
    expect(() => getContextClient()).toThrow('Context.dev API key is required.');
  });

  it.each(['search', 'scrape'] as const)('forwards cancellation to the real SDK for %s', async operation => {
    const controller = new AbortController();
    controller.abort();
    const tools = createContextTools({ maxRetries: 0 });
    const run =
      operation === 'search'
        ? tools.contextSearch.execute!({ query: 'example' }, { abortSignal: controller.signal })
        : tools.contextScrape.execute!({ url: 'https://example.com' }, { abortSignal: controller.signal });
    await expect(run).rejects.toBeInstanceOf(ContextDev.APIUserAbortError);
    expect(requests).toEqual([]);
  });

  it.each([
    { query: '', numResults: 10 },
    { query: 'example', numResults: 0 },
    { query: 'example', numResults: 101 },
    { query: 'example', numResults: 1.5 },
    { query: 'example', includeDomains: Array.from({ length: 101 }, () => 'example.com') },
    { query: 'example', excludeDomains: Array.from({ length: 101 }, () => 'example.com') },
  ])('rejects invalid search input before making a paid request: %j', async input => {
    expect(await createContextSearchTool().execute!(input, {})).toMatchObject({ error: true });
    expect(requests).toEqual([]);
  });

  it.each([
    { url: 'not-a-url' },
    { url: 'file:///etc/passwd' },
    { url: 'https://example.com', maxAgeMs: -1 },
    { url: 'https://example.com', maxAgeMs: 31_536_000_001 },
    { url: 'https://example.com', maxAgeMs: 0.5 },
  ])('rejects invalid scrape input before making a paid request: %j', async input => {
    expect(await createContextScrapeTool().execute!(input, {})).toMatchObject({ error: true });
    expect(requests).toEqual([]);
  });
});
