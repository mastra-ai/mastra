import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeRouteAuth, mountApiRoutes } from '../../routes/test-utils.js';
import type { TestAuthUser } from '../../routes/test-utils.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../../storage/test-utils.js';
import { JiraApiError } from './api.js';
import { JiraIntegration } from './integration.js';
import { buildJiraRoutes } from './routes.js';

// A real integration instance with the network edges spied out: source
// listing and issue paging run the production mapping code paths against the
// seeded `:memory:` intake storage.
let jira!: JiraIntegration;
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
  } = {},
) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('factoryAuthUser' as never, user as never);
    await next();
  });
  mountApiRoutes(
    app,
    buildJiraRoutes({
      jira: (options.withJira ?? true) ? jira : undefined,
      auth: fakeRouteAuth({ enabled: options.authEnabled ?? true }),
      intake: (options.withIntake ?? true) ? seed.intake : undefined,
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
  jira = new JiraIntegration({ baseUrl: 'https://acme.atlassian.net', email: 'ops@acme.test', apiToken: 'jira-token' });
  vi.spyOn(jira.intake, 'listSources').mockImplementation(listJiraSources);
  await seed.intake.saveConfig({
    orgId: 'org1',
    config: { jira: { enabled: true, sourceIds: ['1'] } },
  });
  vi.clearAllMocks();
});

describe('status route', () => {
  it('reports disabled without web auth and serves only the status route', async () => {
    const routes = buildJiraRoutes({ jira, auth: fakeRouteAuth({ enabled: false }), intake: seed.intake });
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
    const res = await buildApp(org1(), { withIntake: false }).request('/web/jira/status');
    expect(await res.json()).toMatchObject({ enabled: false, reason: 'missing_config' });
  });

  it('reports ready with the site host when configured', async () => {
    const res = await buildApp(org1()).request('/web/jira/status');
    expect(await res.json()).toEqual({
      enabled: true,
      configured: true,
      mode: 'direct',
      site: 'acme.atlassian.net',
      reason: 'ready',
      diagnostics: { jiraConfigured: true, factoryAuthEnabled: true, appDbConfigured: true },
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
    expect(await res.json()).toEqual({ projects: [{ id: '1', name: 'Engineering', key: 'ENG' }] });
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

  const issueDetail = (projectId: string) => ({
    id: '10001',
    identifier: 'ENG-42',
    title: 'Fix intake sync',
    url: 'https://acme.atlassian.net/browse/ENG-42',
    description: 'It syncs the wrong way.',
    author: 'Grace',
    state: 'To Do',
    stateType: 'unstarted',
    priority: 'High',
    assignee: 'Ada',
    source: 'ENG',
    sourceId: projectId,
    labels: ['bug'],
    commentCount: 0,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-02T00:00:00Z',
    comments: [],
  });

  const detailUrl = `/web/jira/issues/ENG-42?factoryProjectId=${projectA}&issueRef=ENG-42`;

  beforeEach(async () => {
    await createProject(projectA);
    await seed.intake.setBinding({
      orgId: 'org1',
      integrationId: 'jira',
      sourceId: '1',
      factoryProjectId: projectA,
    });
  });

  it('returns the description for an issue from a source routed to the Factory', async () => {
    vi.spyOn(jira.intake, 'getIssue').mockResolvedValue(issueDetail('1'));

    const res = await buildApp(org1()).request(detailUrl);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      identifier: 'ENG-42',
      title: 'Fix intake sync',
      url: 'https://acme.atlassian.net/browse/ENG-42',
      description: 'It syncs the wrong way.',
    });
  });

  it('reads like a missing issue when its project is not routed to the Factory', async () => {
    // The Jira account can see the whole site, but the issue's project ("99")
    // is neither selected nor bound to this Factory — the caller must not be
    // able to read arbitrary site issues through the detail route.
    vi.spyOn(jira.intake, 'getIssue').mockResolvedValue(issueDetail('99'));

    const res = await buildApp(org1()).request(detailUrl);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'issue_not_found' });
  });
});
