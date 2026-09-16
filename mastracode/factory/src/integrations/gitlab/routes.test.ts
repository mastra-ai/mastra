import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { fakeRouteAuth, mountApiRoutes } from '../../routes/test-utils.js';
import type { TestAuthUser } from '../../routes/test-utils.js';
import { PlatformApiClient } from '../platform/api-client.js';
import { PlatformGitLabIntegration } from '../platform/gitlab/integration.js';
import { GitLabApiError } from './api.js';
import { GitLabIntegration } from './integration.js';
import type { GitLabIntegrationBase } from './integration.js';
import { buildGitLabRoutes } from './routes.js';

function buildApp(gitlab: GitLabIntegrationBase, user: TestAuthUser | null) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('factoryAuthUser' as never, user as never);
    await next();
  });
  mountApiRoutes(app, buildGitLabRoutes({ gitlab, auth: fakeRouteAuth({ enabled: true }) }));
  return app;
}

const orgUser = (): TestAuthUser => ({ workosId: 'u1', organizationId: 'org1' });

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
      client: new PlatformApiClient({ baseUrl: 'https://integrations.example.com', accessToken: 'platform-token' }),
    });
    vi.spyOn(gitlab, 'listConnections').mockResolvedValue([
      { id: 'a1b_acme', integrationId: 'gitlab', status: 'active', accountLabel: 'acme' },
      { id: 'a1b_old', integrationId: 'gitlab', status: 'needs_reauth', accountLabel: 'old' },
    ]);

    const response = await buildApp(gitlab, orgUser()).request('/web/gitlab/status');

    expect(await response.json()).toMatchObject({
      enabled: true,
      configured: true,
      accounts: ['acme'],
      reauthRequired: true,
      reason: 'ready',
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

  it('maps rejected credentials to a reconnectable auth error', async () => {
    const gitlab = new GitLabIntegration({ accessToken: 'group-token' });
    vi.spyOn(gitlab.intake, 'listSources').mockRejectedValue(new GitLabApiError('GitLab rejected the token.', 401));

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
