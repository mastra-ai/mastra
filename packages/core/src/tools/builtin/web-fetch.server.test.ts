import dns from 'node:dns';
import type { LookupAddress, LookupOptions } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { syncBuiltinESMExports } from 'node:module';
import type { AddressInfo } from 'node:net';

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { webFetchTool } from './web-fetch';

// Requests go to a real local HTTP server. Only DNS is redirected: names under TEST_DOMAIN resolve to the
// loopback server, the way a public hostname with a private A record would.
const TEST_DOMAIN = 'web-fetch.test';
const realLookup = dns.lookup;

let server: http.Server;
let port: number;
const requestedPaths: string[] = [];

function testUrl(path: string, host = `site.${TEST_DOMAIN}`) {
  return `http://${host}:${port}${path}`;
}

async function runTool(url: string) {
  return (await webFetchTool.execute!({ url }, {} as never)) as Record<string, unknown>;
}

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url!, 'http://local');
    requestedPaths.push(url.pathname);

    if (url.pathname === '/page') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<h1>héllo</h1>');
    } else if (url.pathname === '/large') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('a'.repeat(150_000));
    } else if (url.pathname === '/not-found') {
      res.writeHead(404, 'Not Found', { 'content-type': 'text/plain' });
      res.end('missing');
    } else if (url.pathname.startsWith('/chain/')) {
      const remaining = Number(url.pathname.split('/')[2]);
      res.writeHead(302, { location: remaining > 0 ? `/chain/${remaining - 1}` : '/page' });
      res.end();
    } else if (url.pathname === '/to-private') {
      res.writeHead(302, { location: 'http://10.0.0.1/secret' });
      res.end();
    } else if (url.pathname === '/to-localhost') {
      res.writeHead(301, { location: `http://localhost:${port}/page` });
      res.end();
    } else if (url.pathname === '/to-localhost-dot') {
      res.writeHead(301, { location: `http://localhost.:${port}/page` });
      res.end();
    } else if (url.pathname === '/to-file') {
      res.writeHead(302, { location: 'file:///etc/passwd' });
      res.end();
    } else {
      res.writeHead(500);
      res.end();
    }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;

  vi.spyOn(dns, 'lookup').mockImplementation(((
    hostname: string,
    options: LookupOptions | ((...args: unknown[]) => void),
    callback?: (error: Error | null, address: string | LookupAddress[], family?: number) => void,
  ) => {
    const cb = typeof options === 'function' ? options : callback!;
    const opts = typeof options === 'function' ? {} : options;

    if (hostname !== TEST_DOMAIN && !hostname.endsWith(`.${TEST_DOMAIN}`)) {
      return (realLookup as Function)(hostname, opts, cb);
    }

    return opts.all ? cb(null, [{ address: '127.0.0.1', family: 4 }]) : cb(null, '127.0.0.1', 4);
  }) as typeof dns.lookup);
  // web-fetch.ts imports `lookup` by name, so the ESM binding needs to pick up the spy too.
  syncBuiltinESMExports();
});

afterAll(async () => {
  vi.restoreAllMocks();
  syncBuiltinESMExports();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
});

afterEach(() => {
  requestedPaths.length = 0;
});

describe('web_fetch on Node', () => {
  it('blocks a hostname whose DNS answer is a private address before connecting', async () => {
    const result = await runTool(testUrl('/page'));

    expect(result).toEqual({
      content: 'Failed to fetch URL: URL resolves to a private or reserved address.',
      isError: true,
    });
    expect(requestedPaths).toEqual([]);
  });
});

describe('web_fetch when the Node request API is not implemented (Cloudflare Workers)', () => {
  // The error workerd's nodejs_compat throws synchronously from http(s).request when given `lookup`.
  function notImplemented(): never {
    const error = new Error('The options.lookup option is not implemented') as NodeJS.ErrnoException;
    error.code = 'ERR_OPTION_NOT_IMPLEMENTED';
    throw error;
  }

  beforeAll(() => {
    vi.spyOn(http, 'request').mockImplementation(notImplemented);
    vi.spyOn(https, 'request').mockImplementation(notImplemented);
  });

  afterAll(() => {
    vi.mocked(http.request).mockRestore();
    vi.mocked(https.request).mockRestore();
  });

  it('fetches the page and returns response metadata', async () => {
    const result = await runTool(testUrl('/page'));

    expect(result).toEqual({
      content: '<h1>héllo</h1>',
      truncated: false,
      status: 200,
      statusText: 'OK',
      contentType: 'text/html; charset=utf-8',
      url: testUrl('/page'),
      ok: true,
    });
  });

  it('returns non-2xx responses as content with ok: false', async () => {
    const result = await runTool(testUrl('/not-found'));

    expect(result).toMatchObject({ content: 'missing', status: 404, statusText: 'Not Found', ok: false });
  });

  it('truncates content at 100,000 characters', async () => {
    const result = await runTool(testUrl('/large'));

    expect(result.truncated).toBe(true);
    expect(result.content).toBe('a'.repeat(100_000));
  });

  it.each([
    'http://127.0.0.1/',
    'http://10.1.2.3/',
    'http://[::1]/',
    'http://localhost/',
    'http://localhost./',
    'http://api.localhost/',
  ])('blocks the literal private host %s without sending a request', async url => {
    const result = await runTool(url);

    expect(result).toEqual({
      content: 'Failed to fetch URL: URL resolves to a private or reserved address.',
      isError: true,
    });
  });

  it.each([
    ['a private IP', '/to-private', 'URL resolves to a private or reserved address.'],
    ['localhost', '/to-localhost', 'URL resolves to a private or reserved address.'],
    ['localhost with a trailing dot', '/to-localhost-dot', 'URL resolves to a private or reserved address.'],
    ['a non-HTTP scheme', '/to-file', 'Redirect target must use HTTP or HTTPS.'],
  ])('checks redirect targets on every hop and refuses %s', async (_label, path, message) => {
    const result = await runTool(testUrl(path));

    expect(result).toEqual({ content: `Failed to fetch URL: ${message}`, isError: true });
    expect(requestedPaths).toEqual([path]);
  });

  it('follows up to five redirects', async () => {
    const result = await runTool(testUrl('/chain/4'));

    expect(result).toMatchObject({ content: '<h1>héllo</h1>', status: 200, url: testUrl('/page') });
    expect(requestedPaths).toEqual(['/chain/4', '/chain/3', '/chain/2', '/chain/1', '/chain/0', '/page']);
  });

  it('stops after five redirects', async () => {
    const result = await runTool(testUrl('/chain/5'));

    expect(result).toEqual({ content: 'Failed to fetch URL: Too many redirects. Maximum is 5.', isError: true });
    expect(requestedPaths).toHaveLength(6);
  });

  // Known gap: fetch resolves DNS itself, so a hostname is only checked by name, not by the address it resolves to.
  it('does not block a hostname whose DNS answer is a private address', async () => {
    const result = await runTool(testUrl('/page'));

    expect(result).toMatchObject({ status: 200, ok: true });
  });
});

describe('web_fetch when the Node request API fails for another reason', () => {
  it('reports the error instead of falling back to fetch', async () => {
    const spy = vi.spyOn(http, 'request').mockImplementation(() => {
      throw new TypeError('Invalid header value');
    });

    try {
      const result = await runTool(testUrl('/page'));

      expect(result).toEqual({ content: 'Failed to fetch URL: Invalid header value', isError: true });
      expect(requestedPaths).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });
});
