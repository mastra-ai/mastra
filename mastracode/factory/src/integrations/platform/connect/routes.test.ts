import { Hono } from 'hono';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { fakeRouteAuth, mountApiRoutes } from '../../../routes/test-utils.js';
import type { TestAuthUser } from '../../../routes/test-utils.js';
import { PlatformConnectBinding } from '../foundation/connect-binding.js';
import { createPlatformConnectClient } from '../platform-connect.js';
import { buildConnectToolListRoute, buildConnectToolsRoute, buildPlatformConnectRoutes } from './routes.js';
import type { ConnectToolsSetupMissing, ConnectToolsSource } from './routes.js';

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
  options: {
    authEnabled?: boolean;
    connectToolsProjectId?: string;
    toolsSource?: 'default' | 'custom';
    missing?: ConnectToolsSetupMissing;
    resolveTools?: ConnectToolsSource['resolveTools'];
    isAdmin?: boolean;
  } = {},
): Hono {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('factoryAuthUser' as never, user as never);
    await next();
  });
  const auth = fakeRouteAuth({
    enabled: options.authEnabled ?? true,
    isOrganizationAdmin: async () => options.isAdmin ?? true,
  });
  const client = createPlatformConnectClient({
    baseUrl: 'https://integrations.example.com',
    accessToken: 'platform-secret',
    projectId: 'proj_factory',
    fetch: fetchImpl,
  });
  const providers = ['jira', 'incident-io', 'gitlab', 'vanta'].map(integrationId => ({
    provider: integrationId,
    integrationId,
    connectionIntegrationIds: [integrationId],
    binding: new PlatformConnectBinding({ integrationId, providerKeys: [integrationId], connect: client }),
  }));
  const projectId = options.connectToolsProjectId;
  const source: ConnectToolsSource | { missing: ConnectToolsSetupMissing } = projectId
    ? {
        client,
        projectId,
        toolsSource: options.toolsSource ?? 'default',
        resolveTools: options.resolveTools ?? (async () => ({})),
      }
    : { missing: options.missing ?? 'no_credentials' };
  mountApiRoutes(app, [
    ...buildPlatformConnectRoutes({ auth, providers }),
    buildConnectToolsRoute(auth, source),
    buildConnectToolListRoute(auth, source),
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
      toolsSource: 'default',
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
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(async input =>
        String(input).endsWith('/v2/projects/proj_1/connections')
          ? json({ connections: [connection('conn-linear', 'linear')] })
          : json({ detail: 'catalog unavailable' }, 503),
      );
    const app = buildApp(null, fetchImpl, { authEnabled: false, connectToolsProjectId: 'proj_1' });

    const response = await app.request('/web/integrations/platform/connect-tools');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      projectId: 'proj_1',
      toolsSource: 'default',
      connections: [expect.objectContaining({ id: 'conn-linear', providerName: 'linear', logoUrl: null })],
    });
  });

  // #30579: a Factory whose `tools` option narrows Connect tools still uses the project's connections.
  it('lists the connections and says session tools come from code when the Factory sets tools', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(async input =>
        String(input).endsWith('/v2/projects/proj_1/connections')
          ? json({ connections: [connection('conn-posthog', 'posthog')] })
          : json({ integrations: [{ id: 'posthog', displayName: 'PostHog', logoUrl: null }] }),
      );
    const app = buildApp(org1(), fetchImpl, { connectToolsProjectId: 'proj_1', toolsSource: 'custom' });

    const response = await app.request('/web/integrations/platform/connect-tools');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      projectId: 'proj_1',
      toolsSource: 'custom',
      connections: [expect.objectContaining({ id: 'conn-posthog', providerName: 'PostHog' })],
    });
  });

  it.each([
    ['no_credentials', /MASTRA_PLATFORM_SECRET_KEY or MASTRA_PLATFORM_ACCESS_TOKEN/],
    ['no_project_id', /no MASTRA_PROJECT_ID/],
  ] as const)('names the one missing setup piece (%s) without calling the Platform', async (missing, message) => {
    const fetchImpl = vi.fn<typeof fetch>();
    const app = buildApp(org1(), fetchImpl, { missing });

    const response = await app.request('/web/integrations/platform/connect-tools');
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'connect_tools_off',
      reason: missing,
      message: expect.stringMatching(message),
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("doesn't tell signed-out callers how the Factory is set up", async () => {
    const app = buildApp(null, vi.fn<typeof fetch>(), { missing: 'no_project_id' });

    const response = await app.request('/web/integrations/platform/connect-tools');
    expect(response.status).toBe(401);
  });

  it("lists a tools option's tools as written, flagging the ones that ask for approval", async () => {
    const app = buildApp(org1(), vi.fn<typeof fetch>(), {
      connectToolsProjectId: 'proj_1',
      toolsSource: 'custom',
      resolveTools: async () => ({
        posthog_list_dashboards: { id: 'posthog_list_dashboards', description: '  List dashboards.\n' },
        posthog_delete_insight: {
          id: 'posthog_delete_insight',
          description: 'Delete an insight.',
          requireApproval: true,
        },
        tickets_lookup: { id: 'tickets_lookup' },
      }),
    });

    const response = await app.request('/web/integrations/platform/connect-tools/tools');
    expect(response.status).toBe(200);
    // Factory doesn't filter a tools option, so nothing is marked as left out.
    await expect(response.json()).resolves.toEqual({
      toolsSource: 'custom',
      tools: [
        { name: 'posthog_delete_insight', description: 'Delete an insight.', requiresApproval: true },
        { name: 'posthog_list_dashboards', description: 'List dashboards.', requiresApproval: false },
        { name: 'tickets_lookup', description: null, requiresApproval: false },
      ],
    });
  });

  it('names the missing setup piece and hides setup from signed-out callers on the tool list too', async () => {
    const missing = await buildApp(org1(), vi.fn<typeof fetch>(), { missing: 'no_project_id' }).request(
      '/web/integrations/platform/connect-tools/tools',
    );
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toMatchObject({ error: 'connect_tools_off', reason: 'no_project_id' });

    const resolveTools = vi.fn<ConnectToolsSource['resolveTools']>(async () => ({}));
    const signedOut = await buildApp(null, vi.fn<typeof fetch>(), {
      connectToolsProjectId: 'proj_1',
      resolveTools,
    }).request('/web/integrations/platform/connect-tools/tools');
    expect(signedOut.status).toBe(401);
    expect(resolveTools).not.toHaveBeenCalled();
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

  it("mints a connect session with the provider integration id, linked to the Factory's project", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => json(SESSION, 201));
    const app = buildApp(org1(), fetchImpl);

    const response = await app.request('/web/integrations/platform/incident-io/connect-session', { method: 'POST' });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(SESSION);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://integrations.example.com/v2/projects/proj_factory/integrations/incident-io/connect-sessions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authorization: 'Bearer platform-secret' }),
      }),
    );
  });

  it('mints a reconnect session only for a project connection owned by the provider', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async input => {
      const url = String(input);
      if (url.endsWith('/v2/projects/proj_factory/connections')) {
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

  it("refuses to reconnect an organization connection that isn't linked to the Factory's project", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async input => {
      const url = String(input);
      if (url.endsWith('/v2/projects/proj_factory/connections')) return json({ connections: [] });
      if (url.endsWith('/v2/connections')) return json({ connections: [connection('conn-jira', 'jira')] });
      throw new Error(`Unexpected fetch: ${url}`);
    });
    const app = buildApp(org1(), fetchImpl);

    const response = await app.request('/web/integrations/platform/jira/connections/conn-jira/reconnect-session', {
      method: 'POST',
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'connection_not_found' });
    expect(fetchImpl).not.toHaveBeenCalledWith(expect.stringContaining('reconnect-session'), expect.anything());
  });

  it("lets organization admins link the organization's existing connections to the Factory's project", async () => {
    const linked = new Set<string>();
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/v2/connections')) {
        return json({ connections: [connection('conn-jira', 'jira'), connection('conn-gitlab', 'gitlab')] });
      }
      if (url.endsWith('/v2/projects/proj_factory/connections')) {
        return json({ connections: [...linked].map(id => connection(id, 'jira')) });
      }
      if (init?.method === 'POST' && url.endsWith('/v2/projects/proj_factory/connections/conn-jira')) {
        linked.add('conn-jira');
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected fetch: ${init?.method ?? 'GET'} ${url}`);
    });

    const member = await buildApp(org1(), fetchImpl, { isAdmin: false }).request(
      '/web/integrations/platform/jira/link-connections',
      { method: 'POST' },
    );
    expect(member.status).toBe(403);
    await expect(member.json()).resolves.toMatchObject({ error: 'organization_admin_required' });
    expect(fetchImpl).not.toHaveBeenCalled();

    const admin = await buildApp(org1(), fetchImpl).request('/web/integrations/platform/jira/link-connections', {
      method: 'POST',
    });
    expect(admin.status).toBe(200);
    await expect(admin.json()).resolves.toEqual({ linked: ['conn-jira'], needsLinking: [] });
    expect(linked).toEqual(new Set(['conn-jira']));

    const signedOut = await buildApp(null, fetchImpl).request('/web/integrations/platform/jira/link-connections', {
      method: 'POST',
    });
    expect(signedOut.status).toBe(401);
  });

  it('mints a GitLab connect session through the platform registry', async () => {
    const gitlabSession = { ...SESSION, integrationId: 'gitlab' };
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => json(gitlabSession, 201));
    const app = buildApp(org1(), fetchImpl);

    const response = await app.request('/web/integrations/platform/gitlab/connect-session', { method: 'POST' });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(gitlabSession);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://integrations.example.com/v2/projects/proj_factory/integrations/gitlab/connect-sessions',
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
