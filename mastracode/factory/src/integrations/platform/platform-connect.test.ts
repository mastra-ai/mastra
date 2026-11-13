import { MastraConnectError } from '@mastra/connect';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  connectProxyFetch,
  createPlatformConnectClient,
  platformRedirectLocation,
  platformRetryDelayMs,
} from './platform-connect.js';

const accessToken = 'platform-secret-token';

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

function sent(fetchImpl: ReturnType<typeof vi.fn<typeof fetch>>, index = 0): { url: string; init: RequestInit } {
  const [input, init] = fetchImpl.mock.calls[index]!;
  return { url: String(input), init: init ?? {} };
}

function stderr() {
  return vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('createPlatformConnectClient from the environment', () => {
  function fromEnv(env: Record<string, string>) {
    for (const name of [
      'MASTRA_INTEGRATIONS_API_URL',
      'MASTRA_PLATFORM_REGION',
      'MASTRA_SHARED_API_URL',
      'MASTRA_PLATFORM_ACCESS_TOKEN',
      'MASTRA_PLATFORM_SECRET_KEY',
      'MASTRA_PROJECT_ID',
      'MASTRA_ORG_ID',
    ]) {
      vi.stubEnv(name, env[name] ?? '');
    }
    const fetchImpl = vi.fn<typeof fetch>(async () => json({ ok: true }));
    return { client: createPlatformConnectClient({ fetch: fetchImpl }), fetchImpl };
  }

  it('normalizes MASTRA_INTEGRATIONS_API_URL and strips a trailing /v1', async () => {
    const { client, fetchImpl } = fromEnv({
      MASTRA_INTEGRATIONS_API_URL: 'https://platform.example.com/v1/',
      MASTRA_PLATFORM_ACCESS_TOKEN: accessToken,
    });
    expect(client.baseUrl).toBe('https://platform.example.com');

    await client.request('GET', '/v1/server/linear/workspaces');
    expect(sent(fetchImpl).url).toBe('https://platform.example.com/v1/server/linear/workspaces');
  });

  it('routes by MASTRA_PLATFORM_REGION and never by MASTRA_SHARED_API_URL', () => {
    const shared = {
      MASTRA_SHARED_API_URL: 'https://platform.example.com/v1',
      MASTRA_PLATFORM_ACCESS_TOKEN: accessToken,
    };
    expect(fromEnv(shared).client.baseUrl).toBe('https://integrations.mastra.ai');
    expect(fromEnv({ ...shared, MASTRA_PLATFORM_REGION: 'us' }).client.baseUrl).toBe(
      'https://integrations.us.mastra.ai',
    );
    expect(fromEnv({ ...shared, MASTRA_PLATFORM_REGION: 'eu' }).client.baseUrl).toBe(
      'https://integrations.eu.mastra.ai',
    );
  });

  it('prefers MASTRA_PLATFORM_ACCESS_TOKEN over MASTRA_PLATFORM_SECRET_KEY and sends no ambient credentials', async () => {
    const { client, fetchImpl } = fromEnv({
      MASTRA_PLATFORM_ACCESS_TOKEN: accessToken,
      MASTRA_PLATFORM_SECRET_KEY: 'secret-key',
    });

    await client.request('POST', '/v1/test', { body: { value: 1 } });

    const { init } = sent(fetchImpl);
    expect(new Headers(init.headers).get('authorization')).toBe(`Bearer ${accessToken}`);
    expect(init.body).toBe(JSON.stringify({ value: 1 }));
    expect(init).not.toHaveProperty('credentials');
  });

  it('sends x-mastra-project-id only when MASTRA_PROJECT_ID is set', async () => {
    const scoped = fromEnv({ MASTRA_PLATFORM_ACCESS_TOKEN: accessToken, MASTRA_PROJECT_ID: 'proj_123' });
    await scoped.client.request('GET', '/v2/connections/a1b/proxy/api/v4/user');
    expect(new Headers(sent(scoped.fetchImpl).init.headers).get('x-mastra-project-id')).toBe('proj_123');

    const unscoped = fromEnv({ MASTRA_PLATFORM_ACCESS_TOKEN: accessToken });
    await unscoped.client.request('GET', '/v2/connections/a1b/proxy/api/v4/user');
    expect(new Headers(sent(unscoped.fetchImpl).init.headers).has('x-mastra-project-id')).toBe(false);
  });

  it('sends x-organization-id only when MASTRA_ORG_ID is set, which Factory deployments do not set', async () => {
    const unset = fromEnv({ MASTRA_PLATFORM_ACCESS_TOKEN: accessToken });
    await unset.client.request('GET', '/v1/server/linear/workspaces');
    expect(new Headers(sent(unset.fetchImpl).init.headers).has('x-organization-id')).toBe(false);

    const set = fromEnv({ MASTRA_PLATFORM_ACCESS_TOKEN: accessToken, MASTRA_ORG_ID: 'org_123' });
    await set.client.request('GET', '/v1/server/linear/workspaces');
    expect(new Headers(sent(set.fetchImpl).init.headers).get('x-organization-id')).toBe('org_123');
  });

  it('uses a client it is given as-is', () => {
    const client = createPlatformConnectClient({ baseUrl: 'https://platform.example.com', accessToken });
    expect(createPlatformConnectClient(client)).toBe(client);
  });
});

describe('platform failure logging', () => {
  it('logs a rate-limited call and keeps its retry timing on the error', async () => {
    const log = stderr();
    const client = createPlatformConnectClient({
      baseUrl: 'https://platform.example.com',
      accessToken,
      fetch: async () => json({ detail: 'Rate limited' }, 429, { 'retry-after': '17' }),
    });

    const error = await client.request('GET', '/v1/test?cursor=secret-cursor').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(MastraConnectError);
    expect(error).toMatchObject({ status: 429, detail: 'Rate limited', retryAfterMs: 17_000 });
    expect(platformRetryDelayMs(error, 1_000)).toBe(17_000);
    expect(platformRetryDelayMs(error, 30_000)).toBe(30_000);
    const logged = String(log.mock.calls[0]?.[0]);
    expect(logged).toContain('[Mastra Factory] ERROR Platform API request failed');
    expect(logged).toContain('"method":"GET"');
    expect(logged).toContain('"path":"/v1/test"');
    expect(logged).not.toContain('secret-cursor');
    expect(logged).toContain('"status":429');
    expect(logged).toContain('"retryAfter":"17"');
  });

  it('only backs off for the retry timing of a 429', () => {
    const unavailable = new MastraConnectError('platform_error', 'down', { status: 503, retryAfterMs: 9_000 });
    expect(platformRetryDelayMs(unavailable, 1_000)).toBe(1_000);
    expect(platformRetryDelayMs(new Error('boom'), 1_000)).toBe(1_000);
  });

  it('keeps the access token out of errors and logs when a server or socket echoes it', async () => {
    const log = stderr();
    const http = createPlatformConnectClient({
      baseUrl: 'https://platform.example.com',
      accessToken,
      fetch: async () => json({ detail: `Rejected Bearer ${accessToken}` }, 502),
    });
    const transport = createPlatformConnectClient({
      baseUrl: 'https://platform.example.com',
      accessToken,
      fetch: async () => {
        throw new Error(`socket failure for ${accessToken}`);
      },
    });

    await expect(http.request('GET', '/v1/test')).rejects.toMatchObject({ detail: 'Rejected Bearer [REDACTED]' });
    await expect(transport.request('GET', '/v1/test')).rejects.toMatchObject({
      message: expect.stringContaining('socket failure for [REDACTED]'),
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain(accessToken);
    expect(JSON.stringify(log.mock.calls)).toContain('[REDACTED]');
  });
});

describe('platformRedirectLocation', () => {
  it('returns the redirect location without following it', async () => {
    const log = stderr();
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response(null, { status: 302, headers: { location: 'https://linear.app/oauth/authorize' } }),
    );
    const client = createPlatformConnectClient({
      baseUrl: 'https://platform.example.com',
      accessToken,
      fetch: fetchImpl,
    });

    await expect(platformRedirectLocation(client, 'GET', '/v1/server/linear/authorize')).resolves.toBe(
      'https://linear.app/oauth/authorize',
    );
    const { url, init } = sent(fetchImpl);
    expect(url).toBe('https://platform.example.com/v1/server/linear/authorize');
    expect(init).toMatchObject({ method: 'GET', redirect: 'manual' });
    expect(new Headers(init.headers).get('authorization')).toBe(`Bearer ${accessToken}`);
    expect(log).not.toHaveBeenCalled();
  });

  it('throws with the status when the route answers without a redirect', async () => {
    stderr();
    const client = createPlatformConnectClient({
      baseUrl: 'https://platform.example.com',
      accessToken,
      fetch: async () => json({ detail: 'Not allowed' }, 403),
    });

    await expect(platformRedirectLocation(client, 'GET', '/v1/server/linear/authorize?x=1')).rejects.toMatchObject({
      name: 'MastraConnectError',
      status: 403,
      source: 'platform',
    });
  });
});

describe('connectProxyFetch', () => {
  it('sends provider client requests through Connect with the platform credential', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json({ id: 'issue-1' }));
    const connect = createPlatformConnectClient({
      baseUrl: 'https://platform.example.com',
      accessToken,
      projectId: 'proj_123',
      fetch: fetchImpl,
    });
    const proxied = connectProxyFetch(connect);

    const response = await proxied('https://platform.example.com/v2/connections/a1b/proxy/v1/issues', {
      method: 'POST',
      headers: { authorization: 'Bearer provider-placeholder', 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Bug' }),
    });

    await expect(response.json()).resolves.toEqual({ id: 'issue-1' });
    const { url, init } = sent(fetchImpl);
    expect(url).toBe('https://platform.example.com/v2/connections/a1b/proxy/v1/issues');
    const headers = new Headers(init.headers);
    expect(headers.get('authorization')).toBe(`Bearer ${accessToken}`);
    expect(headers.get('x-mastra-project-id')).toBe('proj_123');
    expect(init.body).toBe(JSON.stringify({ title: 'Bug' }));
  });

  it('refuses requests outside the Connect API', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const proxied = connectProxyFetch(
      createPlatformConnectClient({ baseUrl: 'https://platform.example.com', accessToken, fetch: fetchImpl }),
    );

    await expect(proxied('https://evil.example.com/v2/connections/a1b/proxy/x')).rejects.toThrow(
      /outside the Connect API/,
    );
    await expect(proxied('https://platform.example.com.evil.example/x')).rejects.toThrow(/outside the Connect API/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
