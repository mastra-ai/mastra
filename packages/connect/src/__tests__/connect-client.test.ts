import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveClient } from '../client.js';
import { ConnectClient, DEFAULT_CONNECT_CLIENT_TIMEOUT_MS } from '../connect-client.js';
import { MastraConnectError } from '../errors.js';
import { ConnectClient as ExportedConnectClient } from '../index.js';
import { createPlatformProxy } from '../runtime/platform-proxy.js';

const TOKEN = 'fake-test-token';
const BASE = 'https://integrations.test';

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

interface Recorded {
  url: URL;
  method: string;
  headers: Headers;
  body: string | undefined;
  init: RequestInit | undefined;
}

/** Fake `fetch` at the network boundary that records every request. */
function recordingFetch(handler: (request: Recorded) => Response | Promise<Response>) {
  const calls: Recorded[] = [];
  const fetchMock: FetchMock = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
    const request: Recorded = {
      url: new URL(String(input)),
      method: init?.method ?? 'GET',
      headers: new Headers(init?.headers),
      body: typeof init?.body === 'string' ? init.body : undefined,
      init,
    };
    calls.push(request);
    return handler(request);
  });
  return { fetchMock, calls };
}

function makeClient(fetchMock: FetchMock, overrides: ConstructorParameters<typeof ConnectClient>[0] = {}) {
  return new ConnectClient({
    accessToken: TOKEN,
    baseUrl: BASE,
    projectId: 'proj_1',
    fetch: fetchMock as unknown as typeof fetch,
    ...overrides,
  });
}

function connection(id: string, integrationId: string, status = 'active') {
  return { id, integrationId, status, accountLabel: `${integrationId} account` };
}

function problem(status: number, type: string, detail: string, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ type, title: 'Problem', status, detail }), {
    status,
    headers: { 'content-type': 'application/problem+json', ...headers },
  });
}

async function caught(promise: Promise<unknown>): Promise<MastraConnectError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(MastraConnectError);
    return error as MastraConnectError;
  }
  throw new Error('expected the call to reject');
}

/** A fetch that never answers until its signal aborts. */
function hangingFetch() {
  return vi.fn<typeof fetch>().mockImplementation(
    (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) return;
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      }),
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('ConnectClient configuration', () => {
  it('is exported from the package entry point', () => {
    expect(ExportedConnectClient).toBe(ConnectClient);
  });

  it('resolves token, org, project and base URL from the environment', async () => {
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', 'env-token');
    vi.stubEnv('MASTRA_ORG_ID', 'org_env');
    vi.stubEnv('MASTRA_PROJECT_ID', 'proj_env');
    vi.stubEnv('MASTRA_INTEGRATIONS_API_URL', '');
    vi.stubEnv('MASTRA_PLATFORM_REGION', 'eu');
    const { fetchMock, calls } = recordingFetch(() => Response.json({ connections: [] }));

    const client = new ConnectClient({ fetch: fetchMock as unknown as typeof fetch });
    await client.listConnections();

    expect(client.projectId).toBe('proj_env');
    expect(calls[0]!.url.href).toBe('https://integrations.eu.mastra.ai/v2/projects/proj_env/connections');
    expect(calls[0]!.headers.get('authorization')).toBe('Bearer env-token');
    expect(calls[0]!.headers.get('x-organization-id')).toBe('org_env');
    expect(calls[0]!.headers.get('x-mastra-project-id')).toBe('proj_env');
    expect(calls[0]!.headers.get('x-mastra-resource-id')).toBeNull();
  });

  it('prefers explicit options over the environment', async () => {
    vi.stubEnv('MASTRA_ORG_ID', 'org_env');
    vi.stubEnv('MASTRA_PROJECT_ID', 'proj_env');
    const { fetchMock, calls } = recordingFetch(() => Response.json({ connections: [] }));

    await makeClient(fetchMock, { orgId: 'org_opt' }).listConnections();

    expect(calls[0]!.url.pathname).toBe('/v2/projects/proj_1/connections');
    expect(calls[0]!.headers.get('x-organization-id')).toBe('org_opt');
    expect(calls[0]!.headers.get('x-mastra-project-id')).toBe('proj_1');
  });

  it('strips a trailing /v1 from its base URL while resolveClient keeps it', async () => {
    const { fetchMock, calls } = recordingFetch(() => Response.json({ connections: [] }));
    const client = makeClient(fetchMock, { baseUrl: 'https://platform.mastra.ai/v1/' });

    await client.listConnections();

    expect(client.baseUrl).toBe('https://platform.mastra.ai');
    expect(calls[0]!.url.href).toBe('https://platform.mastra.ai/v2/projects/proj_1/connections');
    expect(resolveClient({ accessToken: TOKEN, baseUrl: 'https://platform.mastra.ai/v1/' }).baseUrl).toBe(
      'https://platform.mastra.ai/v1',
    );
  });

  it('rejects a non-positive timeout', () => {
    expect(() => new ConnectClient({ accessToken: TOKEN, timeoutMs: 0 })).toThrow(
      expect.objectContaining({ code: 'invalid_options' }),
    );
  });

  it('throws missing_project_id for project calls without a project', async () => {
    vi.stubEnv('MASTRA_PROJECT_ID', '');
    const { fetchMock } = recordingFetch(() => Response.json({ connections: [] }));
    const client = new ConnectClient({ accessToken: TOKEN, fetch: fetchMock as unknown as typeof fetch });

    expect((await caught(client.listConnections())).code).toBe('missing_project_id');
    expect((await caught(client.createConnectSession('jira'))).code).toBe('missing_project_id');
    expect((await caught(client.linkConnection('conn_1'))).code).toBe('missing_project_id');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('ConnectClient.listConnections', () => {
  it('filters the project listing by provider and never reads the org-wide listing', async () => {
    const { fetchMock, calls } = recordingFetch(() =>
      Response.json({
        connections: [connection('c_jira', 'jira'), connection('c_gitlab', 'gitlab'), connection('c_vanta', 'vanta')],
      }),
    );
    const client = makeClient(fetchMock);

    const filtered = await client.listConnections({ providerKeys: ['jira', 'vanta'] });
    const all = await client.listConnections();
    const otherProject = await client.listConnections({ projectId: 'proj_2', providerKeys: [] });

    expect(filtered.map(c => c.id)).toEqual(['c_jira', 'c_vanta']);
    expect(all).toHaveLength(3);
    expect(otherProject).toEqual([]);
    expect(calls.map(c => c.url.pathname)).toEqual([
      '/v2/projects/proj_1/connections',
      '/v2/projects/proj_1/connections',
      '/v2/projects/proj_2/connections',
    ]);
    expect(calls.some(c => c.url.pathname === '/v2/connections')).toBe(false);
    expect(calls.every(c => !c.url.searchParams.has('providerKey'))).toBe(true);
  });
});

describe('ConnectClient credentials and context', () => {
  it('parses an oauth2 credential and the connection context', async () => {
    const { fetchMock, calls } = recordingFetch(({ url }) => {
      if (url.pathname === '/v2/connections/c_1/credentials') {
        return Response.json({ type: 'oauth2', accessToken: 'provider-token', expiresAt: null });
      }
      return Response.json({ connection_config: { installation_id: '42' }, metadata: null });
    });
    const client = makeClient(fetchMock);

    await expect(client.getCredential('c_1')).resolves.toEqual({
      type: 'oauth2',
      accessToken: 'provider-token',
      expiresAt: null,
    });
    await expect(client.getContext('c_1')).resolves.toEqual({
      connection_config: { installation_id: '42' },
      metadata: null,
    });
    expect(calls.map(c => c.url.pathname)).toEqual(['/v2/connections/c_1/credentials', '/v2/connections/c_1/context']);
  });

  it('rejects an unknown credential type', async () => {
    const { fetchMock } = recordingFetch(() => Response.json({ type: 'mystery' }));
    const error = await caught(makeClient(fetchMock).getCredential('c_1'));
    expect(error.code).toBe('unsupported_credential_type');
  });
});

describe('ConnectClient.proxy', () => {
  it('passes method, path, query, headers and JSON body through the connection proxy', async () => {
    const { fetchMock, calls } = recordingFetch(() => Response.json({ data: { viewer: { id: 'u1' } } }));

    const result = await makeClient(fetchMock).proxy('c_lin', {
      method: 'POST',
      path: '/graphql',
      query: { first: 5, include: ['a', 'b'] },
      headers: { 'x-custom': 'yes', Authorization: 'Bearer stolen' },
      body: { query: '{ viewer { id } }' },
    });

    expect(result).toEqual({ data: { viewer: { id: 'u1' } } });
    const [call] = calls;
    expect(call!.method).toBe('POST');
    expect(call!.url.pathname).toBe('/v2/connections/c_lin/proxy/graphql');
    expect(call!.url.searchParams.get('first')).toBe('5');
    expect(call!.url.searchParams.getAll('include')).toEqual(['a', 'b']);
    expect(call!.headers.get('x-custom')).toBe('yes');
    expect(call!.headers.get('authorization')).toBe(`Bearer ${TOKEN}`);
    expect(call!.headers.get('content-type')).toBe('application/json');
    expect(JSON.parse(call!.body!)).toEqual({ query: '{ viewer { id } }' });
  });

  it('returns provider status and headers from proxyWithResponse', async () => {
    const { fetchMock } = recordingFetch(
      () => new Response(JSON.stringify({ ok: true }), { status: 201, headers: { 'x-request-id': 'r1' } }),
    );

    const response = await makeClient(fetchMock).proxyWithResponse('c_1', { method: 'POST', path: 'items' });

    expect(response.status).toBe(201);
    expect(response.data).toEqual({ ok: true });
    expect(response.headers['x-request-id']).toBe('r1');
  });

  it('tells a platform needs-reauth 409 apart from a provider 409', async () => {
    const platform = recordingFetch(() => problem(409, 'connection_needs_reauth', 'Connection needs re-authorization'));
    const provider = recordingFetch(() => Response.json({ message: 'Version conflict' }, { status: 409 }));

    const platformError = await caught(makeClient(platform.fetchMock).proxy('c_1', { method: 'GET', path: 'x' }));
    const providerError = await caught(makeClient(provider.fetchMock).proxy('c_1', { method: 'GET', path: 'x' }));

    expect(platformError).toMatchObject({
      code: 'proxy_error',
      status: 409,
      source: 'platform',
      problemCode: 'connection_needs_reauth',
    });
    expect(providerError).toMatchObject({ code: 'proxy_error', status: 409, source: 'provider' });
    expect(providerError.problemCode).toBeUndefined();
  });

  it('does not read a problem type from a provider body that is not problem+json', async () => {
    const { fetchMock } = recordingFetch(() =>
      Response.json({ type: 'connection_needs_reauth', message: 'spoof' }, { status: 409 }),
    );
    const error = await caught(makeClient(fetchMock).proxy('c_1', { method: 'GET', path: 'x' }));
    expect(error.source).toBe('provider');
    expect(error.problemCode).toBeUndefined();
  });
});

describe('ConnectClient platform errors', () => {
  it('marks errors from typed platform endpoints with their source and problem code', async () => {
    const { fetchMock } = recordingFetch(() => problem(409, 'connection_needs_reauth', 'Reconnect it'));
    const error = await caught(makeClient(fetchMock).getCredential('c_1'));
    expect(error).toMatchObject({
      code: 'platform_error',
      status: 409,
      source: 'platform',
      problemCode: 'connection_needs_reauth',
      detail: 'Reconnect it',
    });
  });

  it('parses Retry-After given in seconds', async () => {
    const { fetchMock } = recordingFetch(() => problem(429, 'rate_limited', 'Slow down', { 'retry-after': '7' }));
    const error = await caught(makeClient(fetchMock).listConnections());
    expect(error.retryAfterMs).toBe(7000);
  });

  it('parses Retry-After given as an HTTP date', async () => {
    const retryAt = new Date(Date.now() + 60_000).toUTCString();
    const { fetchMock } = recordingFetch(
      () => new Response('busy', { status: 503, headers: { 'retry-after': retryAt } }),
    );
    const error = await caught(makeClient(fetchMock).proxy('c_1', { method: 'GET', path: 'x' }));
    expect(error.source).toBe('provider');
    // HTTP dates have one-second resolution.
    expect(error.retryAfterMs).toBeGreaterThan(55_000);
    expect(error.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  it('ignores Retry-After on other statuses', async () => {
    const { fetchMock } = recordingFetch(() => problem(400, 'bad_request', 'No', { 'retry-after': '7' }));
    const error = await caught(makeClient(fetchMock).listConnections());
    expect(error.retryAfterMs).toBeUndefined();
  });

  it('ignores a Retry-After that is neither whole seconds nor an HTTP date', async () => {
    const { fetchMock } = recordingFetch(() => problem(429, 'rate_limited', 'Slow down', { 'retry-after': '1.5' }));
    const error = await caught(makeClient(fetchMock).listConnections());
    expect(error.retryAfterMs).toBeUndefined();
  });

  it('marks 404s and unexpected shapes from typed endpoints as platform errors with a status', async () => {
    const { fetchMock } = recordingFetch(({ url }) =>
      url.pathname.endsWith('/connect-url') ? new Response(null, { status: 404 }) : Response.json({ unexpected: true }),
    );
    const client = makeClient(fetchMock);

    expect(await caught(client.getConnectUrl('c_1'))).toMatchObject({
      code: 'connection_not_found',
      status: 404,
      source: 'platform',
    });
    expect(await caught(client.getContext('c_1'))).toMatchObject({
      code: 'platform_error',
      status: 200,
      source: 'platform',
    });
  });
});

describe('ConnectClient timeouts', () => {
  it('defaults to a 15 second timeout', () => {
    expect(DEFAULT_CONNECT_CLIENT_TIMEOUT_MS).toBe(15_000);
  });

  it('times out typed calls, proxy calls, request and fetchRaw', async () => {
    const client = makeClient(hangingFetch(), { timeoutMs: 20 });

    for (const call of [
      () => client.listConnections(),
      () => client.proxy('c_1', { method: 'GET', path: 'slow' }),
      () => client.request('GET', '/v1/server/slow'),
      () => client.fetchRaw('GET', '/v1/server/slow'),
    ]) {
      const error = await caught(call());
      expect(error.code).toBe('timeout');
      expect(error.message).toContain('timed out after 20ms');
    }
  });

  it('times out when the headers arrive but the body stalls', async () => {
    const stalledBody = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
      const signal = init!.signal!;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"connections":['));
          signal.addEventListener('abort', () => controller.error(signal.reason), { once: true });
        },
      });
      return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const client = makeClient(stalledBody, { timeoutMs: 20 });

    for (const call of [
      () => client.listConnections(),
      () => client.proxy('c_1', { method: 'GET', path: 'slow' }),
      () => client.request('GET', '/v1/server/slow'),
      () => client.fetchRaw('GET', '/v1/server/slow'),
    ]) {
      const error = await caught(call());
      expect(error.code).toBe('timeout');
    }
  });

  it('honours a caller signal alongside the timeout', async () => {
    const controller = new AbortController();
    const client = makeClient(hangingFetch(), { timeoutMs: 10_000 });
    const pending = client.request('GET', '/v1/server/slow', { signal: controller.signal });
    controller.abort(new Error('caller gave up'));
    await expect(pending).rejects.toThrow('caller gave up');
  });

  it('never applies a timeout to the platform proxy generated tools call', async () => {
    let signal: AbortSignal | null | undefined = null;
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
      signal = init?.signal;
      await new Promise(resolve => setTimeout(resolve, 50));
      return Response.json({ exported: true });
    });
    const proxy = createPlatformProxy({
      connectionId: 'c_1',
      client: { accessToken: TOKEN, baseUrl: BASE, fetch: fetchMock },
    });

    const response = await proxy.get({ endpoint: '/exports/big' });

    expect(response.data).toEqual({ exported: true });
    expect(signal).toBeUndefined();
    expect(resolveClient({ accessToken: TOKEN }).timeoutMs).toBeUndefined();
  });
});

describe('ConnectClient.request', () => {
  it('sends JSON and per-call headers without leaking them into later calls', async () => {
    const { fetchMock, calls } = recordingFetch(({ url }) =>
      url.pathname.endsWith('/empty') ? new Response(null, { status: 204 }) : Response.json({ ok: 1 }),
    );
    const client = makeClient(fetchMock);

    const first = await client.request<{ ok: number }>('POST', '/v1/server/github/issues?state=open', {
      body: { title: 'Bug' },
      headers: { 'X-Acting-User-Id': 'user_9', authorization: 'Bearer nope' },
      query: { page: '2', skip: undefined },
    });
    const second = await client.request('GET', '/v1/server/github/empty');

    expect(first).toEqual({ ok: 1 });
    expect(second).toBeUndefined();
    expect(calls[0]!.method).toBe('POST');
    expect(calls[0]!.url.pathname).toBe('/v1/server/github/issues');
    expect(Object.fromEntries(calls[0]!.url.searchParams)).toEqual({ state: 'open', page: '2' });
    expect(calls[0]!.headers.get('x-acting-user-id')).toBe('user_9');
    expect(calls[0]!.headers.get('authorization')).toBe(`Bearer ${TOKEN}`);
    expect(calls[0]!.headers.get('content-type')).toBe('application/json');
    expect(JSON.parse(calls[0]!.body!)).toEqual({ title: 'Bug' });
    expect(calls[1]!.headers.get('x-acting-user-id')).toBeNull();
    expect(calls[1]!.headers.get('content-type')).toBeNull();
    expect(calls[1]!.body).toBeUndefined();
  });

  it('ignores per-call headers that would change the client identity', async () => {
    const { fetchMock, calls } = recordingFetch(() => Response.json({}));
    await makeClient(fetchMock).request('GET', '/v1/server/x', {
      headers: {
        'X-Mastra-Project-Id': 'proj_other',
        'x-organization-id': 'org_other',
        'x-mastra-resource-id': 'user_other',
      },
    });
    expect(calls[0]!.headers.get('x-mastra-project-id')).toBe('proj_1');
    expect(calls[0]!.headers.get('x-organization-id')).not.toBe('org_other');
    expect(calls[0]!.headers.get('x-mastra-resource-id')).toBeNull();
  });

  it('maps errors with status, source and problem code', async () => {
    const { fetchMock } = recordingFetch(() => problem(409, 'linear_workspace_migrated', 'Migrated'));
    const error = await caught(makeClient(fetchMock).request('GET', '/v1/server/linear/workspaces'));
    expect(error).toMatchObject({ status: 409, source: 'platform', problemCode: 'linear_workspace_migrated' });
  });

  it('rejects relative, protocol-relative and dot-segment paths before sending', async () => {
    const { fetchMock } = recordingFetch(() => Response.json({}));
    const client = makeClient(fetchMock);
    for (const path of ['v2/x', '//evil.test/x', '/v2/../admin', '/v2/%2e%2e/admin']) {
      expect((await caught(client.request('GET', path))).code).toBe('invalid_options');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('ConnectClient.fetchRaw', () => {
  it('returns the redirect response without following it', async () => {
    const { fetchMock, calls } = recordingFetch(
      () => new Response(null, { status: 302, headers: { location: 'https://github.com/login/oauth' } }),
    );

    const response = await makeClient(fetchMock).fetchRaw('GET', '/v1/server/github-app/authorize');

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://github.com/login/oauth');
    expect(calls[0]!.init?.redirect).toBe('manual');
  });
});

describe('ConnectClient sessions and links', () => {
  const SESSION = {
    connectionId: 'c_new',
    integrationId: 'jira',
    connectUrl: 'https://connect.nango.dev/x',
    sessionToken: 'st',
    expiresAt: '2026-11-13T12:00:00.000Z',
  };

  it('creates project connect sessions, reconnect sessions and project links', async () => {
    const { fetchMock, calls } = recordingFetch(({ url }) =>
      url.pathname.startsWith('/v2/projects/proj_1/connections/')
        ? new Response(null, { status: 204 })
        : Response.json(SESSION, { status: 201 }),
    );
    const client = makeClient(fetchMock);

    await expect(client.createConnectSession('jira')).resolves.toEqual(SESSION);
    await expect(client.createReconnectSession('c_new')).resolves.toEqual(SESSION);
    await expect(client.linkConnection('c_old')).resolves.toBeUndefined();

    expect(calls.map(c => `${c.method} ${c.url.pathname}`)).toEqual([
      'POST /v2/projects/proj_1/integrations/jira/connect-sessions',
      'POST /v2/connections/c_new/reconnect-session',
      'POST /v2/projects/proj_1/connections/c_old',
    ]);
  });

  it('disconnects a connection', async () => {
    const { fetchMock, calls } = recordingFetch(() => new Response(null, { status: 204 }));
    await makeClient(fetchMock).disconnect('c_1');
    expect(`${calls[0]!.method} ${calls[0]!.url.pathname}`).toBe('DELETE /v2/connections/c_1');
  });
});

describe('ConnectClient.withResource', () => {
  it('returns a resource-scoped client and leaves the original unscoped', async () => {
    const { fetchMock, calls } = recordingFetch(() => Response.json({ connections: [] }));
    const client = makeClient(fetchMock);

    const scoped = client.withResource('  user_42  ');
    await scoped.listConnections();
    await client.listConnections();

    expect(scoped.resourceId).toBe('user_42');
    expect(client.resourceId).toBeUndefined();
    expect(calls[0]!.headers.get('x-mastra-resource-id')).toBe('user_42');
    expect(calls[0]!.url.searchParams.get('resourceId')).toBe('user_42');
    expect(calls[1]!.headers.get('x-mastra-resource-id')).toBeNull();
  });

  it('validates the resource key', () => {
    const { fetchMock } = recordingFetch(() => Response.json({}));
    expect(() => makeClient(fetchMock).withResource('   ')).toThrow(
      expect.objectContaining({ code: 'invalid_options' }),
    );
  });
});

describe('ConnectClient token redaction', () => {
  it('redacts the access token from transport errors', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new Error(`connect ECONNREFUSED Bearer ${TOKEN}`));
    const client = makeClient(fetchMock);

    for (const call of [() => client.listConnections(), () => client.request('GET', '/v1/server/x')]) {
      const error = (await call().catch((e: unknown) => e)) as Error;
      expect(error.message).not.toContain(TOKEN);
      expect(error.message).toContain('[REDACTED]');
    }
  });
});
