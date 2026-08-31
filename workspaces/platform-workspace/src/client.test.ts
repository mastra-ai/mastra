import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlatformApiError } from './client.js';
import { PlatformClient, resolvePlatformOptions } from './client.js';

function response(body: string, init?: ResponseInit) {
  return new Response(body, init);
}

describe('PlatformClient', () => {
  beforeEach(() => {
    vi.stubEnv('SANDBOX_PROVIDER', 'railway');
  });

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
    expect(String(url)).toBe('https://proxy.test/v1/railway/projects/proj_123/sandbox?dryRun=true');
    expect((init.headers as Headers).get('authorization')).toBe('Bearer sk_test');
    expect((init.headers as Headers).get('x-acting-user-id')).toBeNull();
    expect(init.method).toBe('POST');
  });

  it('uses E2B provider routes when SANDBOX_PROVIDER is unset', async () => {
    vi.stubEnv('SANDBOX_PROVIDER', undefined);
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    const fetchMock = vi.fn().mockResolvedValue(response('{}', { status: 200 }));
    const client = new PlatformClient({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      fetch: fetchMock,
    });

    await client.request('/sandbox');

    expect(client.sandboxProvider).toBe('e2b');
    expect(String(fetchMock.mock.calls[0]![0])).toBe('https://proxy.test/v1/e2b/projects/proj_123/sandbox');
  });

  it('uses E2B provider routes when SANDBOX_PROVIDER is e2b', async () => {
    vi.stubEnv('SANDBOX_PROVIDER', 'e2b');
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    const fetchMock = vi.fn().mockResolvedValue(response('{}', { status: 200 }));
    const client = new PlatformClient({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      fetch: fetchMock,
    });

    await client.request('/fs/bucket/path');

    expect(String(fetchMock.mock.calls[0]![0])).toBe('https://proxy.test/v1/e2b/projects/proj_123/fs/bucket/path');
  });

  it('prefers an explicit sandboxProvider over SANDBOX_PROVIDER', async () => {
    vi.stubEnv('SANDBOX_PROVIDER', 'railway');
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    const fetchMock = vi.fn().mockResolvedValue(response('{}', { status: 200 }));
    const client = new PlatformClient({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      sandboxProvider: 'e2b',
      fetch: fetchMock,
    });

    await client.request('/sandbox');

    expect(client.sandboxProvider).toBe('e2b');
    expect(String(fetchMock.mock.calls[0]![0])).toBe('https://proxy.test/v1/e2b/projects/proj_123/sandbox');
  });

  it('uses the default E2B provider for sandbox and template requests', async () => {
    vi.stubEnv('SANDBOX_PROVIDER', undefined);
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    const fetchMock = vi.fn().mockResolvedValue(response('{}', { status: 200 }));
    const client = new PlatformClient({ accessToken: 'sk_test', projectId: 'proj_123', fetch: fetchMock });

    await client.request('/sandbox');
    await client.requestProvider('/templates/builds');

    expect(String(fetchMock.mock.calls[0]![0])).toBe('https://proxy.test/v1/e2b/projects/proj_123/sandbox');
    expect(String(fetchMock.mock.calls[1]![0])).toBe('https://proxy.test/v1/e2b/projects/proj_123/templates/builds');
  });

  it('rejects unsupported SANDBOX_PROVIDER values', () => {
    vi.stubEnv('SANDBOX_PROVIDER', 'unknown');

    expect(
      () =>
        new PlatformClient({
          accessToken: 'sk_test',
          projectId: 'proj_123',
        }),
    ).toThrow('SANDBOX_PROVIDER must be either "railway" or "e2b"');
  });

  it('sends an opaque acting-user subject on every request', async () => {
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    const fetchMock = vi.fn().mockResolvedValue(response('{}', { status: 200 }));
    const client = new PlatformClient({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      actingUserId: '  external-user-42  ',
      fetch: fetchMock,
    });

    await client.request('/sandbox');
    await client.request('/sandbox/sbx_1/exec-lease', { method: 'POST' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchMock.mock.calls) {
      expect((init.headers as Headers).get('x-acting-user-id')).toBe('external-user-42');
    }
  });

  it('sends advisory session/thread correlation headers when configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response('{}', { status: 200 }));
    const client = new PlatformClient({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      sessionId: 'sess_42',
      threadId: 'thread_7',
      fetch: fetchMock,
    });

    await client.request('/sandbox');

    const [, init] = fetchMock.mock.calls[0]!;
    expect((init.headers as Headers).get('x-mastra-session-id')).toBe('sess_42');
    expect((init.headers as Headers).get('x-mastra-thread-id')).toBe('thread_7');
    // Auth is unchanged — the correlation headers ride alongside, never replace.
    expect((init.headers as Headers).get('authorization')).toBe('Bearer sk_test');
  });

  it('omits correlation headers when session/thread ids are not configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response('{}', { status: 200 }));
    const client = new PlatformClient({ accessToken: 'sk_test', projectId: 'proj_123', fetch: fetchMock });

    await client.request('/sandbox');

    const [, init] = fetchMock.mock.calls[0]!;
    expect((init.headers as Headers).get('x-mastra-session-id')).toBeNull();
    expect((init.headers as Headers).get('x-mastra-thread-id')).toBeNull();
  });

  it('reads the access token from MASTRA_PLATFORM_ACCESS_TOKEN', () => {
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', 'platform_access_token');
    vi.stubEnv('MASTRA_PROJECT_ID', 'proj_env');

    expect(resolvePlatformOptions({}).accessToken).toBe('platform_access_token');
  });

  it('does not use MASTRA_PLATFORM_SECRET_KEY as an access token fallback', () => {
    vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', 'sk_secret');
    vi.stubEnv('MASTRA_PROJECT_ID', 'proj_env');

    expect(() => resolvePlatformOptions({})).toThrow('accessToken is required');
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
