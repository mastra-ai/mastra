import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import type { IntegrationContext } from '../../base.js';
import { startFakePlatform } from '../foundation/test-utils.js';
import type { FakePlatform } from '../foundation/test-utils.js';
import { createPlatformStorageForTests, mountApiRoutes } from '../test-utils.js';
import { FACTORY_GITHUB_PROVIDER_KEY, FACTORY_REVIEWS_GITHUB_PROVIDER_KEY } from './connect-events.js';
import {
  PlatformGithubConnectionInactiveError,
  PlatformGithubInstallationNotFoundError,
  PlatformGithubIntegration,
} from './integration.js';
import { PlatformGithubModes } from './mode.js';
import type { PlatformGithubModeStorage } from './mode.js';
import { startFakeGithub } from './test-utils.js';
import type { FakeGithub } from './test-utils.js';
import { setGithubUserPat } from './user-pat.js';

const FUTURE = '2099-01-01T00:00:00.000Z';

const rawPullRequest = (number: number, login: string) => ({
  number,
  title: 'Fix',
  body: 'Body',
  state: 'open',
  html_url: `https://github.com/acme/app/pull/${number}`,
  merged: false,
  mergeable: null,
  draft: false,
  head: { ref: 'fix', sha: 'h1' },
  base: { ref: 'main', repo: { id: 101, full_name: 'acme/app' } },
  user: { login, avatar_url: '', html_url: '' },
  assignees: [],
  requested_reviewers: [],
  created_at: '2026-11-13T10:00:00Z',
  updated_at: '2026-11-13T10:00:00Z',
});

function connection(platform: FakePlatform, id: string, integrationId: string, extra: { resourceId?: string } = {}) {
  platform.orgConnections.push({ id, integrationId, status: 'active', ...extra });
  platform.linked.add(id);
}

async function setup(
  options: {
    reviewsActive?: boolean;
    users?: Record<string, string>;
    /** Valid PATs and the GitHub login each belongs to. */
    pats?: Record<string, string>;
    /** Makes the org's recorded `factory-github` connection an end-user one. */
    orgGithubResourceId?: string;
  } = {},
) {
  const platform = await startFakePlatform();
  const github: FakeGithub = await startFakeGithub();
  connection(
    platform,
    'conn-github',
    FACTORY_GITHUB_PROVIDER_KEY,
    options.orgGithubResourceId ? { resourceId: options.orgGithubResourceId } : {},
  );
  if (options.reviewsActive !== false) connection(platform, 'conn-reviews', FACTORY_REVIEWS_GITHUB_PROVIDER_KEY);
  platform.credentials.set('conn-github', { type: 'oauth2', accessToken: 'tok-github', expiresAt: FUTURE });
  platform.credentials.set('conn-reviews', { type: 'oauth2', accessToken: 'tok-reviews', expiresAt: FUTURE });
  const logins = new Map<string, string>();
  for (const [userId, login] of Object.entries(options.users ?? {})) {
    const id = `conn-user-${userId}`;
    connection(platform, id, FACTORY_GITHUB_PROVIDER_KEY, { resourceId: userId });
    platform.credentials.set(id, { type: 'oauth2', accessToken: `tok-${userId}`, expiresAt: FUTURE });
    logins.set(`tok-${userId}`, login);
  }
  for (const [token, login] of Object.entries(options.pats ?? {})) logins.set(token, login);

  const seed = await createPlatformStorageForTests();
  const integration = new PlatformGithubIntegration({ connect: platform.connect(), githubApiUrl: github.baseUrl });
  const generic = seed.integrations.forIntegration('github');
  integration.initialize?.({ storage: generic });
  integration.versionControl.initialize({ storage: seed.sourceControl.forIntegration('github') });
  await new PlatformGithubModes(() => generic as unknown as PlatformGithubModeStorage).saveConnect('org-1', {
    switchedAt: Date.parse('2026-11-13T00:00:00.000Z'),
    switchedBy: 'admin-1',
    installations: [
      { accountLogin: 'acme', installationId: 900, connectionId: 'conn-github', reviewsConnectionId: 'conn-reviews' },
    ],
  });

  const pulls: unknown[] = [];
  github.route = request => {
    if (request.path === '/user') {
      return request.token && logins.has(request.token)
        ? { status: 200, body: { login: logins.get(request.token) } }
        : { status: 401, body: { message: 'Bad credentials' } };
    }
    if (request.method === 'GET' && request.path === '/repos/acme/app/pulls') return { status: 200, body: pulls };
    if (request.method === 'POST' && request.path === '/repos/acme/app/pulls') {
      const author = request.token === 'tok-github' ? 'mastra-factory[bot]' : logins.get(request.token ?? '');
      return {
        status: 201,
        body: { ...rawPullRequest(7, author ?? 'ghost'), body: (request.body as { body?: string }).body },
      };
    }
    if (request.method === 'POST' && request.path === '/repos/acme/app/issues/7/assignees') {
      return {
        status: 201,
        body: { assignees: (request.body as { assignees: string[] }).assignees.map(login => ({ login })) },
      };
    }
    return undefined;
  };
  /** Calls the integration's routes as a signed-in user of org-1. */
  const asUser = (userId: string) => {
    const context = {
      auth: {
        enabled: () => true,
        ensureUser: vi.fn(async () => ({ workosId: userId, organizationId: 'org-1' })),
        tenant: () => ({ orgId: 'org-1', userId }),
        isOrganizationAdmin: vi.fn(async () => false),
      },
      sandbox: { enabled: true, provider: 'stub' },
      storage: { generic, sourceControl: seed.sourceControl.forIntegration('github'), projects: seed.projects },
      controller: {},
      stateSigner: {},
      baseUrl: 'https://factory.example',
    } as unknown as IntegrationContext;
    const app = new Hono();
    mountApiRoutes(app as never, integration.routes(context));
    return app;
  };
  return { platform, github, integration, asUser, generic, storage: seed.sourceControl.forIntegration('github') };
}

const openPullRequest = (integration: PlatformGithubIntegration, actingUserId: string) =>
  integration.versionControl.createPullRequest({
    connection: switchedConnection,
    sourceId: 'acme/app',
    headBranch: 'fix',
    baseBranch: 'main',
    title: 'Fix',
    body: 'Body',
    actingUserId,
  });

const switchedConnection = { type: 'app-installation' as const, installationId: 900, orgId: 'org-1' };

describe('PlatformGithubIntegration in connect mode', () => {
  it('calls GitHub with the factory-github token, never the legacy routes', async () => {
    const { platform, github, integration } = await setup();
    await integration.versionControl.listPullRequests({ connection: switchedConnection, sourceId: 'acme/app' });

    expect(github.calls('/repos/acme/app/pulls', 'GET').map(request => request.token)).toEqual(['tok-github']);
    expect(platform.requests.filter(request => request.path.startsWith('/v1/server'))).toEqual([]);
  });

  it('finds the installation by its id, or by the repository owner for a placeholder connection', async () => {
    const { github, integration } = await setup();
    // No org on the connection: the installation index names it.
    await integration.versionControl.listPullRequests({
      connection: { type: 'app-installation', installationId: 900 },
      sourceId: 'acme/app',
    });
    // Intake's placeholder installation id never matches; the owner does.
    await integration.versionControl.listPullRequests({
      connection: { type: 'app-installation', installationId: 1, orgId: 'org-1' },
      sourceId: 'acme/app',
    });
    expect(github.calls('/repos/acme/app/pulls', 'GET')).toHaveLength(2);
  });

  it('refuses a repository none of the switched installations serves', async () => {
    const { github, integration } = await setup();
    await expect(
      integration.versionControl.listPullRequests({
        connection: { type: 'app-installation', installationId: 1, orgId: 'org-1' },
        sourceId: 'other/app',
      }),
    ).rejects.toBeInstanceOf(PlatformGithubInstallationNotFoundError);
    expect(github.requests).toEqual([]);
  });

  it('refuses when one of the two app connections is no longer active, never falling back to legacy', async () => {
    const { platform, github, integration } = await setup({ reviewsActive: false });
    await expect(
      integration.versionControl.listPullRequests({ connection: switchedConnection, sourceId: 'acme/app' }),
    ).rejects.toBeInstanceOf(PlatformGithubConnectionInactiveError);
    expect(github.requests).toEqual([]);
    expect(platform.requests.filter(request => request.path.startsWith('/v1/server'))).toEqual([]);
  });

  it('hands an agent sandbox a token scoped to its repository, never an installation-wide one', async () => {
    const { platform, integration, storage } = await setup();
    const installation = await integration.versionControl.registerInstallation({
      orgId: 'org-1',
      userId: 'user-1',
      installation: { externalId: '900', accountName: 'acme', accountType: 'Organization' },
    });
    const [repository] = await integration.versionControl.registerRepositories({
      orgId: 'org-1',
      installationId: installation.id,
      repositories: [{ externalId: '101', slug: 'acme/app', defaultBranch: 'main' }],
    });
    expect(await storage.repositories.get({ orgId: 'org-1', id: repository!.id })).not.toBeNull();

    const access = await integration.versionControl.getRepositoryAccess({
      orgId: 'org-1',
      repositoryId: repository!.id,
    });

    expect(access?.authorization).toEqual({ scheme: 'bearer', token: 'tok-github@app' });
    expect(platform.requests.filter(request => request.path.includes('token'))).toEqual([
      {
        method: 'POST',
        path: '/v2/connections/conn-github/github/installation-token',
        body: {
          repositories: ['app'],
          permissions: {
            actions: 'read',
            checks: 'read',
            contents: 'write',
            issues: 'write',
            pull_requests: 'write',
            statuses: 'read',
          },
        },
      },
    ]);
    expect(platform.requests.filter(request => request.path.endsWith('/credentials'))).toEqual([]);
  });

  it("won't mint a sandbox token through an app connection that is no longer active", async () => {
    const { platform, integration } = await setup({ reviewsActive: false });
    const installation = await integration.versionControl.registerInstallation({
      orgId: 'org-1',
      userId: 'user-1',
      installation: { externalId: '900', accountName: 'acme', accountType: 'Organization' },
    });
    const [repository] = await integration.versionControl.registerRepositories({
      orgId: 'org-1',
      installationId: installation.id,
      repositories: [{ externalId: '101', slug: 'acme/app', defaultBranch: 'main' }],
    });

    await expect(
      integration.versionControl.getRepositoryAccess({ orgId: 'org-1', repositoryId: repository!.id }),
    ).rejects.toBeInstanceOf(PlatformGithubConnectionInactiveError);
    expect(platform.requests.filter(request => request.path.includes('token'))).toEqual([]);
  });

  it('opens a pull request as the app, naming the acting user by their GitHub login, and has the app assign them', async () => {
    const { github, integration } = await setup({ users: { 'user-1': 'octocat' } });
    const created = await integration.versionControl.createPullRequest({
      connection: switchedConnection,
      sourceId: 'acme/app',
      headBranch: 'fix',
      baseBranch: 'main',
      title: 'Fix',
      body: 'Body',
      actingUserId: 'user-1',
    });

    // Legacy parity: the pull request stays Factory-authored, so Factory's rules still treat it as its own.
    const [request] = github.calls('/repos/acme/app/pulls', 'POST');
    expect(request?.token).toBe('tok-github');
    expect((request?.body as { body: string }).body).toBe('> Opened by @octocat\n\nBody');
    expect(github.calls('/repos/acme/app/issues/7/assignees', 'POST')).toEqual([
      expect.objectContaining({ token: 'tok-github', body: { assignees: ['octocat'] } }),
    ]);
    expect(created.assignees).toEqual(['octocat']);
  });

  it('opens a pull request as the app, naming the acting user, when they have not connected GitHub', async () => {
    const { github, integration } = await setup();
    await integration.versionControl.createPullRequest({
      connection: switchedConnection,
      sourceId: 'acme/app',
      headBranch: 'fix',
      baseBranch: 'main',
      title: 'Fix',
      body: 'Body',
      actingUserId: 'user-1',
    });

    const [request] = github.calls('/repos/acme/app/pulls', 'POST');
    expect(request?.token).toBe('tok-github');
    expect((request?.body as { body: string }).body).toMatch(/^> Opened by @user-1\n/);
    expect(github.calls('/repos/acme/app/issues/7/assignees', 'POST')).toEqual([]);
  });

  it('keeps two orgs switched to the same installation apart, and never routes a legacy installation to the apps', async () => {
    const { platform, github, integration, generic } = await setup({ pats: { 'pat-org2': 'hubot' } });
    const modes = new PlatformGithubModes(() => generic as unknown as PlatformGithubModeStorage, { cacheTtlMs: 0 });
    // Every tenant sees the project's app connections, so a second org can switch to installation 900 too.
    await modes.saveConnect('org-2', {
      switchedAt: Date.parse('2026-11-14T00:00:00.000Z'),
      installations: [
        { accountLogin: 'acme', installationId: 900, connectionId: 'conn-github', reviewsConnectionId: 'conn-reviews' },
      ],
    });
    await setGithubUserPat(generic as never, 'org-2', 'user-1', 'pat-org2', 'hubot');
    await expect(modes.orgsForInstallation(900)).resolves.toEqual(['org-1', 'org-2']);

    // The same person is named per the org the call is made in: their org-2 PAT never leaks into org-1.
    for (const orgId of ['org-1', 'org-2']) {
      await integration.versionControl.createPullRequest({
        connection: { type: 'app-installation', installationId: 900, orgId },
        sourceId: 'acme/app',
        headBranch: 'fix',
        baseBranch: 'main',
        title: 'Fix',
        body: 'Body',
        actingUserId: 'user-1',
      });
    }
    expect(
      github
        .calls('/repos/acme/app/pulls', 'POST')
        .map(request => (request.body as { body: string }).body.split('\n')[0]),
    ).toEqual(['> Opened by @user-1', '> Opened by @hubot']);

    // A call that doesn't name its org still reaches the installation through the apps.
    await integration.versionControl.listPullRequests({
      connection: { type: 'app-installation', installationId: 900 },
      sourceId: 'acme/app',
    });
    expect(github.calls('/repos/acme/app/pulls', 'GET').map(request => request.token)).toEqual(['tok-github']);

    // A legacy app installation is never claimed, so it stays on the legacy routes.
    await integration.versionControl
      .listPullRequests({ connection: { type: 'app-installation', installationId: 7 }, sourceId: 'acme/app' })
      .catch(() => undefined);
    expect(github.calls('/repos/acme/app/pulls', 'GET')).toHaveLength(1);
    expect(platform.requests.some(request => request.path.startsWith('/v1/server/github'))).toBe(true);
  });

  it("never treats a user's end-user factory-github connection as the org's", async () => {
    const { integration } = await setup({ orgGithubResourceId: 'user-1' });

    await expect(
      integration.versionControl.listPullRequests({ connection: switchedConnection, sourceId: 'acme/app' }),
    ).rejects.toBeInstanceOf(PlatformGithubConnectionInactiveError);
  });

  describe("a user's own GitHub PAT", () => {
    const save = (app: Hono, token: string) =>
      app.request('/web/github/user-pat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      });

    it('checks it with GitHub, keeps it per user, and never sends it back', async () => {
      const { asUser } = await setup({ pats: { 'pat-good': 'hubot' } });
      const ada = asUser('user-1');

      const saved = await save(ada, 'pat-good');
      const text = await saved.text();
      expect(saved.status).toBe(200);
      expect(JSON.parse(text)).toEqual({ configured: true, login: 'hubot' });
      expect(text).not.toContain('pat-good');

      await expect((await ada.request('/web/github/user-pat')).json()).resolves.toEqual({
        configured: true,
        login: 'hubot',
      });
      await expect((await asUser('user-2').request('/web/github/user-pat')).json()).resolves.toEqual({
        configured: false,
        login: null,
      });
    });

    it('refuses a token GitHub rejects, and stores nothing', async () => {
      const { asUser } = await setup();
      const ada = asUser('user-1');

      const saved = await save(ada, 'pat-bad');
      expect(saved.status).toBe(400);
      await expect((await ada.request('/web/github/user-pat')).json()).resolves.toEqual({
        configured: false,
        login: null,
      });
    });

    it('names the user by the login of their saved token, and stops once it is removed', async () => {
      const { github, integration, asUser } = await setup({ pats: { 'pat-good': 'hubot' } });
      const ada = asUser('user-1');

      // Remembered "no token" must not outlive saving one.
      await openPullRequest(integration, 'user-1');
      expect((await save(ada, 'pat-good')).status).toBe(200);
      await openPullRequest(integration, 'user-1');
      expect((await ada.request('/web/github/user-pat', { method: 'DELETE' })).status).toBe(200);
      await openPullRequest(integration, 'user-1');

      const opened = github.calls('/repos/acme/app/pulls', 'POST');
      expect(opened.map(request => request.token)).toEqual(['tok-github', 'tok-github', 'tok-github']);
      expect(opened.map(request => (request.body as { body: string }).body.split('\n')[0])).toEqual([
        '> Opened by @user-1',
        '> Opened by @hubot',
        '> Opened by @user-1',
      ]);
      expect(github.calls('/repos/acme/app/issues/7/assignees', 'POST')).toEqual([
        expect.objectContaining({ token: 'tok-github', body: { assignees: ['hubot'] } }),
      ]);
    });
  });

  describe("a user's own GitHub connection", () => {
    it("shows each user their own end-user connection, never the org's or another user's", async () => {
      const { asUser } = await setup({ users: { 'user-1': 'ada' } });

      const ada = await (await asUser('user-1').request('/web/github/user-connection')).json();
      expect(ada).toEqual({
        connection: { id: 'conn-user-user-1', status: 'active', accountLabel: null },
        pat: { configured: false, login: null },
      });
      const grace = await (await asUser('user-2').request('/web/github/user-connection')).json();
      expect(grace).toEqual({ connection: null, pat: { configured: false, login: null } });
    });

    it('starts a factory-github connect session scoped to the signed-in user', async () => {
      const { platform, asUser } = await setup();

      const response = await asUser('user-1').request('/web/github/user-connection/connect-session', {
        method: 'POST',
      });
      expect(response.status).toBe(201);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.json()).toMatchObject({ integrationId: FACTORY_GITHUB_PROVIDER_KEY });
      expect(
        platform.requests.filter(request => request.method === 'POST' && request.path.endsWith('/connect-sessions')),
      ).toEqual([expect.objectContaining({ path: expect.stringContaining('/factory-github/'), resourceId: 'user-1' })]);
    });
  });
});
