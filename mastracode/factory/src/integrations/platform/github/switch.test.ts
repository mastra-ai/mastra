import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBoardRegistry } from '../../../boards/registry.js';
import type { IntegrationContext } from '../../base.js';
import { GithubReconcileWorker } from '../../github/reconcile-worker.js';
import { listPullRequestSubscriptionsForWebhook, subscribeToPullRequest } from '../../github/subscriptions.js';
import type { GithubSubscriptionStorage } from '../../github/subscriptions.js';
import { startFakePlatform } from '../foundation/test-utils.js';
import type { FakePlatform } from '../foundation/test-utils.js';
import { createPlatformStorageForTests, mountApiRoutes } from '../test-utils.js';
import { FACTORY_GITHUB_PROVIDER_KEY, FACTORY_REVIEWS_GITHUB_PROVIDER_KEY } from './connect-events.js';
import { PlatformGithubIntegration } from './integration.js';
import { PlatformGithubModes } from './mode.js';
import type { PlatformGithubModeStorage } from './mode.js';
import { startFakeGithub } from './test-utils.js';

const FUTURE = '2099-01-01T00:00:00.000Z';

interface AppInstall {
  installationId: number;
  account: string;
  /** GitHub repository ids the installation reaches. */
  repositories: number[];
}

/**
 * An org on the legacy GitHub App with installation 7 on `acme`, whose
 * repository 101 (`acme/app`) is linked to a project, and the Mastra Factory
 * apps installed as the options say.
 */
async function setup(
  options: {
    github?: AppInstall | null;
    reviews?: AppInstall | null;
    admin?: boolean;
  } = {},
) {
  const platform: FakePlatform = await startFakePlatform();
  const github = await startFakeGithub();
  const apps: Record<string, AppInstall | null> = {
    'tok-github':
      options.github === undefined
        ? { installationId: 900, account: 'acme', repositories: [101, 102] }
        : options.github,
    'tok-reviews':
      options.reviews === undefined
        ? { installationId: 901, account: 'acme', repositories: [101, 102] }
        : options.reviews,
  };
  const addApp = (id: string, integrationId: string, token: string, app: AppInstall | null) => {
    if (!app) return;
    platform.orgConnections.push({ id, integrationId, status: 'active' });
    platform.linked.add(id);
    platform.credentials.set(id, { type: 'oauth2', accessToken: token, expiresAt: FUTURE });
    platform.contexts.set(id, { connection_config: { installation_id: String(app.installationId) }, metadata: null });
  };
  addApp('conn-github', FACTORY_GITHUB_PROVIDER_KEY, 'tok-github', apps['tok-github']);
  addApp('conn-reviews', FACTORY_REVIEWS_GITHUB_PROVIDER_KEY, 'tok-reviews', apps['tok-reviews']);
  github.route = request => {
    if (request.method !== 'GET' || request.path !== '/installation/repositories') return undefined;
    const app = apps[request.token ?? ''];
    if (!app) return { status: 401, body: { message: 'Bad credentials' } };
    return {
      status: 200,
      body: {
        total_count: app.repositories.length,
        repositories: app.repositories.map(id => ({
          id,
          full_name: `${app.account}/repo-${id}`,
          owner: { login: app.account, type: 'Organization' },
        })),
      },
    };
  };

  const seed = await createPlatformStorageForTests();
  const generic = seed.integrations.forIntegration('github');
  const sourceControl = seed.sourceControl.forIntegration('github');
  const integration = new PlatformGithubIntegration({ connect: platform.connect(), githubApiUrl: github.baseUrl });
  integration.initialize?.({ storage: generic });
  integration.versionControl.initialize({ storage: sourceControl });

  const projects: Record<string, string> = {};
  for (const name of ['proj-1', 'proj-2']) {
    projects[name] = (await seed.projects.create({ orgId: 'org-1', userId: 'admin-1', input: { name } })).id;
  }
  const legacy = await sourceControl.installations.upsert({
    orgId: 'org-1',
    connectedByUserId: 'admin-1',
    externalId: '7',
    accountName: 'acme',
    accountType: 'Organization',
  });
  const linkRepository = async (installationId: string, externalId: string, slug: string, project = 'proj-1') => {
    const repository = await sourceControl.repositories.upsert({
      orgId: 'org-1',
      input: { installationId, externalId, slug, defaultBranch: 'main' },
    });
    const factoryProjectId = projects[project]!;
    const existing = (await sourceControl.connections.list({ orgId: 'org-1', factoryProjectId })).find(
      candidate => candidate.installationId === installationId,
    );
    const connection =
      existing ??
      (await sourceControl.connections.create({
        orgId: 'org-1',
        factoryProjectId,
        installationId,
        createdByUserId: 'admin-1',
      }));
    const link = await sourceControl.projectRepositories.link({
      orgId: 'org-1',
      connectionId: connection.id,
      repositoryId: repository.id,
      createdByUserId: 'admin-1',
      sandboxProvider: 'stub',
      sandboxWorkdir: '/work',
    });
    return { repository, connection, link };
  };
  const linked = await linkRepository(legacy.id, '101', 'acme/app');

  const emitAudit = vi.fn(async () => {});
  const context = {
    auth: {
      enabled: () => true,
      ensureUser: vi.fn(async () => ({ workosId: 'admin-1', organizationId: 'org-1' })),
      tenant: () => ({ orgId: 'org-1', userId: 'admin-1' }),
      isOrganizationAdmin: vi.fn(async () => options.admin ?? true),
    },
    hooks: { emitAudit },
    sandbox: { enabled: true, provider: 'stub' },
    storage: { generic, sourceControl, projects: seed.projects },
    factoryStorage: seed.storage,
    runtime: { configVersion: 'test-rules', workItems: seed.workItems, boards: createBoardRegistry() },
    controller: {},
    stateSigner: {},
    baseUrl: 'https://factory.example',
  } as unknown as IntegrationContext;
  integration.workers(context);
  const app = new Hono();
  mountApiRoutes(app as never, integration.routes(context));
  const modes = new PlatformGithubModes(() => generic as unknown as PlatformGithubModeStorage, { cacheTtlMs: 0 });

  return {
    platform,
    seed,
    sourceControl,
    legacy,
    linked,
    linkRepository,
    projects,
    emitAudit,
    modes,
    generic,
    /** What each app token reaches on GitHub; null makes GitHub refuse it. */
    apps,
    /** Installs an app on another account, as its own connection. */
    install: (id: string, integrationId: string, token: string, install: AppInstall) => {
      apps[token] = install;
      addApp(id, integrationId, token, install);
    },
    status: () => app.request('/web/integrations/platform/github/switch'),
    githubStatus: () => app.request('/web/github/status'),
    switchApps: () => app.request('/web/integrations/platform/github/switch', { method: 'POST' }),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GitHub app switch', () => {
  it('reports what blocks the switch while the Reviews app is not connected', async () => {
    const { status } = await setup({ reviews: null });
    const response = await status();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      mode: 'legacy',
      switchedAt: null,
      connections: [{ id: 'conn-github', app: FACTORY_GITHUB_PROVIDER_KEY, status: 'active' }],
      plan: {
        ready: false,
        missing: {
          apps: [FACTORY_REVIEWS_GITHUB_PROVIDER_KEY],
          accounts: [{ accountLogin: 'acme', apps: [FACTORY_REVIEWS_GITHUB_PROVIDER_KEY] }],
          repositories: [{ slug: 'acme/app', githubRepositoryId: '101', apps: [FACTORY_REVIEWS_GITHUB_PROVIDER_KEY] }],
        },
      },
    });
  });

  it.each([
    ['the Reviews app is not connected', { reviews: null }, { apps: [FACTORY_REVIEWS_GITHUB_PROVIDER_KEY] }],
    [
      'an account has no Mastra Factory app',
      { github: { installationId: 900, account: 'other', repositories: [101] } },
      { accounts: [{ accountLogin: 'acme', apps: [FACTORY_GITHUB_PROVIDER_KEY] }] },
    ],
    [
      'a linked repository is out of the Reviews app’s reach',
      { reviews: { installationId: 901, account: 'acme', repositories: [102] } },
      { repositories: [{ slug: 'acme/app', githubRepositoryId: '101', apps: [FACTORY_REVIEWS_GITHUB_PROVIDER_KEY] }] },
    ],
  ])('refuses and changes nothing when %s', async (_, options, missing) => {
    const { switchApps, sourceControl, legacy, modes } = await setup(options);
    const response = await switchApps();
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: 'switch_preconditions_failed',
      plan: { ready: false, missing },
    });
    expect((await modes.get('org-1')).mode).toBe('legacy');
    expect(await sourceControl.installations.get({ orgId: 'org-1', id: legacy.id })).toMatchObject({ externalId: '7' });
  });

  it('is for org admins only', async () => {
    const { switchApps, status, modes } = await setup({ admin: false });
    expect((await switchApps()).status).toBe(403);
    expect((await status()).status).toBe(403);
    expect((await modes.get('org-1')).mode).toBe('legacy');
  });

  it('re-points the installation in place, so bindings keep resolving, and sweeps once', async () => {
    const requestRun = vi.spyOn(GithubReconcileWorker.prototype, 'requestRun');
    const { switchApps, sourceControl, legacy, linked, modes, emitAudit } = await setup();

    const response = await switchApps();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ switched: true, mode: 'connect' });

    expect(await sourceControl.installations.get({ orgId: 'org-1', id: legacy.id })).toMatchObject({
      externalId: '900',
      accountName: 'acme',
    });
    expect(await sourceControl.repositories.findByExternalId({ orgId: 'org-1', externalId: '101' })).toMatchObject({
      id: linked.repository.id,
      installationId: legacy.id,
    });
    expect(await sourceControl.projectRepositories.get({ orgId: 'org-1', id: linked.link.id })).toMatchObject({
      connectionId: linked.connection.id,
      repositoryId: linked.repository.id,
    });
    const record = await modes.get('org-1');
    expect(record).toMatchObject({
      mode: 'connect',
      switchedBy: 'admin-1',
      installations: [
        {
          accountLogin: 'acme',
          installationId: 900,
          connectionId: 'conn-github',
          reviewsConnectionId: 'conn-reviews',
          legacyInstallationIds: [7],
        },
      ],
    });
    await expect(modes.orgsForInstallation(900)).resolves.toEqual(['org-1']);
    expect(requestRun).toHaveBeenCalledTimes(1);
    expect(emitAudit).toHaveBeenCalledTimes(1);
    expect(emitAudit.mock.calls[0]).toMatchObject([
      {
        input: {
          action: 'factory.integration.github_apps_switched',
          targets: [{ type: 'github_installation', id: '900' }],
        },
      },
    ]);
  });

  it('answers a second switch with a no-op, and never switches back', async () => {
    const { switchApps, status, modes } = await setup();
    expect((await switchApps()).status).toBe(200);
    const switchedAt = (await modes.get('org-1')).switchedAt;

    const again = await switchApps();
    expect(again.status).toBe(200);
    expect(await again.json()).toMatchObject({ switched: false, mode: 'connect', switchedAt });
    const report = await (await status()).json();
    expect(report).toMatchObject({ mode: 'connect', switchedAt });
    expect(report).not.toHaveProperty('plan');
  });

  it("reports the switched org's new installation, without re-creating the legacy one", async () => {
    const { switchApps, githubStatus, sourceControl, platform } = await setup();
    expect((await switchApps()).status).toBe(200);

    const response = await githubStatus();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      mode: 'connect',
      connected: true,
      installations: [{ installationId: 900, accountLogin: 'acme', accountType: 'Organization' }],
      userConnected: false,
    });
    expect(await sourceControl.installations.list({ orgId: 'org-1' })).toMatchObject([{ externalId: '900' }]);
    expect(platform.requests.some(request => request.path.startsWith('/v1/server/github'))).toBe(false);
  });

  it('picks up the accounts both apps are installed on after the switch, like the legacy app does', async () => {
    const { switchApps, githubStatus, install, modes, platform } = await setup();
    expect((await switchApps()).status).toBe(200);
    install('conn-github-globex', FACTORY_GITHUB_PROVIDER_KEY, 'tok-github-globex', {
      installationId: 910,
      account: 'globex',
      repositories: [201],
    });
    install('conn-reviews-globex', FACTORY_REVIEWS_GITHUB_PROVIDER_KEY, 'tok-reviews-globex', {
      installationId: 911,
      account: 'globex',
      repositories: [201],
    });
    // Only one app on initech: not usable until the Reviews app is installed there too.
    install('conn-github-initech', FACTORY_GITHUB_PROVIDER_KEY, 'tok-github-initech', {
      installationId: 920,
      account: 'initech',
      repositories: [301],
    });

    const response = await githubStatus();
    expect(response.status).toBe(200);
    expect((await response.json()).installations).toMatchObject([
      { installationId: 900, accountLogin: 'acme' },
      { installationId: 910, accountLogin: 'globex' },
    ]);
    expect((await modes.get('org-1')).installations).toMatchObject([
      { installationId: 900, connectionId: 'conn-github', reviewsConnectionId: 'conn-reviews' },
      { installationId: 910, connectionId: 'conn-github-globex', reviewsConnectionId: 'conn-reviews-globex' },
    ]);
    await expect(modes.orgsForInstallation(910)).resolves.toEqual(['org-1']);

    // The apps are re-read at most every few minutes, not on every status check.
    const contextReads = () => platform.requests.filter(request => request.path.endsWith('/context')).length;
    const before = contextReads();
    expect((await githubStatus()).status).toBe(200);
    expect(contextReads()).toBe(before);
  });

  it('keeps an installation another replica recorded when it picks up a new one', async () => {
    const { switchApps, status, githubStatus, install, modes } = await setup();
    expect((await switchApps()).status).toBe(200);
    expect((await status()).status).toBe(200);
    // Another replica records an account after this one cached the switched record.
    const switched = await modes.get('org-1');
    await modes.saveConnect('org-1', {
      switchedAt: switched.switchedAt!,
      installations: [
        ...(switched.installations ?? []),
        {
          accountLogin: 'hooli',
          installationId: 950,
          connectionId: 'conn-github-hooli',
          reviewsConnectionId: 'conn-reviews-hooli',
        },
      ],
    });
    install('conn-github-globex', FACTORY_GITHUB_PROVIDER_KEY, 'tok-github-globex', {
      installationId: 910,
      account: 'globex',
      repositories: [201],
    });
    install('conn-reviews-globex', FACTORY_REVIEWS_GITHUB_PROVIDER_KEY, 'tok-reviews-globex', {
      installationId: 911,
      account: 'globex',
      repositories: [201],
    });

    expect((await githubStatus()).status).toBe(200);

    expect((await modes.get('org-1')).installations?.map(installation => installation.installationId)).toEqual([
      900, 950, 910,
    ]);
  });

  it('retries on the next load an account whose connection could not be read', async () => {
    const { switchApps, githubStatus, install, apps, modes } = await setup();
    expect((await switchApps()).status).toBe(200);
    const globex = { installationId: 910, account: 'globex', repositories: [201] };
    install('conn-github-globex', FACTORY_GITHUB_PROVIDER_KEY, 'tok-github-globex', globex);
    install('conn-reviews-globex', FACTORY_REVIEWS_GITHUB_PROVIDER_KEY, 'tok-reviews-globex', {
      ...globex,
      installationId: 911,
    });
    apps['tok-github-globex'] = null;

    expect((await githubStatus()).status).toBe(200);
    expect((await modes.get('org-1')).installations?.map(installation => installation.installationId)).toEqual([900]);

    apps['tok-github-globex'] = globex;
    expect((await githubStatus()).status).toBe(200);
    expect((await modes.get('org-1')).installations?.map(installation => installation.installationId)).toEqual([
      900, 910,
    ]);
  });

  it('moves open pull request subscriptions to the new installation, so their threads keep waking', async () => {
    const { switchApps, generic, linked } = await setup();
    const subscriptions = generic as unknown as GithubSubscriptionStorage;
    const subscribe = (orgId: string, installationExternalId: string, changeRequestId: string) =>
      subscribeToPullRequest(
        {
          orgId,
          installationExternalId,
          projectRepositoryId: linked.link.id,
          repositoryExternalId: '101',
          repositorySlug: 'acme/app',
          changeRequestId,
          sessionId: `session-${orgId}-${changeRequestId}`,
          ownerId: 'admin-1',
          resourceId: 'resource-1',
          threadId: `thread-${changeRequestId}`,
          source: 'factory-pr-create',
        },
        subscriptions,
      );
    await subscribe('org-1', '7', '5');
    // Another org's subscription on the same legacy installation is theirs to move.
    await subscribe('org-2', '7', '5');

    expect((await switchApps()).status).toBe(200);

    const target = (installationExternalId: string) =>
      listPullRequestSubscriptionsForWebhook(
        { installationExternalId, repositoryExternalId: '101', changeRequestId: '5' },
        undefined,
        subscriptions,
      );
    expect((await target('900')).map(row => [row.orgId, row.data.installationExternalId])).toEqual([['org-1', '900']]);
    expect((await target('7')).map(row => row.orgId)).toEqual(['org-2']);
  });

  it('lets exactly one of two concurrent switches move the installations', async () => {
    const { switchApps, sourceControl } = await setup();
    const responses = await Promise.all([switchApps(), switchApps()]);
    expect(responses.map(response => response.status)).toEqual([200, 200]);
    const bodies = await Promise.all(responses.map(response => response.json()));
    expect(bodies.map(body => body.switched).sort()).toEqual([false, true]);
    expect(await sourceControl.installations.list({ orgId: 'org-1' })).toMatchObject([{ externalId: '900' }]);
  });

  it('merges two legacy installations of one account onto the new one', async () => {
    const { switchApps, sourceControl, legacy, linkRepository, modes, generic } = await setup();
    const second = await sourceControl.installations.upsert({
      orgId: 'org-1',
      connectedByUserId: 'admin-1',
      externalId: '8',
      accountName: 'acme',
    });
    const other = await linkRepository(second.id, '102', 'acme/api', 'proj-2');
    const subscriptions = generic as unknown as GithubSubscriptionStorage;
    await subscribeToPullRequest(
      {
        orgId: 'org-1',
        installationExternalId: '8',
        projectRepositoryId: other.link.id,
        repositoryExternalId: '102',
        repositorySlug: 'acme/api',
        changeRequestId: '3',
        sessionId: 'session-3',
        ownerId: 'admin-1',
        resourceId: 'resource-1',
        threadId: 'thread-3',
        source: 'factory-pr-create',
      },
      subscriptions,
    );

    expect((await switchApps()).status).toBe(200);
    expect(
      await listPullRequestSubscriptionsForWebhook(
        { installationExternalId: '900', repositoryExternalId: '102', changeRequestId: '3' },
        undefined,
        subscriptions,
      ),
    ).toMatchObject([{ sessionId: 'session-3' }]);
    expect(await sourceControl.installations.list({ orgId: 'org-1' })).toMatchObject([
      { id: legacy.id, externalId: '900' },
    ]);
    expect(await sourceControl.repositories.get({ orgId: 'org-1', id: other.repository.id })).toMatchObject({
      installationId: legacy.id,
    });
    expect(await sourceControl.connections.get({ orgId: 'org-1', id: other.connection.id })).toMatchObject({
      installationId: legacy.id,
    });
    expect((await modes.get('org-1')).installations?.[0]?.legacyInstallationIds).toEqual([7, 8]);
  });

  it('refuses a merge that would put one project on an installation twice, changing nothing', async () => {
    const { switchApps, sourceControl, legacy, linkRepository, projects, modes } = await setup();
    const second = await sourceControl.installations.upsert({
      orgId: 'org-1',
      connectedByUserId: 'admin-1',
      externalId: '8',
      accountName: 'acme',
    });
    await linkRepository(second.id, '102', 'acme/api', 'proj-1');

    const response = await switchApps();
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: 'installation_conflict',
      conflicts: [{ kind: 'project_connection', externalId: '900', factoryProjectId: projects['proj-1'] }],
    });
    expect((await modes.get('org-1')).mode).toBe('legacy');
    expect(await sourceControl.installations.get({ orgId: 'org-1', id: legacy.id })).toMatchObject({ externalId: '7' });
    expect(await sourceControl.installations.get({ orgId: 'org-1', id: second.id })).toMatchObject({ externalId: '8' });
  });

  it('refuses when a repository the apps can’t reach is linked after the precheck', async () => {
    const { switchApps, seed, legacy, linkRepository, sourceControl, modes } = await setup();
    const withTransaction = seed.storage.withTransaction.bind(seed.storage);
    vi.spyOn(seed.storage, 'withTransaction').mockImplementationOnce(async fn => {
      await linkRepository(legacy.id, '555', 'acme/secret');
      return withTransaction(fn);
    });

    const response = await switchApps();
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: 'switch_preconditions_failed',
      plan: { missing: { repositories: [{ slug: 'acme/secret', githubRepositoryId: '555' }] } },
    });
    expect((await modes.get('org-1')).mode).toBe('legacy');
    expect(await sourceControl.installations.get({ orgId: 'org-1', id: legacy.id })).toMatchObject({ externalId: '7' });
  });

  it('rolls the move back when the switch fails before committing', async () => {
    const { switchApps, sourceControl, legacy, modes, emitAudit } = await setup();
    vi.spyOn(PlatformGithubModes.prototype, 'saveConnect').mockRejectedValueOnce(new Error('disk full'));

    const response = await switchApps();
    expect(response.status).toBe(502);
    expect((await modes.get('org-1')).mode).toBe('legacy');
    expect(await sourceControl.installations.get({ orgId: 'org-1', id: legacy.id })).toMatchObject({ externalId: '7' });
    expect(emitAudit).not.toHaveBeenCalled();
  });
});
