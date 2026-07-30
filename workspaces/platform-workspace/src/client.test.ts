import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlatformApiError } from './client.js';
import { PlatformClient, resolvePlatformOptions } from './client.js';

function response(body: string, init?: ResponseInit) {
  return new Response(body, init);
}

describe('PlatformClient', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds project-scoped proxy requests with bearer auth', async () => {
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test/');
    const fetchMock = vi.fn().mockResolvedValue(response('{}', { status: 200 }));
    const client = new PlatformClient({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      fetch: fetchMock,
    });

    await client.request('/sandbox', { method: 'POST', query: { dryRun: true } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://proxy.test/v1/projects/proj_123/sandbox?dryRun=true');
    expect((init.headers as Headers).get('authorization')).toBe('Bearer sk_test');
    expect(init.method).toBe('POST');
  });

  it('reads the access token from MASTRA_PLATFORM_SECRET_KEY', () => {
    vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', 'sk_secret');
    vi.stubEnv('MASTRA_PROJECT_ID', 'proj_env');

    expect(resolvePlatformOptions({}).accessToken).toBe('sk_secret');
  });

  it('prefers MASTRA_PLATFORM_SECRET_KEY over the deprecated MASTRA_PLATFORM_ACCESS_TOKEN', () => {
    vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', 'sk_secret');
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', 'sk_legacy');
    vi.stubEnv('MASTRA_PROJECT_ID', 'proj_env');

    expect(resolvePlatformOptions({}).accessToken).toBe('sk_secret');
  });

  it('falls back to the deprecated MASTRA_PLATFORM_ACCESS_TOKEN', () => {
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', 'sk_legacy');
    vi.stubEnv('MASTRA_PROJECT_ID', 'proj_env');

    expect(resolvePlatformOptions({}).accessToken).toBe('sk_legacy');
  });

  it('throws PlatformApiError for non-2xx responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response('nope', { status: 401 }));
    const client = new PlatformClient({ accessToken: 'sk_test', projectId: 'proj_123', fetch: fetchMock });

    await expect(client.request('/sandbox')).rejects.toMatchObject({
      status: 401,
      body: 'nope',
      code: undefined,
      proxyMessage: undefined,
    } satisfies Partial<PlatformApiError>);
  });

  it('parses structured proxy error bodies into code and proxyMessage', async () => {
    const body = JSON.stringify({ error: { message: 'Bucket not found', type: 'not_found' } });
    const fetchMock = vi.fn().mockResolvedValue(response(body, { status: 404 }));
    const client = new PlatformClient({ accessToken: 'sk_test', projectId: 'proj_123', fetch: fetchMock });

    const err = await client.request('/sandbox').catch(e => e as PlatformApiError);

    expect(err.status).toBe(404);
    expect(err.code).toBe('not_found');
    expect(err.proxyMessage).toBe('Bucket not found');
    expect(err.body).toBe(body);
    expect(err.message).toContain('not_found: Bucket not found');
  });

  it('leaves code and proxyMessage undefined for non-JSON error bodies', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response('<html>502 Bad Gateway</html>', { status: 502 }));
    const client = new PlatformClient({ accessToken: 'sk_test', projectId: 'proj_123', fetch: fetchMock });

    const err = await client.request('/sandbox').catch(e => e as PlatformApiError);

    expect(err.status).toBe(502);
    expect(err.code).toBeUndefined();
    expect(err.proxyMessage).toBeUndefined();
    expect(err.body).toBe('<html>502 Bad Gateway</html>');
  });

  it('ignores JSON bodies that do not match the proxy error shape', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(JSON.stringify({ foo: 'bar' }), { status: 500 }));
    const client = new PlatformClient({ accessToken: 'sk_test', projectId: 'proj_123', fetch: fetchMock });

    const err = await client.request('/sandbox').catch(e => e as PlatformApiError);

    expect(err.code).toBeUndefined();
    expect(err.proxyMessage).toBeUndefined();
  });
});
