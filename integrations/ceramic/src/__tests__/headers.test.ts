import { createServer } from 'node:http';
import type { IncomingHttpHeaders, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import Ceramic from 'ceramic-ai';
import { VERSION } from 'ceramic-ai/version';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CeramicClientOptions } from '../client.js';
import { createCeramicSearchTool } from '../search.js';

// Use the real SDK and HTTP server: constructor configuration alone cannot prove attribution.
describe('Ceramic request headers', () => {
  let server: Server;
  let baseURL: string;
  let requests: { method: string; path: string; headers: IncomingHttpHeaders; body: string }[];
  let failures: number;

  beforeEach(async () => {
    requests = [];
    failures = 0;
    server = createServer((request, response) => {
      let body = '';
      request.on('data', chunk => (body += chunk));
      request.on('end', () => {
        requests.push({ method: request.method!, path: request.url!, headers: request.headers, body });
        response.setHeader('Content-Type', 'application/json');
        if (failures > 0) {
          failures--;
          response.writeHead(500, { 'retry-after-ms': '1' });
          response.end(JSON.stringify({ error: 'retry this request' }));
          return;
        }
        response.end(
          JSON.stringify({
            requestId: 'request_test',
            result: { results: [], searchMetadata: { executionTime: 0.01 }, totalResults: 0 },
          }),
        );
      });
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  });

  it('identifies repeated Search requests while preserving SDK/auth headers', async () => {
    const search = createCeramicSearchTool({ apiKey: 'test-key', baseURL, maxRetries: 0 });

    await search.execute!({ query: 'Mastra tools' }, {} as any);
    await search.execute!({ query: 'Mastra agents', maxResults: 5 }, {} as any);

    expect(requests.map(request => `${request.method} ${request.path}`)).toEqual(['POST /search', 'POST /search']);
    expect(requests.map(request => JSON.parse(request.body))).toEqual([
      { query: 'Mastra tools' },
      { query: 'Mastra agents', maxResults: 5 },
    ]);
    for (const { headers } of requests) {
      expect(headers['user-agent']).toBe(`Ceramic/JS ${VERSION} mastra`);
      expect(headers['authorization']).toBe('Bearer test-key');
      expect(headers['content-type']).toBe('application/json');
      expect(headers['x-stainless-lang']).toBe('js');
    }
  });

  const callerHeaders: CeramicClientOptions['defaultHeaders'][] = [
    { 'uSeR-aGeNt': 'caller/1.0', 'X-Caller': 'preserved' },
    new Headers({ 'User-Agent': 'caller/1.0', 'X-Caller': 'preserved' }),
    [
      ['User-Agent', 'caller/1.0'],
      ['X-Caller', 'preserved'],
    ],
  ];

  it.each(callerHeaders.map(defaultHeaders => ({ defaultHeaders })))(
    'preserves supported caller headers through retries and a custom fetch (%#)',
    async ({ defaultHeaders }) => {
      failures = 1;
      const fetch = vi.fn(globalThis.fetch);
      const search = createCeramicSearchTool({ apiKey: 'test-key', baseURL, maxRetries: 1, defaultHeaders, fetch });

      await search.execute!({ query: 'Mastra tools' }, {} as any);

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(requests).toHaveLength(2);
      for (const { headers } of requests) {
        expect(headers['user-agent']).toBe('caller/1.0 mastra');
        expect(headers['x-caller']).toBe('preserved');
        expect(headers['authorization']).toBe('Bearer test-key');
      }
      expect(requests.map(request => request.headers['x-stainless-retry-count'])).toEqual(['0', '1']);
    },
  );

  it('does not modify requests made outside the Mastra Ceramic integration', async () => {
    const client = new Ceramic({ apiKey: 'test-key', baseURL, maxRetries: 0 });
    await client.search({ query: 'Ceramic SDK' });

    expect(requests[0]!.headers['user-agent']).toBe(`Ceramic/JS ${VERSION}`);
  });
});
