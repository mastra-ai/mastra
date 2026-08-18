import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSandboxHandler, createSandboxProxy } from './index';

describe('createSandboxHandler', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response('agents', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forwards requests to the resolved sandbox URL, preserving path and query', async () => {
    const handler = createSandboxHandler({ resolve: async () => 'https://sbx-1.example' });

    const res = await handler(new Request('https://myapp.com/api/agents?limit=5'));

    expect(await res.text()).toBe('agents');
    const [target] = fetchMock.mock.calls[0]!;
    expect(String(target)).toBe('https://sbx-1.example/api/agents?limit=5');
  });

  it('caches the resolved URL across requests', async () => {
    const resolve = vi.fn(async () => 'https://sbx-1.example');
    const handler = createSandboxHandler({ resolve });

    await handler(new Request('https://myapp.com/api/agents'));
    await handler(new Request('https://myapp.com/api/tools'));

    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('re-resolves and retries once on connection failure', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('ECONNREFUSED')) // old URL is dead
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const resolve = vi.fn().mockResolvedValueOnce('https://old.example').mockResolvedValueOnce('https://new.example');
    const handler = createSandboxHandler({ resolve });

    const res = await handler(new Request('https://myapp.com/api/agents'));

    expect(res.status).toBe(200);
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]![0])).toContain('https://old.example');
    expect(String(fetchMock.mock.calls[1]![0])).toContain('https://new.example');
  });

  it('does not retry non-idempotent requests, and re-resolves on the next request', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED')).mockResolvedValueOnce(new Response('ok'));
    const resolve = vi.fn().mockResolvedValueOnce('https://old.example').mockResolvedValueOnce('https://new.example');
    const handler = createSandboxHandler({ resolve });

    await expect(handler(new Request('https://myapp.com/api/agents', { method: 'POST', body: '{}' }))).rejects.toThrow(
      'ECONNREFUSED',
    );
    expect(resolve).toHaveBeenCalledTimes(1);

    // The failed URL was evicted — the next request resolves fresh.
    await handler(new Request('https://myapp.com/api/agents'));
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]![0])).toContain('https://new.example');
  });

  it('rewrites sandbox-host redirects onto the incoming origin', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: 'https://sbx-1.example/login?next=%2Fapi' } }),
    );
    const handler = createSandboxHandler({ resolve: async () => 'https://sbx-1.example' });

    const res = await handler(new Request('https://myapp.com/api/agents'));

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://myapp.com/login?next=%2Fapi');
  });

  it('rewrites relative redirects and leaves external redirects untouched', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 307, headers: { location: '/agents/dice' } }))
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://other.example/x' } }));
    const handler = createSandboxHandler({ resolve: async () => 'https://sbx-1.example' });

    const relative = await handler(new Request('https://myapp.com/api/agents'));
    expect(relative.headers.get('location')).toBe('https://myapp.com/agents/dice');

    const external = await handler(new Request('https://myapp.com/api/agents'));
    expect(external.headers.get('location')).toBe('https://other.example/x');
  });

  it('attaches the shared secret header and strips host', async () => {
    const handler = createSandboxHandler({ resolve: async () => 'https://sbx-1.example', secret: 's3cret' });

    await handler(new Request('https://myapp.com/api/agents', { headers: { host: 'myapp.com' } }));

    const [, init] = fetchMock.mock.calls[0]!;
    const headers = init.headers as Headers;
    expect(headers.get('x-mastra-sandbox-secret')).toBe('s3cret');
    expect(headers.get('host')).toBeNull();
  });
});

describe('createSandboxProxy', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response(JSON.stringify('https://sbx-1.example'), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('EDGE_CONFIG', 'https://edge-config.vercel.com/ecfg_abc?token=ec-token');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('reads the key from Edge Config and returns a rewrite response', async () => {
    const proxy = createSandboxProxy({ key: 'agent-url' });

    const res = await proxy(new Request('https://myapp.com/api/agents?limit=5'));

    // Edge Config item read with the connection-string token.
    const [itemUrl, init] = fetchMock.mock.calls[0]!;
    expect(String(itemUrl)).toBe('https://edge-config.vercel.com/ecfg_abc/item/agent-url');
    expect(init.headers.Authorization).toBe('Bearer ec-token');

    expect(res?.headers.get('x-middleware-rewrite')).toBe('https://sbx-1.example/api/agents?limit=5');
  });

  it('attaches the shared secret via middleware override headers', async () => {
    const proxy = createSandboxProxy({ key: 'agent-url', secret: 's3cret' });

    const res = await proxy(new Request('https://myapp.com/api/agents'));

    expect(res?.headers.get('x-middleware-request-x-mastra-sandbox-secret')).toBe('s3cret');
    expect(res?.headers.get('x-middleware-override-headers')).toBe('x-mastra-sandbox-secret');
  });

  it('falls through (undefined) when the key is missing or empty', async () => {
    fetchMock.mockResolvedValue(new Response('null', { status: 200 }));
    const proxy = createSandboxProxy({ key: 'agent-url' });

    await expect(proxy(new Request('https://myapp.com/api/agents'))).resolves.toBeUndefined();
  });

  it('falls through (undefined) when Edge Config returns an error', async () => {
    fetchMock.mockResolvedValue(new Response('not found', { status: 404 }));
    const proxy = createSandboxProxy({ key: 'agent-url' });

    await expect(proxy(new Request('https://myapp.com/api/agents'))).resolves.toBeUndefined();
  });

  it('throws when no Edge Config connection string is available', async () => {
    vi.stubEnv('EDGE_CONFIG', '');
    const proxy = createSandboxProxy({ key: 'agent-url' });

    await expect(proxy(new Request('https://myapp.com/api/agents'))).rejects.toThrow(/EDGE_CONFIG/);
  });

  it('throws when created in a browser context', () => {
    vi.stubGlobal('window', {});

    expect(() => createSandboxProxy({ key: 'agent-url' })).toThrow(/server-only/);
  });
});
