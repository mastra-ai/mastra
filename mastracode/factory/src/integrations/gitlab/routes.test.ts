import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { createFactoryAuthGate } from '../../auth.js';
import { fakeRouteAuth, mountApiRoutes } from '../../routes/test-utils.js';
import type { TestAuthUser } from '../../routes/test-utils.js';
import { PlatformGitLabIntegration } from '../platform/gitlab/integration.js';
import { GitLabApiError } from './api.js';
import { decodeIssueReference, encodeIssueReference, encodeSourceId, GitLabIntegration } from './integration.js';
import type { GitLabIntegrationBase } from './integration.js';
import { buildGitLabRoutes } from './routes.js';

function buildApp(
  gitlab: GitLabIntegrationBase,
  user: TestAuthUser | null,
  intake?: Parameters<typeof buildGitLabRoutes>[0]['intake'],
) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('factoryAuthUser' as never, user as never);
    await next();
  });
  mountApiRoutes(app, buildGitLabRoutes({ gitlab, auth: fakeRouteAuth({ enabled: true }), intake }));
  return app;
}

const orgUser = (): TestAuthUser => ({ workosId: 'u1', organizationId: 'org1' });

describe('GitLab webhook auth boundary', () => {
  it('passes an unauthenticated delivery through the auth gate to GitLab token verification', async () => {
    const app = new Hono();
    app.use('*', createFactoryAuthGate({} as never));
    const gitlab = new GitLabIntegration({ accessToken: 'group-token', webhookSecret: 'webhook-secret' });
    mountApiRoutes(
      app,
      buildGitLabRoutes({
        gitlab,
        auth: fakeRouteAuth({ enabled: true }),
        webhookSecret: 'webhook-secret',
      }),
    );

    const response = await app.request('/web/gitlab/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-gitlab-event': 'Pipeline Hook',
        'x-gitlab-token': 'webhook-secret',
      },
      body: '{}',
    });

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ ok: true, ignored: true });
  });
});

describe('GitLab UI routes', () => {
  it('serves Review MR candidates only for a repository linked to the caller-owned Factory', async () => {
    const gitlab = new GitLabIntegration({ accessToken: 'group-token' });
    vi.spyOn(gitlab, 'resolveOrgId').mockResolvedValue('org1');
    const linked = vi.spyOn(gitlab, 'getLinkedRepository').mockResolvedValue(null);
    const list = vi
      .spyOn(gitlab.versionControl, 'listPullRequests')
      .mockResolvedValue({ pullRequests: [], nextCursor: null });
    const target = vi.spyOn(gitlab.versionControl, 'getRepositoryTarget').mockResolvedValue({
      connection: { type: 'oauth', accessToken: 'gitlab-connection:direct' },
      sourceId: '10:acme/app',
    });
    const path = '/web/gitlab/projects/link-1/prs?factoryProjectId=factory-1&page=1';
    const absent = await buildApp(gitlab, orgUser()).request(path);
    expect(absent.status).toBe(404);
    expect(list).not.toHaveBeenCalled();

    linked.mockResolvedValue({ repository: { id: 'repo-1', externalId: '10' }, host: 'gitlab.com' } as never);
    list.mockResolvedValue({
      pullRequests: [
        {
          id: '5',
          title: 'Validate MR',
          url: 'https://gitlab.com/acme/app/-/merge_requests/5',
          author: 'rhys',
          assignees: [],
          requestedReviewers: [],
          body: 'description',
          state: 'open',
          draft: false,
          merged: false,
          mergeable: true,
          baseBranch: 'main',
          headBranch: 'feature',
          headSha: 'abc',
          createdAt: '2026-09-18T00:00:00Z',
          updatedAt: '2026-09-18T00:00:00Z',
        },
      ],
      nextCursor: null,
    });
    const response = await buildApp(gitlab, orgUser()).request(path);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.pullRequests[0]).toMatchObject({ number: 5, title: 'Validate MR' });
    expect(body.pullRequests[0].externalId).toMatch(/^gitlab-pr:/);
    expect(target).toHaveBeenCalledWith({ orgId: 'org1', repositoryId: 'repo-1' });
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ includeDrafts: false, cursor: '1' }));
  });

  it('reports direct server configuration without exposing credentials', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ id: 7, username: 'rhys' }), { status: 200 }));
    const gitlab = new GitLabIntegration({
      accessToken: 'group-token',
      baseUrl: 'https://gitlab.acme.test',
      fetchImpl,
    });

    const response = await buildApp(gitlab, orgUser()).request('/web/gitlab/status');

    expect(await response.json()).toEqual({
      enabled: true,
      configured: true,
      mode: 'direct',
      accounts: ['gitlab.acme.test'],
      reauthRequired: false,
      reason: 'ready',
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://gitlab.acme.test/api/v4/user',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('rejects an invalid configured direct token instead of reporting ready', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ message: '401 Unauthorized' }), { status: 401 }));
    const gitlab = new GitLabIntegration({ accessToken: 'revoked-token', fetchImpl });

    const response = await buildApp(gitlab, orgUser()).request('/web/gitlab/status');

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: 'gitlab_auth_failed' });
  });

  it('reports platform connections including reauthorization state', async () => {
    const gitlab = new PlatformGitLabIntegration({
      clientConfig: { baseUrl: 'https://integrations.example.com', accessToken: 'platform-token' },
      connectionId: 'a1b_old',
    });
    vi.spyOn(gitlab, 'listConnections').mockResolvedValue([
      { id: 'a1b_old', integrationId: 'gitlab', status: 'needs_reauth', accountLabel: 'old' },
    ]);

    const response = await buildApp(gitlab, orgUser()).request('/web/gitlab/status');

    expect(await response.json()).toMatchObject({
      enabled: true,
      configured: false,
      mode: 'platform',
      accounts: [],
      reauthRequired: true,
      reason: 'not_connected',
    });
  });

  it('lists projects without creating installation records', async () => {
    const gitlab = new GitLabIntegration({ accessToken: 'group-token' });
    const registerInstallation = vi.spyOn(gitlab.versionControl, 'registerInstallation').mockResolvedValue({
      id: 'gitlab-installation-1',
    } as never);
    vi.spyOn(gitlab.intake, 'listSources').mockResolvedValue([
      {
        id: 'gitlab-project:encoded',
        name: 'acme/app',
        type: 'project',
        metadata: {
          connectionId: 'direct',
          accountLabel: 'gitlab.com',
          projectId: '10',
          projectPath: 'acme/app',
          defaultBranch: 'main',
        },
      },
    ]);

    const response = await buildApp(gitlab, orgUser()).request('/web/gitlab/projects');

    expect(await response.json()).toEqual({
      projects: [
        {
          id: 'gitlab-project:encoded',
          name: 'acme/app',
          projectId: '10',
          projectPath: 'acme/app',
          connectionId: 'direct',
          accountLabel: 'gitlab.com',
          defaultBranch: 'main',
          sandboxProvider: 'none',
          sandboxWorkdir: '~/app',
        },
      ],
    });
    expect(registerInstallation).not.toHaveBeenCalled();
    expect(gitlab.intake.listSources).toHaveBeenCalledWith({ orgId: 'org1', userId: 'u1' });
  });

  it('creates the installation record only when a project is explicitly registered for linking', async () => {
    const gitlab = new GitLabIntegration({ accessToken: 'group-token' });
    const registerInstallation = vi.spyOn(gitlab.versionControl, 'registerInstallation').mockResolvedValue({
      id: 'gitlab-installation-1',
    } as never);
    vi.spyOn(gitlab.intake, 'listSources').mockResolvedValue([
      {
        id: 'gitlab-project:encoded',
        name: 'acme/app',
        type: 'project',
        metadata: {
          connectionId: 'direct',
          accountLabel: 'gitlab.com',
          projectId: '10',
          projectPath: 'acme/app',
          defaultBranch: 'main',
        },
      },
    ]);

    const response = await buildApp(gitlab, orgUser()).request('/web/gitlab/projects/registration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId: 'gitlab-project:encoded' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      project: { id: 'gitlab-project:encoded', installationStorageId: 'gitlab-installation-1' },
    });
    expect(registerInstallation).toHaveBeenCalledWith({
      orgId: 'org1',
      userId: 'u1',
      installation: {
        externalId: 'direct',
        accountName: 'gitlab.com',
        accountType: 'GitLab',
        metadata: { connection: { type: 'oauth', accessToken: 'gitlab-connection:direct' } },
      },
    });
  });
  it('migrates legacy connection-bound selections and bindings to canonical project identity', async () => {
    const gitlab = new GitLabIntegration({ accessToken: 'group-token' });
    const legacyId = encodeSourceId({ connectionId: 'direct', projectId: '10', projectPath: 'acme/old-app' });
    const canonicalId = encodeSourceId({ host: 'gitlab.com', projectId: '10' });
    vi.spyOn(gitlab.versionControl, 'registerInstallation').mockResolvedValue({
      id: 'gitlab-installation-1',
    } as never);
    vi.spyOn(gitlab.intake, 'listSources').mockResolvedValue([
      {
        id: canonicalId,
        name: 'acme/app',
        type: 'project',
        metadata: {
          connectionId: 'direct',
          accountLabel: 'gitlab.com',
          projectId: '10',
          projectPath: 'acme/app',
          defaultBranch: 'main',
        },
      },
    ]);
    const intake = {
      ensureReady: vi.fn(),
      getConfig: vi.fn().mockResolvedValue({
        github: { enabled: false, sourceIds: null },
        gitlab: { enabled: true, sourceIds: [legacyId, canonicalId] },
      }),
      listBindings: vi
        .fn()
        .mockResolvedValue([
          { integrationId: 'gitlab', sourceId: legacyId, factoryProjectId: 'factory-1', board: 'work' },
        ]),
      migrateSourceIds: vi.fn().mockResolvedValue({
        migrations: [{ from: legacyId, to: canonicalId }],
        conflicts: [],
      }),
    };

    const response = await buildApp(gitlab, orgUser(), intake as never).request('/web/gitlab/projects');

    expect(response.status).toBe(200);
    expect(intake.migrateSourceIds).toHaveBeenCalledWith({
      orgId: 'org1',
      integrationId: 'gitlab',
      migrations: [{ from: legacyId, to: canonicalId }],
    });
  });

  it('lists only selected GitLab sources routed to the caller-owned Factory', async () => {
    const gitlab = new GitLabIntegration({ accessToken: 'group-token' });
    const factoryProjectId = '11111111-1111-4111-8111-111111111111';
    const sourceId = encodeSourceId({ connectionId: 'direct', projectId: '10', projectPath: 'acme/app' });
    vi.spyOn(gitlab, 'resolveOrgId').mockResolvedValue('org1');
    vi.spyOn(gitlab.intake, 'listIssues').mockResolvedValue({
      issues: [
        {
          id: '42',
          identifier: 'acme/app#42',
          title: 'Fix routed intake',
          url: 'https://gitlab.com/acme/app/-/issues/42',
          author: 'grace',
          state: 'opened',
          stateType: 'unstarted',
          priority: null,
          assignee: null,
          assignees: [],
          source: 'acme/app',
          sourceId,
          labels: [],
          commentCount: 0,
          createdAt: '2026-09-01T00:00:00Z',
          updatedAt: '2026-09-01T00:00:00Z',
        },
      ],
      nextCursor: null,
    });
    const intake = {
      ensureReady: vi.fn(),
      getConfig: vi.fn().mockResolvedValue({ gitlab: { enabled: true, sourceIds: [sourceId, 'other'] } }),
      listBindings: vi.fn().mockResolvedValue([
        { integrationId: 'gitlab', sourceId, factoryProjectId, board: 'work' },
        { integrationId: 'gitlab', sourceId: 'other', factoryProjectId, board: 'planning' },
      ]),
    } as unknown as NonNullable<Parameters<typeof buildGitLabRoutes>[0]['intake']>;

    const response = await buildApp(gitlab, orgUser(), intake).request(
      '/web/gitlab/issues?factoryProjectId=' + factoryProjectId + '&board=work',
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(decodeIssueReference(body.issues[0].externalId)).toMatchObject({ projectId: '10', issueIid: 42 });
    expect(gitlab.intake.listIssues).toHaveBeenCalledWith(expect.objectContaining({ sourceIds: [sourceId] }));
  });

  it('loads details only for a selected GitLab source routed to the caller-owned Factory', async () => {
    const gitlab = new GitLabIntegration({ accessToken: 'group-token' });
    const factoryProjectId = '11111111-1111-4111-8111-111111111111';
    const source = { host: 'gitlab.com', projectId: '10' };
    const sourceId = encodeSourceId(source);
    const issueId = encodeIssueReference({ ...source, issueIid: 42 });
    vi.spyOn(gitlab, 'resolveOrgId').mockResolvedValue('org1');
    vi.spyOn(gitlab.intake, 'getIssue').mockResolvedValue({
      id: '42',
      identifier: 'acme/app#42',
      title: 'Fix routed intake',
      url: 'https://gitlab.com/acme/app/-/issues/42',
      author: 'grace',
      state: 'opened',
      stateType: 'unstarted',
      priority: null,
      assignee: null,
      assignees: [],
      source: 'acme/app',
      sourceId,
      labels: [],
      commentCount: 1,
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
      description: 'The GitLab issue description.',
      comments: [{ author: 'grace', body: 'One note', createdAt: '2026-09-01T01:00:00Z' }],
    });
    const intake = {
      ensureReady: vi.fn(),
      getConfig: vi.fn().mockResolvedValue({ gitlab: { enabled: true, sourceIds: [sourceId] } }),
      listBindings: vi.fn().mockResolvedValue([{ integrationId: 'gitlab', sourceId, factoryProjectId, board: 'work' }]),
    } as unknown as NonNullable<Parameters<typeof buildGitLabRoutes>[0]['intake']>;

    const response = await buildApp(gitlab, orgUser(), intake).request(
      '/web/gitlab/issues/' + encodeURIComponent(issueId) + '?factoryProjectId=' + factoryProjectId,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      identifier: 'acme/app#42',
      description: 'The GitLab issue description.',
      comments: [{ author: 'grace', body: 'One note' }],
    });
    expect(gitlab.intake.getIssue).toHaveBeenCalledWith(expect.objectContaining({ issueId }));
  });

  it('does not load details from a GitLab source outside the Factory routing', async () => {
    const gitlab = new GitLabIntegration({ accessToken: 'group-token' });
    const factoryProjectId = '11111111-1111-4111-8111-111111111111';
    const source = { connectionId: 'direct', projectId: '10', projectPath: 'acme/app' };
    const sourceId = encodeSourceId(source);
    const issueId = encodeIssueReference({ ...source, issueIid: 42 });
    vi.spyOn(gitlab, 'resolveOrgId').mockResolvedValue('org1');
    const getIssue = vi.spyOn(gitlab.intake, 'getIssue');
    const intake = {
      ensureReady: vi.fn(),
      getConfig: vi.fn().mockResolvedValue({ gitlab: { enabled: true, sourceIds: [sourceId] } }),
      listBindings: vi.fn().mockResolvedValue([]),
    } as unknown as NonNullable<Parameters<typeof buildGitLabRoutes>[0]['intake']>;

    const response = await buildApp(gitlab, orgUser(), intake).request(
      '/web/gitlab/issues/' + encodeURIComponent(issueId) + '?factoryProjectId=' + factoryProjectId,
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'gitlab_issue_not_routed' });
    expect(getIssue).not.toHaveBeenCalled();
  });

  it('maps rejected credentials to a reconnectable auth error', async () => {
    const gitlab = new GitLabIntegration({ accessToken: 'group-token' });
    vi.spyOn(gitlab.intake, 'listSources').mockRejectedValue(new GitLabApiError('GitLab rejected the token.', 403));

    const response = await buildApp(gitlab, orgUser()).request('/web/gitlab/projects');

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'gitlab_auth_failed', message: 'GitLab rejected the token.' });
  });

  it('rejects unauthenticated and personal-account project requests', async () => {
    const gitlab = new GitLabIntegration({ accessToken: 'group-token' });

    expect((await buildApp(gitlab, null).request('/web/gitlab/projects')).status).toBe(401);
    expect((await buildApp(gitlab, { workosId: 'u1' }).request('/web/gitlab/projects')).status).toBe(403);
  });
});

describe('GitLab subscriptions route', () => {
  const row = {
    id: 'subscription-1',
    orgId: 'org1',
    targetKey: 'change-request:gitlab:gitlab.example.com:101:17',
    sessionId: 'session-1',
    resourceId: 'resource-1',
    threadId: 'thread-1',
    sessionScope: '/tmp/worktree',
    status: 'open',
    data: {
      host: 'gitlab.example.com',
      projectId: '101',
      projectPath: 'acme/app',
      projectRepositoryId: 'link-1',
      installationExternalId: 'direct',
      changeRequestId: '17',
      ownerId: 'u1',
      source: 'explicit-tool',
      subscribedByUserId: 'u1',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const subscribedGitLab = () => {
    const gitlab = new GitLabIntegration({ accessToken: 'group-token' });
    gitlab.initialize({
      storage: {
        subscriptions: { listByThread: vi.fn(async () => [row, { ...row, id: 'other-org', orgId: 'org2' }]) },
      } as never,
      projects: {} as never,
      auth: fakeRouteAuth({ enabled: true }),
    });
    return gitlab;
  };

  it('requires an organization user and both thread coordinates', async () => {
    const gitlab = subscribedGitLab();
    expect(
      (await buildApp(gitlab, null).request('/web/gitlab/subscriptions?resourceId=resource-1&threadId=thread-1'))
        .status,
    ).toBe(401);
    expect(
      (
        await buildApp(gitlab, { workosId: 'u1' }).request(
          '/web/gitlab/subscriptions?resourceId=resource-1&threadId=thread-1',
        )
      ).status,
    ).toBe(401);
    expect((await buildApp(gitlab, orgUser()).request('/web/gitlab/subscriptions?resourceId=resource-1')).status).toBe(
      400,
    );
  });

  it("lists the caller organization's subscriptions for the thread in the shared link shape", async () => {
    const response = await buildApp(subscribedGitLab(), orgUser()).request(
      '/web/gitlab/subscriptions?resourceId=resource-1&threadId=thread-1&scope=%2Ftmp%2Fworktree',
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      subscriptions: [
        {
          id: 'subscription-1',
          repoFullName: 'acme/app',
          pullRequestNumber: 17,
          status: 'open',
          url: 'https://gitlab.example.com/acme/app/-/merge_requests/17',
        },
      ],
    });
  });
});
