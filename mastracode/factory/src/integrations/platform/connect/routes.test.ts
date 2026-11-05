import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { fakeRouteAuth, mountApiRoutes } from '../../../routes/test-utils.js';
import type { TestAuthUser } from '../../../routes/test-utils.js';
import { PlatformApiClient } from '../api-client.js';
import { buildPlatformConnectRoutes } from './routes.js';

const SESSION = {
  connectionId: 'conn-new',
  integrationId: 'jira',
  connectUrl: 'https://connect.nango.dev/session',
  sessionToken: 'nango-session-token',
  expiresAt: '2026-09-17T12:30:00.000Z',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

function connection(id: string, integrationId: string, status: 'active' | 'needs_reauth' = 'active') {
  return { id, integrationId, status, accountLabel: `${integrationId}-account`, displayName: null };
}

function buildApp(user: TestAuthUser | null, fetchImpl: typeof fetch, options: { authEnabled?: boolean } = {}): Hono {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('factoryAuthUser' as never, user as never);
    await next();
  });
  mountApiRoutes(
    app,
    buildPlatformConnectRoutes({
      auth: fakeRouteAuth({ enabled: options.authEnabled ?? true }),
      client: new PlatformApiClient({
        baseUrl: 'https://integrations.example.com',
        accessToken: 'platform-secret',
        fetchImpl,
      }),
    }),
  );
  return app;
}

const CATALOG = {
  integrations: [
    {
      id: 'notion',
      capabilities: {},
      displayName: 'Notion',
      logoUrl: 'https://logos.example.com/notion.svg',
      authType: 'oauth2',
    },
    {
      id: 'custom-mcp',
      capabilities: { mcp: true },
      displayName: 'Custom MCP',
      authType: 'api_key',
      authFields: [
        { name: 'apiKey', target: 'credentials', label: 'API key', secret: true, required: true, order: 2 },
        { name: 'serverUrl', target: 'params', label: 'Server URL', placeholder: 'https://', required: true, order: 1 },
      ],
    },
  ],
};

const org1 = (): TestAuthUser => ({ workosId: 'u1', organizationId: 'org1' });

describe('platform connect routes', () => {
  it('lists Jira connections and hides other providers', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () =>
      json({
        connections: [connection('conn-a', 'github'), connection('conn-b', 'jira', 'needs_reauth')],
      }),
    );
    const app = buildApp(org1(), fetchImpl);

    const response = await app.request('/web/integrations/platform/jira/connections');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      connections: [expect.objectContaining({ id: 'conn-b' })],
    });
  });

  it('mints a connect session with the provider integration id', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => json(SESSION, 201));
    const app = buildApp(org1(), fetchImpl);

    const response = await app.request('/web/integrations/platform/incident-io/connect-session', { method: 'POST' });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(SESSION);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://integrations.example.com/v2/integrations/incident-io/connect-sessions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authorization: 'Bearer platform-secret' }),
      }),
    );
  });

  it('mints a reconnect session only for a connection owned by the provider', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async input => {
      const url = String(input);
      if (url.endsWith('/v2/connections')) {
        return json({ connections: [connection('conn-jira', 'jira', 'needs_reauth')] });
      }
      if (url.endsWith('/v2/connections/conn-jira/reconnect-session')) return json(SESSION, 201);
      throw new Error(`Unexpected fetch: ${url}`);
    });
    const app = buildApp(org1(), fetchImpl);

    const response = await app.request('/web/integrations/platform/jira/connections/conn-jira/reconnect-session', {
      method: 'POST',
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(SESSION);

    // A registered provider that does not own the connection: the ownership
    // filter itself must reject, not the unknown-provider gate.
    const crossProvider = await app.request(
      '/web/integrations/platform/incident-io/connections/conn-jira/reconnect-session',
      { method: 'POST' },
    );
    expect(crossProvider.status).toBe(404);
    await expect(crossProvider.json()).resolves.toEqual({ error: 'connection_not_found' });
  });

  it('mints a GitLab connect session through the platform registry', async () => {
    const gitlabSession = { ...SESSION, integrationId: 'gitlab' };
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => json(gitlabSession, 201));
    const app = buildApp(org1(), fetchImpl);

    const response = await app.request('/web/integrations/platform/gitlab/connect-session', { method: 'POST' });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(gitlabSession);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://integrations.example.com/v2/integrations/gitlab/connect-sessions',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('rejects unknown providers, signed-out callers, and personal accounts', async () => {
    const catalogFetch = vi.fn<typeof fetch>().mockImplementation(async () => json(CATALOG));
    const app = buildApp(org1(), catalogFetch);
    const unknown = await app.request('/web/integrations/platform/nope/connect-session', { method: 'POST' });
    expect(unknown.status).toBe(404);
    await expect(unknown.json()).resolves.toEqual({ error: 'unknown_provider' });

    const fetchImpl = vi.fn<typeof fetch>();

    const signedOut = buildApp(null, fetchImpl);
    expect(
      (await signedOut.request('/web/integrations/platform/jira/connect-session', { method: 'POST' })).status,
    ).toBe(401);

    const personal = buildApp({ workosId: 'u1' }, fetchImpl);
    expect((await personal.request('/web/integrations/platform/jira/connect-session', { method: 'POST' })).status).toBe(
      403,
    );

    const authDisabled = buildApp(org1(), fetchImpl, { authEnabled: false });
    expect(
      (await authDisabled.request('/web/integrations/platform/jira/connect-session', { method: 'POST' })).status,
    ).toBe(403);

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps platform conflicts and forbidden responses instead of returning 502', async () => {
    const conflictFetch = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => json({ detail: 'Reconnect session is already pending' }, 409));
    const conflictApp = buildApp(org1(), conflictFetch);
    const conflict = await conflictApp.request('/web/integrations/platform/jira/connect-session', { method: 'POST' });
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toEqual(expect.objectContaining({ error: 'session_pending' }));

    const forbiddenFetch = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => json({ detail: 'Your role has read-only access to this organization' }, 403));
    const forbiddenApp = buildApp(org1(), forbiddenFetch);
    const forbidden = await forbiddenApp.request('/web/integrations/platform/jira/connect-session', {
      method: 'POST',
    });
    expect(forbidden.status).toBe(403);
    await expect(forbidden.json()).resolves.toEqual(expect.objectContaining({ error: 'platform_forbidden' }));

    const failingFetch = vi.fn<typeof fetch>().mockImplementation(async () => json({ detail: 'boom' }, 500));
    const failingApp = buildApp(org1(), failingFetch);
    const failed = await failingApp.request('/web/integrations/platform/jira/connect-session', { method: 'POST' });
    expect(failed.status).toBe(502);
  });

  it('lists the catalog sorted by name with MCP server-url fields ordered first', async () => {
    const app = buildApp(org1(), vi.fn<typeof fetch>().mockImplementation(async () => json(CATALOG)));

    const response = await app.request('/web/integrations/platform/catalog');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      providers: [
        {
          id: 'custom-mcp',
          displayName: 'Custom MCP',
          logoUrl: null,
          authType: 'api_key',
          mcp: true,
          authFields: [
            {
              name: 'serverUrl',
              target: 'params',
              label: 'Server URL',
              description: null,
              placeholder: 'https://',
              secret: false,
              required: true,
            },
            {
              name: 'apiKey',
              target: 'credentials',
              label: 'API key',
              description: null,
              placeholder: null,
              secret: true,
              required: true,
            },
          ],
        },
        {
          id: 'notion',
          displayName: 'Notion',
          logoUrl: 'https://logos.example.com/notion.svg',
          authType: 'oauth2',
          mcp: false,
          authFields: [],
        },
      ],
    });
  });

  it('returns 502 for a malformed catalog and maps a Platform 403', async () => {
    const malformed = buildApp(org1(), vi.fn<typeof fetch>().mockImplementation(async () => json({ items: [] })));
    expect((await malformed.request('/web/integrations/platform/catalog')).status).toBe(502);

    const forbidden = buildApp(
      org1(),
      vi.fn<typeof fetch>().mockImplementation(async () => json({ detail: 'read-only' }, 403)),
    );
    const response = await forbidden.request('/web/integrations/platform/catalog');
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ error: 'platform_forbidden' }));
  });

  it('lists connections for every integration, including unknown statuses', async () => {
    const rows = [
      connection('conn-a', 'github'),
      connection('conn-b', 'jira', 'needs_reauth'),
      { ...connection('conn-c', 'notion'), status: 'pending' },
    ];
    const app = buildApp(org1(), vi.fn<typeof fetch>().mockImplementation(async () => json({ connections: rows })));

    const response = await app.request('/web/integrations/platform/connections');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ connections: rows });
  });

  it('mints connect and reconnect sessions for a catalog provider outside the hardcoded registry', async () => {
    const notionSession = { ...SESSION, integrationId: 'notion' };
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async input => {
      const url = String(input);
      if (url.endsWith('/v2/integrations')) return json(CATALOG);
      if (url.endsWith('/v2/integrations/notion/connect-sessions')) return json(notionSession, 201);
      if (url.endsWith('/v2/connections')) return json({ connections: [connection('conn-n', 'notion')] });
      if (url.endsWith('/v2/connections/conn-n/reconnect-session')) return json(notionSession, 201);
      throw new Error(`Unexpected fetch: ${url}`);
    });
    const app = buildApp(org1(), fetchImpl);

    const connect = await app.request('/web/integrations/platform/notion/connect-session', { method: 'POST' });
    expect(connect.status).toBe(201);
    await expect(connect.json()).resolves.toEqual(notionSession);

    const reconnect = await app.request('/web/integrations/platform/notion/connections/conn-n/reconnect-session', {
      method: 'POST',
    });
    expect(reconnect.status).toBe(201);
    await expect(reconnect.json()).resolves.toEqual(notionSession);
  });
});
