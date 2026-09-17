import { createServer } from 'node:http';
import type { IncomingHttpHeaders, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import Parallel from 'parallel-web';
import { VERSION } from 'parallel-web/version';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ParallelClientOptions } from '../client.js';
import { createParallelExtractTool } from '../extract.js';
import { createParallelSearchTool } from '../search.js';

// Use the real SDK and HTTP server: constructor configuration alone cannot prove attribution.
describe('Parallel request headers', () => {
  let server: Server;
  let baseURL: string;
  let requests: { path: string; headers: IncomingHttpHeaders }[];
  let failures: number;

  beforeEach(async () => {
    requests = [];
    failures = 0;
    server = createServer((request, response) => {
      requests.push({ path: request.url!, headers: request.headers });
      request.resume();
      response.setHeader('Content-Type', 'application/json');
      if (failures > 0) {
        failures--;
        response.writeHead(500, { 'retry-after-ms': '1' });
        response.end(JSON.stringify({ error: 'retry this request' }));
        return;
      }
      response.end(
        JSON.stringify({
          search_id: 'search_test',
          extract_id: 'extract_test',
          results: [],
          errors: [],
        }),
      );
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  });

  it('identifies Search, repeated Search, and Extract requests while preserving SDK/auth headers', async () => {
    const config = { apiKey: 'test-key', baseURL, maxRetries: 0 };
    const search = createParallelSearchTool(config);
    const extract = createParallelExtractTool(config);

    await search.execute!({ searchQueries: ['Mastra tools'] }, {} as any);
    await search.execute!({ searchQueries: ['Mastra agents'] }, {} as any);
    await extract.execute!({ urls: ['https://mastra.ai'] }, {} as any);

    expect(requests.map(request => request.path)).toEqual(['/v1/search', '/v1/search', '/v1/extract']);
    for (const { headers } of requests) {
      expect(headers['user-agent']).toBe(`Parallel/JS ${VERSION} mastra`);
      expect(headers['x-api-key']).toBe('test-key');
      expect(headers['content-type']).toBe('application/json');
      expect(headers['x-stainless-lang']).toBe('js');
    }
  });

  const callerHeaders: ParallelClientOptions['defaultHeaders'][] = [
    { 'uSeR-aGeNt': 'caller/1.0', 'X-Caller': 'preserved', 'x-api-key': 'caller-key' },
    new Headers({ 'User-Agent': 'caller/1.0', 'X-Caller': 'preserved', 'x-api-key': 'caller-key' }),
    [
      ['User-Agent', 'caller/1.0'],
      ['X-Caller', 'preserved'],
      ['x-api-key', 'caller-key'],
    ],
  ];

  it.each(callerHeaders.map(defaultHeaders => ({ defaultHeaders })))(
    'preserves supported caller headers through retries and a custom fetch (%#)',
    async ({ defaultHeaders }) => {
      failures = 1;
      const fetch = vi.fn(globalThis.fetch);
      const search = createParallelSearchTool({ apiKey: 'test-key', baseURL, maxRetries: 1, defaultHeaders, fetch });

      await search.execute!({ searchQueries: ['Mastra tools'] }, {} as any);

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(requests).toHaveLength(2);
      for (const { headers } of requests) {
        expect(headers['user-agent']).toBe('caller/1.0 mastra');
        expect(headers['x-caller']).toBe('preserved');
        expect(headers['x-api-key']).toBe('caller-key');
      }
      expect(requests.map(request => request.headers['x-stainless-retry-count'])).toEqual(['0', '1']);
    },
  );

  it('does not modify requests made outside the Mastra Parallel integration', async () => {
    const client = new Parallel({ apiKey: 'test-key', baseURL, maxRetries: 0 });
    await client.search({ search_queries: ['Parallel SDK'] });

    expect(requests[0]!.headers['user-agent']).toBe(`Parallel/JS ${VERSION}`);
  });
});
