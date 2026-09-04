import { afterEach, describe, expect, it, vi } from 'vitest';

import { getCredential, listProjectConnections, proxyRequest, resolveClient } from '../client.js';
import { MastraConnectError } from '../errors.js';

const TOKEN = 'fake-test-token';

function makeClient(fetchMock: ReturnType<typeof vi.fn>, overrides?: Record<string, unknown>) {
  return resolveClient({ accessToken: TOKEN, fetch: fetchMock as unknown as typeof fetch, ...overrides });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('resolveClient', () => {
  it('uses an explicit access token', () => {
    const client = resolveClient({ accessToken: TOKEN });
    expect(client.headers.authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('falls back to MASTRA_PLATFORM_ACCESS_TOKEN', () => {
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', 'env-token-a');
    const client = resolveClient();
    expect(client.headers.authorization).toBe('Bearer env-token-a');
  });

  it('falls back to MASTRA_PLATFORM_SECRET_KEY when the access token env is unset', () => {
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', '');
    vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', 'env-secret-b');
    const client = resolveClient();
    expect(client.headers.authorization).toBe('Bearer env-secret-b');
  });

  it('throws missing_access_token when no token is available', () => {
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', '');
    vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', '');
    try {
      resolveClient();
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(MastraConnectError);
      expect((error as MastraConnectError).code).toBe('missing_access_token');
    }
  });

  it('defaults to the global integrations URL', () => {
    vi.stubEnv('MASTRA_INTEGRATIONS_API_URL', '');
    vi.stubEnv('MASTRA_PLATFORM_REGION', '');
    const client = resolveClient({ accessToken: TOKEN });
    expect(client.baseUrl).toBe('https://integrations.mastra.ai');
  });

  it.each([
    ['us', 'https://integrations.us.mastra.ai'],
    ['eu', 'https://integrations.eu.mastra.ai'],
    ['US', 'https://integrations.us.mastra.ai'],
    [' Eu ', 'https://integrations.eu.mastra.ai'],
  ])('resolves region %s to %s', (region, expected) => {
    vi.stubEnv('MASTRA_INTEGRATIONS_API_URL', '');
    vi.stubEnv('MASTRA_PLATFORM_REGION', region);
    const client = resolveClient({ accessToken: TOKEN });
    expect(client.baseUrl).toBe(expected);
  });

  it('falls through to the global URL for unknown regions', () => {
    vi.stubEnv('MASTRA_INTEGRATIONS_API_URL', '');
    vi.stubEnv('MASTRA_PLATFORM_REGION', 'mars');
    const client = resolveClient({ accessToken: TOKEN });
    expect(client.baseUrl).toBe('https://integrations.mastra.ai');
  });

  it('lets MASTRA_INTEGRATIONS_API_URL override the region', () => {
    vi.stubEnv('MASTRA_INTEGRATIONS_API_URL', 'https://example.test/api///');
    vi.stubEnv('MASTRA_PLATFORM_REGION', 'us');
    const client = resolveClient({ accessToken: TOKEN });
    expect(client.baseUrl).toBe('https://example.test/api');
  });

  it('lets an explicit baseUrl option override everything', () => {
    vi.stubEnv('MASTRA_INTEGRATIONS_API_URL', 'https://example.test/env');
    const client = resolveClient({ accessToken: TOKEN, baseUrl: 'https://example.test/opt/' });
    expect(client.baseUrl).toBe('https://example.test/opt');
  });

  it('omits x-organization-id unless configured', () => {
    vi.stubEnv('MASTRA_ORG_ID', '');
    const client = resolveClient({ accessToken: TOKEN });
    expect(client.headers['x-organization-id']).toBeUndefined();
  });

  it('sends x-organization-id from the option or MASTRA_ORG_ID', () => {
    expect(resolveClient({ accessToken: TOKEN, orgId: 'org_1' }).headers['x-organization-id']).toBe('org_1');
    vi.stubEnv('MASTRA_ORG_ID', 'org_env');
    expect(resolveClient({ accessToken: TOKEN }).headers['x-organization-id']).toBe('org_env');
  });
});

describe('listProjectConnections', () => {
  const connection = {
    id: 'c_lin1',
    integrationId: 'linear',
    status: 'active',
    connectedByUserId: 'user_1',
    connectedAt: '2026-09-01T00:00:00Z',
    createdAt: '2026-09-01T00:00:00Z',
    accountLabel: 'Acme',
  };

  it('parses the connection list and sends auth headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ connections: [connection] }));
    const client = makeClient(fetchMock, { baseUrl: 'https://example.test' });
    const connections = await listProjectConnections(client, 'proj_1');
    expect(connections).toHaveLength(1);
    expect(connections[0]!.integrationId).toBe('linear');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.test/v2/projects/proj_1/connections');
    expect(init.headers.authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('maps a platform 401 to unauthorized', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ error: 'bad token' }, { status: 401 }));
    const client = makeClient(fetchMock, { baseUrl: 'https://example.test' });
    await expect(listProjectConnections(client, 'proj_1')).rejects.toMatchObject({
      code: 'unauthorized',
      status: 401,
    });
  });

  it('maps a platform 404 to connection_not_found', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ error: 'no project' }, { status: 404 }));
    const client = makeClient(fetchMock, { baseUrl: 'https://example.test' });
    await expect(listProjectConnections(client, 'proj_1')).rejects.toMatchObject({
      code: 'connection_not_found',
      status: 404,
    });
  });

  it('throws platform_error on malformed response shapes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ nope: true }));
    const client = makeClient(fetchMock, { baseUrl: 'https://example.test' });
    await expect(listProjectConnections(client, 'proj_1')).rejects.toMatchObject({ code: 'platform_error' });
  });

  it('redacts the access token from transport error messages', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error(`connect failed for Bearer ${TOKEN} at host`));
    const client = makeClient(fetchMock, { baseUrl: 'https://example.test' });
    try {
      await listProjectConnections(client, 'proj_1');
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain(TOKEN);
      expect((error as Error).message).toContain('[REDACTED]');
    }
  });
});

describe('getCredential', () => {
  it('parses an oauth2 credential', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ type: 'oauth2', accessToken: 'fake-provider-token', expiresAt: null }));
    const client = makeClient(fetchMock, { baseUrl: 'https://example.test' });
    const result = await getCredential(client, 'c_1');
    expect(result).toEqual({ type: 'oauth2', accessToken: 'fake-provider-token', expiresAt: null });
  });

  it('parses an api_key credential', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ type: 'api_key', apiKey: 'fake-api-key' }));
    const client = makeClient(fetchMock, { baseUrl: 'https://example.test' });
    const result = await getCredential(client, 'c_1');
    expect(result).toEqual({ type: 'api_key', apiKey: 'fake-api-key' });
  });

  it('throws unsupported_credential_type for unknown unions', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ type: 'basic', username: 'u' }));
    const client = makeClient(fetchMock, { baseUrl: 'https://example.test' });
    await expect(getCredential(client, 'c_1')).rejects.toMatchObject({ code: 'unsupported_credential_type' });
  });

  it('maps the platform unsupported_credential_type problem code', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ title: 'Unsupported credential', status: 502, code: 'unsupported_credential_type' }),
          { status: 502, headers: { 'content-type': 'application/problem+json' } },
        ),
      );
    const client = makeClient(fetchMock, { baseUrl: 'https://example.test' });
    await expect(getCredential(client, 'c_1')).rejects.toMatchObject({ code: 'unsupported_credential_type' });
  });
});

describe('proxyRequest', () => {
  it('builds the proxy URL with query params and strips leading slashes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const client = makeClient(fetchMock, { baseUrl: 'https://example.test' });
    await proxyRequest(client, 'c_1', {
      method: 'GET',
      path: '/issues',
      query: { page: 2, q: 'bug fix', skip: undefined },
    });
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.test/v2/connections/c_1/proxy/issues?page=2&q=bug+fix');
  });

  it('JSON-encodes bodies and forwards custom headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const client = makeClient(fetchMock, { baseUrl: 'https://example.test' });
    await proxyRequest(client, 'c_1', {
      method: 'POST',
      path: 'graphql',
      headers: { 'x-custom': 'v1' },
      body: { query: '{ viewer { id } }' },
    });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.method).toBe('POST');
    expect(init.headers['content-type']).toBe('application/json');
    expect(init.headers['x-custom']).toBe('v1');
    expect(JSON.parse(init.body)).toEqual({ query: '{ viewer { id } }' });
  });

  it('keeps a provider 404 as proxy_error (never connection_not_found)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ message: 'page not found' }, { status: 404 }));
    const client = makeClient(fetchMock, { baseUrl: 'https://example.test' });
    await expect(proxyRequest(client, 'c_1', { method: 'GET', path: 'pages/x' })).rejects.toMatchObject({
      code: 'proxy_error',
      status: 404,
    });
  });

  it('maps a platform problem-JSON 404 to connection_not_found', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ title: 'Connection not found', status: 404, detail: 'unknown connection' }), {
        status: 404,
        headers: { 'content-type': 'application/problem+json' },
      }),
    );
    const client = makeClient(fetchMock, { baseUrl: 'https://example.test' });
    await expect(proxyRequest(client, 'c_1', { method: 'GET', path: 'issues' })).rejects.toMatchObject({
      code: 'connection_not_found',
      status: 404,
      detail: 'unknown connection',
    });
  });

  it('maps a platform problem-JSON 401 to unauthorized', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ title: 'Unauthorized', status: 401 }), {
        status: 401,
        headers: { 'content-type': 'application/problem+json' },
      }),
    );
    const client = makeClient(fetchMock, { baseUrl: 'https://example.test' });
    await expect(proxyRequest(client, 'c_1', { method: 'GET', path: 'issues' })).rejects.toMatchObject({
      code: 'unauthorized',
    });
  });

  it('keeps a provider problem-shaped application/json 404 as proxy_error', async () => {
    // A provider body that *looks* RFC-7807 (e.g. ASP.NET ProblemDetails) but
    // is served as plain application/json must not map to connection_not_found.
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ title: 'Not Found', status: 404, detail: 'no such page' }, { status: 404 }));
    const client = makeClient(fetchMock, { baseUrl: 'https://example.test' });
    await expect(proxyRequest(client, 'c_1', { method: 'GET', path: 'pages/x' })).rejects.toMatchObject({
      code: 'proxy_error',
      status: 404,
    });
  });

  it('keeps a provider 401 as proxy_error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ message: 'expired token' }, { status: 401 }));
    const client = makeClient(fetchMock, { baseUrl: 'https://example.test' });
    await expect(proxyRequest(client, 'c_1', { method: 'GET', path: 'me' })).rejects.toMatchObject({
      code: 'proxy_error',
      status: 401,
    });
  });

  it('never echoes the access token in proxy error messages', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ message: 'boom' }, { status: 500 }));
    const client = makeClient(fetchMock, { baseUrl: 'https://example.test' });
    try {
      await proxyRequest(client, 'c_1', { method: 'GET', path: 'x' });
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain(TOKEN);
    }
  });

  it('handles non-JSON provider error bodies without echoing them', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('<html>secret page</html>', { status: 500 }));
    const client = makeClient(fetchMock, { baseUrl: 'https://example.test' });
    try {
      await proxyRequest(client, 'c_1', { method: 'GET', path: 'x' });
      expect.unreachable();
    } catch (error) {
      expect((error as MastraConnectError).code).toBe('proxy_error');
      expect((error as Error).message).not.toContain('secret page');
    }
  });

  it('returns parsed JSON on 2xx and null on empty bodies', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ data: 1 }));
    const client = makeClient(fetchMock, { baseUrl: 'https://example.test' });
    await expect(proxyRequest(client, 'c_1', { method: 'GET', path: 'x' })).resolves.toEqual({ data: 1 });

    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(proxyRequest(client, 'c_1', { method: 'DELETE', path: 'x' })).resolves.toBeNull();
  });
});
