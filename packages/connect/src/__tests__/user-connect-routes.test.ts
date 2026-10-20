import { MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RESOURCE_ID_HEADER } from '../client.js';
import { userConnectRoutes, validateReturnTo } from '../user-connect-routes.js';
import type { UserConnectRoutesOptions } from '../user-connect-routes.js';

const TOKEN = 'fake-test-token';

interface SeenRequest {
  url: URL;
  method: string;
  headers: Headers;
  body: unknown;
}

function makeConnection(overrides?: Record<string, unknown>) {
  return {
    id: 'c_lin1',
    integrationId: 'linear',
    status: 'active',
    connectedByUserId: 'user_1',
    connectedAt: '2026-09-01T00:00:00Z',
    createdAt: '2026-09-01T00:00:00Z',
    accountLabel: 'Acme',
    resourceId: null,
    ...overrides,
  };
}

/**
 * Platform fixture mirroring the real scoping contract: no params →
 * global-only; `resourceId=X&includeGlobal=true` → global + that resource's
 * rows. Serves the catalog, session creation, and connection deletion.
 */
function fakePlatform(options?: {
  connections?: Array<Record<string, unknown>>;
  integrations?: Array<Record<string, unknown>>;
  endUserProviders?: string[] | null;
  gateConnectUrl?: string;
}) {
  const connections = options?.connections ?? [makeConnection()];
  const integrations = options?.integrations ?? [
    {
      id: 'linear',
      capabilities: { mcp: true },
      displayName: 'Linear',
      logoUrl: 'https://logos.test/linear.png',
      authType: 'OAUTH2',
      // Includes `target` so tests cover the headless credentials/params
      // split surviving the catalog schema parse.
      authFields: [{ name: 'workspace', target: 'params', label: 'Workspace', required: true }],
    },
    { id: 'slack', capabilities: { mcp: false }, displayName: 'Slack', logoUrl: null, authType: 'OAUTH2' },
    { id: 'github', capabilities: { mcp: true }, displayName: 'GitHub', logoUrl: null, authType: 'OAUTH2' },
  ];
  const requests: SeenRequest[] = [];
  const fetchMock = vi.fn().mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    requests.push({
      url,
      method,
      headers: new Headers(init?.headers),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    if (url.pathname === '/v2/integrations') return Response.json({ integrations });
    if (url.pathname === '/v2/projects/proj_1/integration-settings') {
      return Response.json({ endUserProviders: options?.endUserProviders ?? null });
    }
    if (url.pathname.endsWith('/connections') && method === 'GET') {
      const resourceId = url.searchParams.get('resourceId');
      const rows = connections.filter(connection =>
        resourceId === null
          ? connection.resourceId === null
          : connection.resourceId === null || connection.resourceId === resourceId,
      );
      return Response.json({ connections: rows });
    }
    if (url.pathname.includes('/connect-sessions') && method === 'POST') {
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
      return Response.json({
        connectionId: 'c_new1',
        integrationId: url.pathname.split('/integrations/')[1]!.split('/')[0]!,
        // The platform nulls both launch capabilities (vendor link + session
        // token) for resource-scoped sessions: the launch gate is the only
        // reader.
        connectUrl: body.resourceId ? null : 'https://connect.test/session',
        sessionToken: body.resourceId ? null : 'sess_tok',
        expiresAt: '2026-10-13T15:00:00Z',
      });
    }
    if (url.pathname.endsWith('/connect-url') && method === 'GET') {
      // Launch gate: the platform serves the stored vendor link only when the
      // caller's resource assertion matches the pending row; everything else
      // is an indistinguishable 404.
      const connectionId = url.pathname.split('/connections/')[1]!.split('/')[0]!;
      const asserted = new Headers(init?.headers).get('x-mastra-resource-id');
      const row = connections.find(connection => connection.id === connectionId);
      if (!row || row.resourceId === null || asserted !== row.resourceId) {
        return Response.json({ error: 'not found' }, { status: 404 });
      }
      return Response.json({
        // Mirrors the real Nango format: the hosted-page URL carries the
        // session token as its only secret.
        connectUrl: options?.gateConnectUrl ?? 'https://connect.nango.dev/?session_token=nango_connect_session_t1',
        expiresAt: '2026-10-13T15:00:00Z',
      });
    }
    if (method === 'DELETE') return new Response(null, { status: 204 });
    return Response.json({ error: 'unexpected route' }, { status: 500 });
  });
  return { fetchMock, requests };
}

function routeOptions(
  fetchMock: typeof fetch,
  overrides?: Partial<UserConnectRoutesOptions>,
): UserConnectRoutesOptions {
  return {
    providers: ['linear', 'slack'],
    projectId: 'proj_1',
    client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock },
    ...overrides,
  };
}

/** Minimal Hono-shaped context covering what the handlers use. */
function makeCtx(options?: {
  resourceId?: string;
  params?: Record<string, string>;
  query?: Record<string, string>;
  requestHeaders?: Record<string, string>;
  user?: unknown;
}) {
  const store = new Map<string, unknown>();
  if (options?.resourceId !== undefined) store.set(MASTRA_RESOURCE_ID_KEY, options.resourceId);
  if (options?.user !== undefined) store.set('user', options.user);
  const requestContext = { get: (key: string) => store.get(key) };
  const headers: Record<string, string> = {};
  return {
    req: {
      param: (name: string) => options?.params?.[name],
      query: (name: string) => options?.query?.[name],
      header: (name: string) => options?.requestHeaders?.[name.toLowerCase()],
    },
    get: (key: string) => (key === 'requestContext' ? requestContext : undefined),
    header: (name: string, value: string) => {
      headers[name.toLowerCase()] = value;
    },
    json: (obj: unknown, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', ...headers } }),
    html: (content: string, status = 200) =>
      new Response(content, { status, headers: { 'content-type': 'text/html; charset=UTF-8', ...headers } }),
    body: (data: string | null, status = 200) => new Response(data, { status, headers }),
    redirect: (location: string, status = 302) => new Response(null, { status, headers: { location, ...headers } }),
  };
}

function findRoute(routes: ReturnType<typeof userConnectRoutes>, method: string, path: string) {
  const route = routes.find(candidate => candidate.method === method && candidate.path === path);
  if (!route || !('handler' in route)) throw new Error(`route not found: ${method} ${path}`);
  return route;
}

async function json(response: Response): Promise<any> {
  return await response.json();
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe('userConnectRoutes construction', () => {
  it('rejects an explicit empty allowlist but accepts omitting providers entirely', () => {
    expect(() => userConnectRoutes({ providers: [], projectId: 'proj_1' })).toThrow(/non-empty allowlist/);
    // Omitted providers = the full platform catalog is connectable.
    expect(userConnectRoutes({ projectId: 'proj_1' }).length).toBeGreaterThan(0);
  });

  it('rejects reserved provider ids that collide with static route segments', () => {
    expect(() => userConnectRoutes({ providers: ['connections'], projectId: 'proj_1' })).toThrow(/reserved/);
    expect(() => userConnectRoutes({ providers: ['a/b'], projectId: 'proj_1' })).toThrow(/reserved/);
  });

  it('requires a project id', () => {
    const previous = process.env.MASTRA_PROJECT_ID;
    delete process.env.MASTRA_PROJECT_ID;
    try {
      expect(() => userConnectRoutes({ providers: ['linear'] })).toThrow(/project id/);
    } finally {
      if (previous !== undefined) process.env.MASTRA_PROJECT_ID = previous;
    }
  });

  it('rejects client.resourceId — scoping is per request', () => {
    expect(() =>
      userConnectRoutes({ providers: ['linear'], projectId: 'proj_1', client: { resourceId: 'end-user-1' } }),
    ).toThrow(/per request/);
  });

  it('rejects an invalid basePath', () => {
    expect(() => userConnectRoutes({ providers: ['linear'], projectId: 'proj_1', basePath: 'connect' })).toThrow(
      /basePath/,
    );
    expect(() => userConnectRoutes({ providers: ['linear'], projectId: 'proj_1', basePath: '/connect/' })).toThrow(
      /basePath/,
    );
  });

  it('mounts every route under the base path with auth required, static paths first', () => {
    const { fetchMock } = fakePlatform();
    const routes = userConnectRoutes(routeOptions(fetchMock as unknown as typeof fetch, { basePath: '/end-user' }));
    expect(routes.map(route => `${route.method} ${route.path}`)).toEqual([
      'GET /end-user/providers',
      'GET /end-user/connections',
      'GET /end-user/connections/:id/status',
      'DELETE /end-user/connections/:id',
      'GET /end-user/connections/:id/launch',
      'POST /end-user/:provider/sessions',
      'GET /end-user/:provider',
    ]);
    expect(routes.every(route => route.requiresAuth === true)).toBe(true);
  });
});

describe('identity gate', () => {
  it('rejects a request with no resolvable resource key with 401 on every route', async () => {
    const { fetchMock } = fakePlatform();
    const routes = userConnectRoutes(routeOptions(fetchMock as unknown as typeof fetch));
    for (const route of routes) {
      const handler = (route as { handler: (c: unknown) => Promise<Response> }).handler;
      const response = await handler(makeCtx({ params: { provider: 'linear', id: 'c_lin1' } }));
      expect(response.status).toBe(401);
      expect(response.headers.get('cache-control')).toBe('no-store, private');
      expect((await json(response)).error.code).toBe('unauthorized');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects when the resourceId callback returns undefined or throws, without leaking the error', async () => {
    const { fetchMock } = fakePlatform();
    const throwing = userConnectRoutes(
      routeOptions(fetchMock as unknown as typeof fetch, {
        resourceId: () => {
          throw new Error('secret internals');
        },
      }),
    );
    const response = await (findRoute(throwing, 'GET', '/connect/connections') as any).handler(makeCtx());
    expect(response.status).toBe(401);
    expect(JSON.stringify(await json(response))).not.toContain('secret internals');

    const empty = userConnectRoutes(
      routeOptions(fetchMock as unknown as typeof fetch, { resourceId: () => undefined }),
    );
    const emptyResponse = await (findRoute(empty, 'GET', '/connect/connections') as any).handler(
      makeCtx({ resourceId: 'ignored-fallback' }),
    );
    expect(emptyResponse.status).toBe(401);
  });

  it('derives the key from the resourceId callback, exposing the authenticated user', async () => {
    const { fetchMock, requests } = fakePlatform();
    const routes = userConnectRoutes(
      routeOptions(fetchMock as unknown as typeof fetch, {
        resourceId: ctx => (ctx.user as { id: string }).id,
      }),
    );
    const response = await (findRoute(routes, 'GET', '/connect/connections') as any).handler(
      makeCtx({ user: { id: 'end-user-7' } }),
    );
    expect(response.status).toBe(200);
    expect(requests[0]!.headers.get(RESOURCE_ID_HEADER)).toBe('end-user-7');
  });

  it('falls back to the server-derived MASTRA_RESOURCE_ID_KEY', async () => {
    const { fetchMock, requests } = fakePlatform();
    const routes = userConnectRoutes(routeOptions(fetchMock as unknown as typeof fetch));
    const response = await (findRoute(routes, 'GET', '/connect/connections') as any).handler(
      makeCtx({ resourceId: 'end-user-42' }),
    );
    expect(response.status).toBe(200);
    expect(requests[0]!.headers.get(RESOURCE_ID_HEADER)).toBe('end-user-42');
    expect(requests[0]!.url.searchParams.get('resourceId')).toBe('end-user-42');
    expect(requests[0]!.url.searchParams.get('includeGlobal')).toBe('true');
  });
});

describe('GET /providers', () => {
  it('returns the catalog filtered to the allowlist, in allowlist order', async () => {
    const { fetchMock } = fakePlatform();
    const routes = userConnectRoutes(
      routeOptions(fetchMock as unknown as typeof fetch, { providers: ['slack', 'linear'] }),
    );
    const response = await (findRoute(routes, 'GET', '/connect/providers') as any).handler(
      makeCtx({ resourceId: 'end-user-42' }),
    );
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body.providers.map((provider: { id: string }) => provider.id)).toEqual(['slack', 'linear']);
    expect(body.providers[1]).toEqual({
      id: 'linear',
      displayName: 'Linear',
      logoUrl: 'https://logos.test/linear.png',
      authType: 'OAUTH2',
      // `target` survives the parse — headless auth needs it to route the
      // value as a flow param instead of a credential.
      authFields: [{ name: 'workspace', target: 'params', label: 'Workspace', required: true }],
    });
  });

  it('inherits the full catalog when project configuration is null', async () => {
    const { fetchMock, requests } = fakePlatform();
    const routes = userConnectRoutes(routeOptions(fetchMock as unknown as typeof fetch, { providers: undefined }));
    const response = await (findRoute(routes, 'GET', '/connect/providers') as any).handler(
      makeCtx({ resourceId: 'end-user-42' }),
    );
    const body = await json(response);
    expect(body.providers.map((provider: { id: string }) => provider.id)).toEqual(['linear', 'slack', 'github']);
    expect(requests.some(request => request.url.pathname.endsWith('/integration-settings'))).toBe(true);
  });

  it('uses project provider configuration when code omits providers', async () => {
    const { fetchMock } = fakePlatform({ endUserProviders: ['github', 'linear'] });
    const routes = userConnectRoutes(routeOptions(fetchMock as unknown as typeof fetch, { providers: undefined }));
    const response = await (findRoute(routes, 'GET', '/connect/providers') as any).handler(
      makeCtx({ resourceId: 'end-user-42' }),
    );
    const body = await json(response);
    expect(body.providers.map((provider: { id: string }) => provider.id)).toEqual(['github', 'linear']);
  });

  it('lets the code allowlist override project provider configuration without fetching it', async () => {
    const { fetchMock, requests } = fakePlatform({ endUserProviders: ['github'] });
    const routes = userConnectRoutes(
      routeOptions(fetchMock as unknown as typeof fetch, { providers: ['slack', 'linear'] }),
    );
    const response = await (findRoute(routes, 'GET', '/connect/providers') as any).handler(
      makeCtx({ resourceId: 'end-user-42' }),
    );
    const body = await json(response);
    expect(body.providers.map((provider: { id: string }) => provider.id)).toEqual(['slack', 'linear']);
    expect(requests.some(request => request.url.pathname.endsWith('/integration-settings'))).toBe(false);
  });
});

describe('GET /connections', () => {
  it('marks scope and lists existing connections regardless of the allowlist', async () => {
    // The provider policy gates what end users can newly connect, not what
    // already exists: agents keep resolving tools from existing connections,
    // and a user must be able to see (and disconnect) their own rows even
    // after an admin narrows the allowlist. 'github' is outside the test
    // allowlist but its rows stay visible.
    const { fetchMock } = fakePlatform({
      connections: [
        makeConnection(),
        makeConnection({ id: 'c_lin2', resourceId: 'end-user-42', accountLabel: null }),
        makeConnection({ id: 'c_gh1', integrationId: 'github' }),
      ],
    });
    const routes = userConnectRoutes(routeOptions(fetchMock as unknown as typeof fetch));
    const response = await (findRoute(routes, 'GET', '/connect/connections') as any).handler(
      makeCtx({ resourceId: 'end-user-42' }),
    );
    const body = await json(response);
    // Rows carry display metadata from the full catalog (not the policy-
    // filtered provider list) so clients can render de-allowlisted providers:
    // 'github' is outside the allowlist yet still gets its name resolved.
    expect(body.connections).toEqual([
      {
        id: 'c_lin1',
        integrationId: 'linear',
        displayName: 'Linear',
        logoUrl: 'https://logos.test/linear.png',
        status: 'active',
        accountLabel: 'Acme',
        scope: 'global',
      },
      {
        id: 'c_lin2',
        integrationId: 'linear',
        displayName: 'Linear',
        logoUrl: 'https://logos.test/linear.png',
        status: 'active',
        accountLabel: null,
        scope: 'user',
      },
      {
        id: 'c_gh1',
        integrationId: 'github',
        displayName: 'GitHub',
        logoUrl: null,
        status: 'active',
        accountLabel: 'Acme',
        scope: 'global',
      },
    ]);
  });

  it('still lists connections when the catalog lookup fails', async () => {
    // Display metadata is best-effort decoration: a catalog outage must not
    // take down the listing (or status polling / disconnects behind it).
    const { fetchMock } = fakePlatform();
    const failingFetch = vi.fn().mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === '/v2/integrations') return Response.json({ error: 'boom' }, { status: 500 });
      return fetchMock(input, init);
    });
    const routes = userConnectRoutes(routeOptions(failingFetch as unknown as typeof fetch));
    const response = await (findRoute(routes, 'GET', '/connect/connections') as any).handler(
      makeCtx({ resourceId: 'end-user-42' }),
    );
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body.connections).toEqual([
      {
        id: 'c_lin1',
        integrationId: 'linear',
        displayName: null,
        logoUrl: null,
        status: 'active',
        accountLabel: 'Acme',
        scope: 'global',
      },
    ]);
  });
});

describe('POST /:provider/sessions', () => {
  it('creates a resource-scoped session for an allowlisted provider', async () => {
    const { fetchMock, requests } = fakePlatform();
    const routes = userConnectRoutes(routeOptions(fetchMock as unknown as typeof fetch));
    const response = await (findRoute(routes, 'POST', '/connect/:provider/sessions') as any).handler(
      makeCtx({ resourceId: 'end-user-42', params: { provider: 'linear' } }),
    );
    expect(response.status).toBe(201);
    expect(await json(response)).toEqual({
      connectionId: 'c_new1',
      integrationId: 'linear',
      // The browser gets the launch-gate path only — never a launch
      // capability (vendor connect URL or session token).
      launchUrl: '/connect/connections/c_new1/launch',
      expiresAt: '2026-10-13T15:00:00Z',
    });
    const sessionRequest = requests.find(request => request.url.pathname.includes('/connect-sessions'))!;
    expect(sessionRequest.body).toEqual({ resourceId: 'end-user-42' });
    expect(sessionRequest.headers.get(RESOURCE_ID_HEADER)).toBe('end-user-42');
  });

  it('404s for providers outside the allowlist without touching the platform', async () => {
    const { fetchMock } = fakePlatform();
    const routes = userConnectRoutes(routeOptions(fetchMock as unknown as typeof fetch));
    const response = await (findRoute(routes, 'POST', '/connect/:provider/sessions') as any).handler(
      makeCtx({ resourceId: 'end-user-42', params: { provider: 'github' } }),
    );
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('with inherited project configuration, accepts any catalog provider and 404s unknown ids', async () => {
    const { fetchMock } = fakePlatform();
    const routes = userConnectRoutes(routeOptions(fetchMock as unknown as typeof fetch, { providers: undefined }));
    const handler = (findRoute(routes, 'POST', '/connect/:provider/sessions') as any).handler;

    // github is outside the default test allowlist but in the catalog.
    const created = await handler(makeCtx({ resourceId: 'end-user-42', params: { provider: 'github' } }));
    expect(created.status).toBe(201);
    expect((await json(created)).integrationId).toBe('github');

    const unknown = await handler(makeCtx({ resourceId: 'end-user-42', params: { provider: 'nope' } }));
    expect(unknown.status).toBe(404);
  });

  it('treats an empty project provider list as disabling new end-user connections', async () => {
    const { fetchMock, requests } = fakePlatform({ endUserProviders: [] });
    const routes = userConnectRoutes(routeOptions(fetchMock as unknown as typeof fetch, { providers: undefined }));
    const response = await (findRoute(routes, 'POST', '/connect/:provider/sessions') as any).handler(
      makeCtx({ resourceId: 'end-user-42', params: { provider: 'linear' } }),
    );
    expect(response.status).toBe(404);
    expect(requests.some(request => request.url.pathname.includes('/connect-sessions'))).toBe(false);
  });
});

describe('GET /connections/:id/launch', () => {
  it('redirects the owner into the vendor OAuth flow with the resource assertion', async () => {
    const { fetchMock, requests } = fakePlatform({
      connections: [makeConnection({ id: 'c_own', resourceId: 'end-user-42', status: 'pending' })],
    });
    const routes = userConnectRoutes(routeOptions(fetchMock as unknown as typeof fetch));
    const response = await (findRoute(routes, 'GET', '/connect/connections/:id/launch') as any).handler(
      makeCtx({ resourceId: 'end-user-42', params: { id: 'c_own' } }),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://connect.nango.dev/?session_token=nango_connect_session_t1');
    expect(response.headers.get('cache-control')).toBe('no-store');
    const gateRequest = requests.find(request => request.url.pathname.endsWith('/connect-url'))!;
    expect(gateRequest.url.pathname).toBe('/v2/connections/c_own/connect-url');
    expect(gateRequest.headers.get(RESOURCE_ID_HEADER)).toBe('end-user-42');
  });

  it('releases the session token to the owner when redeemed as JSON', async () => {
    // Headless redemption: the same gate (same identity + ownership checks)
    // hands the proven owner's fetch the session token instead of 302ing the
    // popup into Nango's hosted page. The token and the hosted URL are the
    // same capability — the URL is just the token in query-param clothing —
    // so releasing it here does not widen the gate's blast radius.
    const { fetchMock, requests } = fakePlatform({
      connections: [makeConnection({ id: 'c_own', resourceId: 'end-user-42', status: 'pending' })],
    });
    const routes = userConnectRoutes(routeOptions(fetchMock as unknown as typeof fetch));
    const response = await (findRoute(routes, 'GET', '/connect/connections/:id/launch') as any).handler(
      makeCtx({
        resourceId: 'end-user-42',
        params: { id: 'c_own' },
        requestHeaders: { accept: 'application/json' },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await json(response)).toEqual({
      sessionToken: 'nango_connect_session_t1',
      expiresAt: '2026-10-13T15:00:00Z',
    });
    const gateRequest = requests.find(request => request.url.pathname.endsWith('/connect-url'))!;
    expect(gateRequest.headers.get(RESOURCE_ID_HEADER)).toBe('end-user-42');
  });

  it('returns a null token on JSON redemption when the vendor URL format changes', async () => {
    // Fail safe, not open: if the token cannot be extracted, the client falls
    // back to the hosted popup through the 302 flow. The vendor URL itself is
    // never surfaced in the JSON body.
    const { fetchMock } = fakePlatform({
      connections: [makeConnection({ id: 'c_own', resourceId: 'end-user-42', status: 'pending' })],
      gateConnectUrl: 'https://connect.nango.dev/some/other/shape',
    });
    const routes = userConnectRoutes(routeOptions(fetchMock as unknown as typeof fetch));
    const response = await (findRoute(routes, 'GET', '/connect/connections/:id/launch') as any).handler(
      makeCtx({
        resourceId: 'end-user-42',
        params: { id: 'c_own' },
        requestHeaders: { accept: 'application/json' },
      }),
    );
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body.sessionToken).toBeNull();
    expect(JSON.stringify(body)).not.toContain('connect.nango.dev');
  });

  it('keeps 404 parity on JSON redemption for a session owned by another resource', async () => {
    const { fetchMock } = fakePlatform({
      connections: [makeConnection({ id: 'c_other', resourceId: 'end-user-other', status: 'pending' })],
    });
    const routes = userConnectRoutes(routeOptions(fetchMock as unknown as typeof fetch));
    const response = await (findRoute(routes, 'GET', '/connect/connections/:id/launch') as any).handler(
      makeCtx({
        resourceId: 'end-user-42',
        params: { id: 'c_other' },
        requestHeaders: { accept: 'application/json' },
      }),
    );
    expect(response.status).toBe(404);
    expect((await json(response)).error.code).toBe('connection_not_found');
  });

  it('404s for a session owned by another resource — a leaked launch URL is useless', async () => {
    const { fetchMock } = fakePlatform({
      connections: [makeConnection({ id: 'c_other', resourceId: 'end-user-other', status: 'pending' })],
    });
    const routes = userConnectRoutes(routeOptions(fetchMock as unknown as typeof fetch));
    const response = await (findRoute(routes, 'GET', '/connect/connections/:id/launch') as any).handler(
      makeCtx({ resourceId: 'end-user-42', params: { id: 'c_other' } }),
    );
    expect(response.status).toBe(404);
    expect((await json(response)).error.code).toBe('connection_not_found');
  });

  it('401s without an authenticated identity', async () => {
    const { fetchMock } = fakePlatform();
    const routes = userConnectRoutes(routeOptions(fetchMock as unknown as typeof fetch));
    const response = await (findRoute(routes, 'GET', '/connect/connections/:id/launch') as any).handler(
      makeCtx({ params: { id: 'c_own' } }),
    );
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('GET /connections/:id/status', () => {
  it('returns the status of a visible connection and 404s for invisible ones identically', async () => {
    const { fetchMock } = fakePlatform({
      connections: [
        makeConnection({ id: 'c_own', resourceId: 'end-user-42', status: 'pending' }),
        makeConnection({ id: 'c_other', resourceId: 'end-user-other' }),
      ],
    });
    const routes = userConnectRoutes(routeOptions(fetchMock as unknown as typeof fetch));
    const handler = (findRoute(routes, 'GET', '/connect/connections/:id/status') as any).handler;

    const own = await handler(makeCtx({ resourceId: 'end-user-42', params: { id: 'c_own' } }));
    expect(await json(own)).toEqual({ id: 'c_own', status: 'pending', scope: 'user' });

    const other = await handler(makeCtx({ resourceId: 'end-user-42', params: { id: 'c_other' } }));
    const missing = await handler(makeCtx({ resourceId: 'end-user-42', params: { id: 'c_nope' } }));
    expect(other.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await json(other)).toEqual(await json(missing));
  });
});

describe('DELETE /connections/:id', () => {
  it('disconnects the caller’s own connection', async () => {
    const { fetchMock, requests } = fakePlatform({
      connections: [makeConnection({ id: 'c_own', resourceId: 'end-user-42' })],
    });
    const routes = userConnectRoutes(routeOptions(fetchMock as unknown as typeof fetch));
    const response = await (findRoute(routes, 'DELETE', '/connect/connections/:id') as any).handler(
      makeCtx({ resourceId: 'end-user-42', params: { id: 'c_own' } }),
    );
    expect(response.status).toBe(204);
    const deletion = requests.find(request => request.method === 'DELETE')!;
    expect(deletion.url.pathname).toBe('/v2/connections/c_own');
    expect(deletion.headers.get(RESOURCE_ID_HEADER)).toBe('end-user-42');
  });

  it('disconnects an own connection whose provider left the allowlist', async () => {
    // Narrowing the allowlist must not orphan existing connections: the user
    // can no longer add github accounts, but can still disconnect this one.
    const { fetchMock, requests } = fakePlatform({
      connections: [makeConnection({ id: 'c_gh_own', integrationId: 'github', resourceId: 'end-user-42' })],
    });
    const routes = userConnectRoutes(routeOptions(fetchMock as unknown as typeof fetch));
    const response = await (findRoute(routes, 'DELETE', '/connect/connections/:id') as any).handler(
      makeCtx({ resourceId: 'end-user-42', params: { id: 'c_gh_own' } }),
    );
    expect(response.status).toBe(204);
    expect(requests.find(request => request.method === 'DELETE')!.url.pathname).toBe('/v2/connections/c_gh_own');
  });

  it('refuses to disconnect global connections and 404s invisible ones', async () => {
    const { fetchMock, requests } = fakePlatform({
      connections: [makeConnection(), makeConnection({ id: 'c_other', resourceId: 'end-user-other' })],
    });
    const routes = userConnectRoutes(routeOptions(fetchMock as unknown as typeof fetch));
    const handler = (findRoute(routes, 'DELETE', '/connect/connections/:id') as any).handler;

    const globalResponse = await handler(makeCtx({ resourceId: 'end-user-42', params: { id: 'c_lin1' } }));
    expect(globalResponse.status).toBe(403);

    const otherResponse = await handler(makeCtx({ resourceId: 'end-user-42', params: { id: 'c_other' } }));
    expect(otherResponse.status).toBe(404);

    expect(requests.some(request => request.method === 'DELETE')).toBe(false);
  });
});

describe('GET /:provider (hosted page)', () => {
  it('serves the hosted page with no-store, CSP, and escaped provider data', async () => {
    const { fetchMock } = fakePlatform({
      integrations: [
        {
          id: 'linear',
          capabilities: { mcp: true },
          displayName: 'Linear <script>alert(1)</script>',
          logoUrl: 'https://logos.test/linear.png',
          authType: 'OAUTH2',
        },
      ],
    });
    const routes = userConnectRoutes(routeOptions(fetchMock as unknown as typeof fetch));
    const response = await (findRoute(routes, 'GET', '/connect/:provider') as any).handler(
      makeCtx({ resourceId: 'end-user-42', params: { provider: 'linear' }, query: { returnTo: '/done' } }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(response.headers.get('cache-control')).toBe('no-store, private');
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
    // Cookie-authenticated page must not be embeddable (clickjacking).
    expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    const page = await response.text();
    expect(page).not.toContain('<script>alert(1)</script>');
    expect(page).toContain('&lt;script&gt;');
    expect(page).toContain('"returnTo":"/done"');
  });

  it('rejects open-redirect returnTo values and allows allowlisted origins', async () => {
    const { fetchMock } = fakePlatform();
    const routes = userConnectRoutes(
      routeOptions(fetchMock as unknown as typeof fetch, {
        returnTo: { allowedOrigins: ['https://app.example.com'] },
      }),
    );
    const handler = (findRoute(routes, 'GET', '/connect/:provider') as any).handler;
    const base = { resourceId: 'end-user-42', params: { provider: 'linear' } };

    for (const bad of ['//evil.test/x', '/\\evil.test', 'https://evil.test/x', 'javascript:alert(1)']) {
      const response = await handler(makeCtx({ ...base, query: { returnTo: bad } }));
      expect(response.status, `returnTo=${bad}`).toBe(400);
    }

    const allowed = await handler(makeCtx({ ...base, query: { returnTo: 'https://app.example.com/done?a=1' } }));
    expect(allowed.status).toBe(200);
    expect(await allowed.text()).toContain('"returnTo":"https://app.example.com/done?a=1"');
  });

  it('404s for unknown providers and allowlisted providers missing from the catalog', async () => {
    const { fetchMock } = fakePlatform({ integrations: [] });
    const routes = userConnectRoutes(routeOptions(fetchMock as unknown as typeof fetch));
    const handler = (findRoute(routes, 'GET', '/connect/:provider') as any).handler;
    const notAllowlisted = await handler(makeCtx({ resourceId: 'end-user-42', params: { provider: 'github' } }));
    const notInCatalog = await handler(makeCtx({ resourceId: 'end-user-42', params: { provider: 'linear' } }));
    expect(notAllowlisted.status).toBe(404);
    expect(notInCatalog.status).toBe(404);
  });
});

describe('platform failure mapping', () => {
  it('maps platform errors to a generic 502 without leaking detail', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ detail: 'internal platform secret detail' }, { status: 500 }),
      ) as unknown as typeof fetch;
    const routes = userConnectRoutes(routeOptions(fetchMock));
    const response = await (findRoute(routes, 'GET', '/connect/connections') as any).handler(
      makeCtx({ resourceId: 'end-user-42' }),
    );
    expect(response.status).toBe(502);
    const body = await json(response);
    expect(JSON.stringify(body)).not.toContain('secret detail');
    expect(body.error.code).toBe('platform_error');
  });

  it('maps a missing access token to a generic 500 configuration error', async () => {
    const previousToken = process.env.MASTRA_PLATFORM_ACCESS_TOKEN;
    const previousSecret = process.env.MASTRA_PLATFORM_SECRET_KEY;
    delete process.env.MASTRA_PLATFORM_ACCESS_TOKEN;
    delete process.env.MASTRA_PLATFORM_SECRET_KEY;
    try {
      const routes = userConnectRoutes({ providers: ['linear'], projectId: 'proj_1' });
      const response = await (findRoute(routes, 'GET', '/connect/connections') as any).handler(
        makeCtx({ resourceId: 'end-user-42' }),
      );
      expect(response.status).toBe(500);
      expect((await json(response)).error.code).toBe('misconfigured');
    } finally {
      if (previousToken !== undefined) process.env.MASTRA_PLATFORM_ACCESS_TOKEN = previousToken;
      if (previousSecret !== undefined) process.env.MASTRA_PLATFORM_SECRET_KEY = previousSecret;
    }
  });
});

describe('validateReturnTo', () => {
  it('covers the open-redirect matrix', () => {
    expect(validateReturnTo(undefined, [])).toEqual({ ok: true, value: null });
    expect(validateReturnTo('', [])).toEqual({ ok: true, value: null });
    expect(validateReturnTo('/done', [])).toEqual({ ok: true, value: '/done' });
    expect(validateReturnTo('//evil.test', [])).toEqual({ ok: false });
    expect(validateReturnTo('/\\evil.test', [])).toEqual({ ok: false });
    // The WHATWG parser strips ASCII tab/newline before parsing, so these
    // decode to protocol-relative URLs despite passing a raw prefix check.
    expect(validateReturnTo('/\t/evil.test', [])).toEqual({ ok: false });
    expect(validateReturnTo('/\n\\evil.test', [])).toEqual({ ok: false });
    expect(validateReturnTo('/\r/evil.test', [])).toEqual({ ok: false });
    // Dot-segment normalization can mint a protocol-relative value: these
    // pass the raw prefix checks but normalize to `//evil.test`.
    expect(validateReturnTo('/foo/..//evil.test', [])).toEqual({ ok: false });
    expect(validateReturnTo('/foo/..\\/evil.test', [])).toEqual({ ok: false });
    expect(validateReturnTo('/foo/.././/evil.test', [])).toEqual({ ok: false });
    // Dot segments that stay same-origin remain fine.
    expect(validateReturnTo('/foo/../done', [])).toEqual({ ok: true, value: '/done' });
    expect(validateReturnTo('/done?next=1#frag', [])).toEqual({ ok: true, value: '/done?next=1#frag' });
    expect(validateReturnTo('https://evil.test/x', [])).toEqual({ ok: false });
    expect(validateReturnTo('javascript:alert(1)', [])).toEqual({ ok: false });
    expect(validateReturnTo('https://user:pass@app.example.com/x', ['https://app.example.com'])).toEqual({
      ok: false,
    });
    expect(validateReturnTo('https://app.example.com/done', ['https://app.example.com'])).toEqual({
      ok: true,
      value: 'https://app.example.com/done',
    });
  });
});
