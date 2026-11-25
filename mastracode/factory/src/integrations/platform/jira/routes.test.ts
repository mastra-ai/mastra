import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeRouteAuth, mountApiRoutes } from '../../../routes/test-utils.js';
import type { TestAuthUser } from '../../../routes/test-utils.js';
import { createFactoryStorageForTests } from '../../../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../../../storage/test-utils.js';
import { JiraApiError } from '../../jira/api.js';
import { PlatformJiraIntegration } from './integration.js';
import { buildPlatformJiraRoutes } from './routes.js';

// A real integration instance with the network edges spied out: source
// listing and issue paging run the production mapping code paths against the
// seeded `:memory:` intake storage.
let jira!: PlatformJiraIntegration;
let seed!: FactoryStorageTestSeed;

const listJiraSources = vi.fn(async () => [
  { id: '1', name: 'Engineering', type: 'project', metadata: { key: 'ENG' } },
]);

// ── Test harness ─────────────────────────────────────────────────────────
function buildApp(
  user: TestAuthUser | null,
  options: {
    authEnabled?: boolean;
    withJira?: boolean;
    withIntake?: boolean;
    appDbConfigured?: boolean;
  } = {},
) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('factoryAuthUser' as never, user as never);
    await next();
  });
  mountApiRoutes(
    app,
    buildPlatformJiraRoutes({
      jira: (options.withJira ?? true) ? jira : undefined,
      auth: fakeRouteAuth({ enabled: options.authEnabled ?? true }),
      intake: (options.withIntake ?? true) ? seed.intake : undefined,
      appDbConfigured: options.appDbConfigured ?? true,
    }),
  );
  return app;
}

const org1 = (): TestAuthUser => ({ workosId: 'u1', organizationId: 'org1' });

const createProject = async (id: string) => {
  const now = new Date();
  await seed.storage.ops.insertOne('factory_projects', {
    id,
    org_id: 'org1',
    created_by: 'u1',
    name: id,
    created_at: now,
    updated_at: now,
  });
};

beforeEach(async () => {
  seed = await createFactoryStorageForTests();
  jira = new PlatformJiraIntegration({
    connect: { baseUrl: 'https://integrations.example.com', projectId: 'proj_factory', accessToken: 'platform-token' },
  });
  vi.spyOn(jira, 'listConnections').mockResolvedValue([
    {
      id: 'a1b_acme',
      integrationId: 'jira',
      status: 'active',
      accountLabel: 'acme.atlassian.net',
    },
  ]);
  vi.spyOn(jira.intake, 'listSources').mockImplementation(listJiraSources);
  await seed.intake.saveConfig({
    orgId: 'org1',
    config: { jira: { enabled: true, sourceIds: ['1'] } },
  });
  vi.clearAllMocks();
});

describe('status route', () => {
  it('reports disabled without web auth and serves only the status route', async () => {
    const routes = buildPlatformJiraRoutes({
      jira,
      auth: fakeRouteAuth({ enabled: false }),
      intake: seed.intake,
      appDbConfigured: true,
    });
    expect(routes).toHaveLength(1);
    const app = buildApp(org1(), { authEnabled: false });
    const res = await app.request('/web/jira/status');
    expect(await res.json()).toMatchObject({ enabled: false, configured: true, reason: 'missing_config' });
    expect((await app.request('/web/jira/projects')).status).toBe(404);
  });

  it('reports disabled without the integration instance', async () => {
    const res = await buildApp(org1(), { withJira: false }).request('/web/jira/status');
    expect(await res.json()).toMatchObject({
      enabled: false,
      configured: false,
      reason: 'missing_config',
      diagnostics: { jiraConfigured: false, factoryAuthEnabled: true, appDbConfigured: true },
    });
  });

  it('reports disabled without intake storage', async () => {
    const res = await buildApp(org1(), { withIntake: false, appDbConfigured: false }).request('/web/jira/status');
    expect(await res.json()).toMatchObject({
      enabled: false,
      reason: 'missing_config',
      diagnostics: { appDbConfigured: false },
    });
  });

  it('reports ready with discovered Platform Jira connections', async () => {
    const res = await buildApp(org1()).request('/web/jira/status');
    expect(await res.json()).toEqual({
      enabled: true,
      configured: true,
      mode: 'platform',
      site: 'acme.atlassian.net',
      sites: ['acme.atlassian.net'],
      connections: [
        {
          id: 'a1b_acme',
          integrationId: 'jira',
          status: 'active',
          accountLabel: 'acme.atlassian.net',
        },
      ],
      reason: 'ready',
      diagnostics: { jiraConfigured: true, factoryAuthEnabled: true, appDbConfigured: true },
    });
  });

  it('reports not connected when no active Platform Jira connection is discovered', async () => {
    vi.mocked(jira.listConnections).mockResolvedValueOnce([]);
    const res = await buildApp(org1()).request('/web/jira/status');
    expect(await res.json()).toMatchObject({
      enabled: true,
      configured: false,
      mode: 'platform',
      connections: [],
      reason: 'not_connected',
    });
  });

  it('requires an organization', async () => {
    const res = await buildApp({ workosId: 'u1' }).request('/web/jira/status');
    expect(await res.json()).toMatchObject({
      enabled: true,
      organizationRequired: true,
      reason: 'organization_required',
    });
  });

  it('401s unauthenticated users when enabled', async () => {
    const res = await buildApp(null).request('/web/jira/status');
    expect(res.status).toBe(401);
  });
});

describe('projects route', () => {
  it('rejects unauthenticated users', async () => {
    const res = await buildApp(null).request('/web/jira/projects');
    expect(res.status).toBe(401);
  });

  it('403s personal accounts without an organization', async () => {
    const res = await buildApp({ workosId: 'u1' }).request('/web/jira/projects');
    expect(res.status).toBe(403);
  });

  it('lists the site projects for the Settings picker', async () => {
    const res = await buildApp(org1()).request('/web/jira/projects');
    expect(await res.json()).toEqual({
      projects: [{ id: '1', name: 'Engineering', key: 'ENG', connectionId: null, site: null }],
    });
    expect(listJiraSources).toHaveBeenCalledWith({ orgId: 'org1', userId: 'u1' });
  });

  it('409s with jira_auth_failed when Jira rejects the credentials', async () => {
    listJiraSources.mockRejectedValueOnce(new JiraApiError('Jira API request failed (401)', 401));
    const res = await buildApp(org1()).request('/web/jira/projects');
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'jira_auth_failed' });
  });
});

describe('issue detail route', () => {
  const projectA = '11111111-1111-4111-8111-111111111111';

  beforeEach(async () => {
    await seed.intake.saveConfig({
      orgId: 'org1',
      config: { jira: { enabled: true, sourceIds: ['1', '2'] } },
    });
  });

  it('returns the description for a Jira issue routed to the viewed Factory', async () => {
    await createProject(projectA);
    await seed.intake.setBinding({ orgId: 'org1', integrationId: 'jira', sourceId: '1', factoryProjectId: projectA });
    const issueRef = 'jira-issue:encoded-reference';
    vi.spyOn(jira.intake, 'resolveIntakeDispatch').mockResolvedValue({
      connection: { type: 'oauth', accessToken: 'jira-connection:a1b_acme' },
      sourceId: '1',
      issueId: 'ENG-42',
    });
    vi.spyOn(jira.intake, 'getIssue').mockResolvedValue({
      id: '10001',
      identifier: 'ENG-42',
      title: 'Fix intake sync',
      url: 'https://acme.atlassian.net/browse/ENG-42',
      author: 'Grace',
      state: 'To Do',
      stateType: 'unstarted',
      priority: 'High',
      assignee: 'Ada',
      source: 'ENG',
      labels: ['bug'],
      commentCount: 0,
      createdAt: '2026-07-01T00:00:00Z',
      updatedAt: '2026-07-02T00:00:00Z',
      description: 'Detailed Jira task body',
      comments: [],
    });

    const params = new URLSearchParams({ factoryProjectId: projectA, issueRef });
    const res = await buildApp(org1()).request(`/web/jira/issues/ENG-42?${params.toString()}`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      identifier: 'ENG-42',
      title: 'Fix intake sync',
      url: 'https://acme.atlassian.net/browse/ENG-42',
      description: 'Detailed Jira task body',
    });
  });
});
