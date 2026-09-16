import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { createFactoryAuthGate } from '../../auth.js';
import { fakeRouteAuth, mountApiRoutes } from '../../routes/test-utils.js';
import type { TestAuthUser } from '../../routes/test-utils.js';
import { PlatformGitLabIntegration } from '../platform/gitlab/integration.js';
import { GitLabApiError } from './api.js';
import { decodeIssueReference, encodeSourceId, GitLabIntegration } from './integration.js';
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
  it('reports direct server configuration without exposing credentials', async () => {
    const gitlab = new GitLabIntegration({ accessToken: 'group-token', baseUrl: 'https://gitlab.acme.test' });

    const response = await buildApp(gitlab, orgUser()).request('/web/gitlab/status');

    expect(await response.json()).toEqual({
      enabled: true,
      configured: true,
      accounts: ['gitlab.acme.test'],
      reauthRequired: false,
      reason: 'ready',
    });
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
      accounts: [],
      reauthRequired: true,
      reason: 'not_connected',
    });
  });

  it('lists projects for the authenticated organization', async () => {
    const gitlab = new GitLabIntegration({ accessToken: 'group-token' });
    vi.spyOn(gitlab.intake, 'listSources').mockResolvedValue([
      {
        id: 'gitlab-project:encoded',
        name: 'acme/app',
        type: 'project',
        metadata: {
          connectionId: 'direct',
          accountLabel: 'gitlab.com',
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
          connectionId: 'direct',
          accountLabel: 'gitlab.com',
          defaultBranch: 'main',
        },
      ],
    });
    expect(gitlab.intake.listSources).toHaveBeenCalledWith({ orgId: 'org1', userId: 'u1' });
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
    expect(gitlab.intake.listIssues).toHaveBeenCalledWith(
      expect.objectContaining({ sourceIds: [sourceId] }),
    );
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
