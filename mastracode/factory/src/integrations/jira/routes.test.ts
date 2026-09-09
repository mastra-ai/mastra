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
const listActiveJiraIssues = vi.fn(async (_after?: string, _projectIds?: string[]) => ({
  issues: [
    {
      id: '10001',
      sourceId: '1',
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
      commentCount: null,
      createdAt: '2026-07-01T00:00:00Z',
      updatedAt: '2026-07-02T00:00:00Z',
    },
  ],
  nextCursor: 'page-2',
}));

// ── Test harness ─────────────────────────────────────────────────────────
function buildApp(
  user: TestAuthUser | null,
  options: { authEnabled?: boolean; withJira?: boolean; withIntake?: boolean } = {},
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
      projects: seed.projects,
    }),
  );
  return app;
}

const org1 = (): TestAuthUser => ({ workosId: 'u1', organizationId: 'org1' });

beforeEach(async () => {
  seed = await createFactoryStorageForTests();
  jira = new JiraIntegration({ baseUrl: 'https://acme.atlassian.net', email: 'ops@acme.test', apiToken: 'jira-token' });
  vi.spyOn(jira.intake, 'listSources').mockImplementation(listJiraSources);
  vi.spyOn(jira, 'listActiveIssues').mockImplementation(listActiveJiraIssues as never);
  await seed.intake.saveConfig({
    orgId: 'org1',
    userId: 'u1',
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
    expect((await app.request('/web/jira/issues')).status).toBe(404);
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
      site: 'acme.atlassian.net',
      reason: 'ready',
      diagnostics: { jiraConfigured: true, factoryAuthEnabled: true, appDbConfigured: true },
    });
  });

  it('requires an organization', async () => {
    const res = await buildApp({ workosId: 'u1' }).request('/web/jira/status');
    expect(await res.json()).toMatchObject({ enabled: true, organizationRequired: true, reason: 'organization_required' });
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

describe('issues route', () => {
  it('returns a page of issues with the next cursor', async () => {
    const res = await buildApp(org1()).request('/web/jira/issues');
    const json = await res.json();
    expect(json.issues[0]).toMatchObject({
      identifier: 'ENG-42',
      title: 'Fix intake sync',
      state: 'To Do',
      stateType: 'unstarted',
      priorityLabel: 'High',
      project: 'ENG',
    });
    expect(json.nextCursor).toBe('page-2');
    expect(listActiveJiraIssues).toHaveBeenCalledWith(undefined, ['1']);
  });

  it('forwards the pagination cursor', async () => {
    await buildApp(org1()).request('/web/jira/issues?after=page-2');
    expect(listActiveJiraIssues).toHaveBeenCalledWith('page-2', ['1']);
  });

  it('rejects malformed cursors', async () => {
    const res = await buildApp(org1()).request('/web/jira/issues?after=bad%20cursor%22');
    expect(res.status).toBe(400);
    expect(listActiveJiraIssues).not.toHaveBeenCalled();
  });

  it('404s when Jira intake is disabled in settings', async () => {
    await seed.intake.saveConfig({
      orgId: 'org1',
      userId: 'u1',
      config: { jira: { enabled: false, sourceIds: null } },
    });
    const res = await buildApp(org1()).request('/web/jira/issues');
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'jira_intake_disabled' });
    expect(listActiveJiraIssues).not.toHaveBeenCalled();
  });

  it('returns an empty page without calling Jira when no projects are selected', async () => {
    await seed.intake.saveConfig({
      orgId: 'org1',
      userId: 'u1',
      config: { jira: { enabled: true, sourceIds: null } },
    });
    const res = await buildApp(org1()).request('/web/jira/issues');
    expect(await res.json()).toEqual({ issues: [], nextCursor: null });
    expect(listActiveJiraIssues).not.toHaveBeenCalled();
  });

  it('409s with jira_auth_failed when Jira rejects the credentials', async () => {
    listActiveJiraIssues.mockRejectedValueOnce(new JiraApiError('Jira API request failed (403)', 403));
    const res = await buildApp(org1()).request('/web/jira/issues');
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'jira_auth_failed' });
  });

  it('502s when the Jira API fails', async () => {
    listActiveJiraIssues.mockRejectedValueOnce(new JiraApiError('Jira API request failed (500)', 500));
    const res = await buildApp(org1()).request('/web/jira/issues');
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: 'jira_fetch_failed' });
  });

  it('rejects unauthenticated users', async () => {
    const res = await buildApp(null).request('/web/jira/issues');
    expect(res.status).toBe(401);
  });

  it('rejects malformed factory project ids', async () => {
    const res = await buildApp(org1()).request('/web/jira/issues?factoryProjectId=not-a-uuid');
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_factory_project_id' });
    expect(listActiveJiraIssues).not.toHaveBeenCalled();
  });
});

describe('issues route — Factory source bindings', () => {
  const projectA = '11111111-1111-4111-8111-111111111111';
  const projectB = '22222222-2222-4222-8222-222222222222';

  const seedProjects = async (count: number) => {
    for (let i = 0; i < count; i += 1) {
      await seed.projects.create({ orgId: 'org1', userId: 'u1', input: { name: `project-${i}` } });
    }
  };

  const bind = (sourceId: string, factoryProjectId: string) =>
    seed.intake.setBinding({ orgId: 'org1', integrationId: 'jira', sourceId, factoryProjectId });

  beforeEach(async () => {
    await seed.intake.saveConfig({
      orgId: 'org1',
      userId: 'u1',
      config: { jira: { enabled: true, sourceIds: ['1', '2'] } },
    });
  });

  it('narrows the selection to the sources bound to the viewed Factory', async () => {
    await seedProjects(2);
    await bind('1', projectA);
    await bind('2', projectB);

    const res = await buildApp(org1()).request(`/web/jira/issues?factoryProjectId=${projectA}`);

    expect(res.status).toBe(200);
    expect(listActiveJiraIssues).toHaveBeenCalledWith(undefined, ['1']);
  });

  it('hides sources routed to another Factory from this board', async () => {
    await seedProjects(2);
    await bind('1', projectA);

    const res = await buildApp(org1()).request(`/web/jira/issues?factoryProjectId=${projectB}`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ issues: [], nextCursor: null });
    expect(listActiveJiraIssues).not.toHaveBeenCalled();
  });

  it('hides an unbound selection in a multi-Factory org with no bindings', async () => {
    await seedProjects(2);

    const res = await buildApp(org1()).request(`/web/jira/issues?factoryProjectId=${projectA}`);

    expect(await res.json()).toEqual({ issues: [], nextCursor: null });
    expect(listActiveJiraIssues).not.toHaveBeenCalled();
  });

  it('falls back to the full selection for a single-Factory org with no bindings', async () => {
    await seedProjects(1);

    const res = await buildApp(org1()).request(`/web/jira/issues?factoryProjectId=${projectA}`);

    expect(res.status).toBe(200);
    expect(listActiveJiraIssues).toHaveBeenCalledWith(undefined, ['1', '2']);
  });

  it('forwards the pagination cursor together with the scoped selection', async () => {
    await seedProjects(2);
    await bind('1', projectA);

    await buildApp(org1()).request(`/web/jira/issues?factoryProjectId=${projectA}&after=page-2`);

    expect(listActiveJiraIssues).toHaveBeenCalledWith('page-2', ['1']);
  });

  it('keeps the unscoped selection for callers that omit the Factory project', async () => {
    await seedProjects(2);
    await bind('1', projectA);

    const res = await buildApp(org1()).request('/web/jira/issues');

    expect(res.status).toBe(200);
    expect(listActiveJiraIssues).toHaveBeenCalledWith(undefined, ['1', '2']);
  });
});
