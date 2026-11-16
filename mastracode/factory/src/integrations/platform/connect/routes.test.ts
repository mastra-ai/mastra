import { Hono } from 'hono';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { fakeRouteAuth, mountApiRoutes } from '../../../routes/test-utils.js';
import type { TestAuthUser } from '../../../routes/test-utils.js';
import { PlatformApiClient } from '../api-client.js';
import { buildConnectToolsRoute, buildPlatformConnectRoutes } from './routes.js';

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

function buildApp(
  user: TestAuthUser | null,
  fetchImpl: typeof fetch,
  options: { authEnabled?: boolean; connectToolsProjectId?: string } = {},
): Hono {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('factoryAuthUser' as never, user as never);
    await next();
  });
  const auth = fakeRouteAuth({ enabled: options.authEnabled ?? true });
  const client = new PlatformApiClient({
    baseUrl: 'https://integrations.example.com',
    accessToken: 'platform-secret',
    fetchImpl,
  });
  const projectId = options.connectToolsProjectId;
  mountApiRoutes(app, [
    ...buildPlatformConnectRoutes({ auth, client }),
    buildConnectToolsRoute(auth, projectId ? { client, projectId } : undefined),
  ]);
  return app;
}

const org1 = (): TestAuthUser => ({ workosId: 'u1', organizationId: 'org1' });

describe('platform connect routes', () => {
  it("lists the project's connections that sessions use, not the organization's or GitHub's", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async input => {
      const url = String(input);
      if (url.endsWith('/v2/projects/proj_1/connections')) {
        return json({
          connections: [
            connection('conn-mcp', 'neon-mcp', 'needs_reauth'),
            connection('conn-linear', 'linear'),
            connection('conn-github', 'github'),
          ],
        });
      }
      if (url.endsWith('/v2/connections')) return json({ connections: [connection('conn-snowflake', 'snowflake')] });
      if (url.endsWith('/v2/integrations')) {
        return json({
          integrations: [
            { id: 'neon-mcp', displayName: 'Neon MCP', logoUrl: 'https://logos.example.com/neon.svg' },
            { id: 'linear', displayName: 'Linear', logoUrl: null },
          ],
        });
      }
      return json({ detail: 'not found' }, 404);
    });
    const app = buildApp({ workosId: 'u1' }, fetchImpl, { connectToolsProjectId: 'proj_1' });

    const response = await app.request('/web/integrations/platform/connect-tools');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      projectId: 'proj_1',
      connections: [
        {
          id: 'conn-linear',
          integrationId: 'linear',
          providerName: 'Linear',
          logoUrl: null,
          accountLabel: 'linear-account',
          status: 'active',
        },
        {
          id: 'conn-mcp',
          integrationId: 'neon-mcp',
          providerName: 'Neon MCP',
          logoUrl: 'https://logos.example.com/neon.svg',
          accountLabel: 'neon-mcp-account',
          status: 'needs_reauth',
        },
      ],
    });
  });

  it('still lists the attached connections on a local Factory without auth when the catalog is down', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    onTestFinished(() => warn.mockRestore());
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async input =>
      String(input).endsWith('/v2/projects/proj_1/connections')
        ? json({ connections: [connection('conn-linear', 'linear')] })
        : json({ detail: 'catalog unavailable' }, 503),
    );
    const app = buildApp(null, fetchImpl, { authEnabled: false, connectToolsProjectId: 'proj_1' });

    const response = await app.request('/web/integrations/platform/connect-tools');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      projectId: 'proj_1',
      connections: [expect.objectContaining({ id: 'conn-linear', providerName: 'linear', logoUrl: null })],
    });
  });

  it("answers JSON the settings page can read when this Factory's sessions get no Connect tools", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const app = buildApp(org1(), fetchImpl);

    const response = await app.request('/web/integrations/platform/connect-tools');
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: 'connect_tools_off' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

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
    const fetchImpl = vi.fn<typeof fetch>();
    const app = buildApp(org1(), fetchImpl);
    expect((await app.request('/web/integrations/platform/notion/connect-session', { method: 'POST' })).status).toBe(
      404,
    );

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
});
