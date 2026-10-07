import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import type { FactoryStorageTestSeed } from '../storage/test-utils.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { ProjectRoutes } from './projects.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';

const projectRoutes = (
  seed: FactoryStorageTestSeed,
  versionControlIntegrationIds?: string[],
  sessionRetirement?: ConstructorParameters<typeof ProjectRoutes>[0]['sessionRetirement'],
  resolveRepository?: ConstructorParameters<typeof ProjectRoutes>[0]['resolveRepository'],
  overrides?: Partial<ConstructorParameters<typeof ProjectRoutes>[0]>,
) =>
  new ProjectRoutes({
    auth: fakeRouteAuth(),
    projects: seed.projects,
    sourceControl: seed.sourceControl,
    versionControlIntegrationIds,
    sessionRetirement,
    resolveRepository,
    ...overrides,
  }).routes();

describe('ProjectRoutes', () => {
  it('creates, lists, reads, updates, and deletes a project without integrations', async () => {
    const seed = await createFactoryStorageForTests();
    const app = new Hono();
    app.use('*', async (context, next) => {
      context.set('factoryAuthUser' as never, { workosId: 'user-1', organizationId: 'org-1' } as never);
      await next();
    });
    mountApiRoutes(app as never, projectRoutes(seed));

    const createdResponse = await app.request('/web/factory/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: ' Platform ', description: ' Core services ' }),
    });
    expect(createdResponse.status).toBe(201);
    const created = (await createdResponse.json()) as {
      project: { id: string; name: string; description: string; slackWorkItemsEnabled: boolean };
    };
    expect(created.project).toMatchObject({
      name: 'Platform',
      description: 'Core services',
      slackWorkItemsEnabled: false,
    });

    const listed = (await (await app.request('/web/factory/projects')).json()) as { projects: Array<{ id: string }> };
    expect(listed.projects.map(project => project.id)).toEqual([created.project.id]);
    expect((await app.request(`/web/factory/projects/${created.project.id}`)).status).toBe(200);

    const updatedResponse = await app.request(`/web/factory/projects/${created.project.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Platform engineering', description: null, slackWorkItemsEnabled: true }),
    });
    expect(updatedResponse.status).toBe(200);
    expect((await updatedResponse.json()) as unknown).toMatchObject({
      project: { name: 'Platform engineering', description: null, slackWorkItemsEnabled: true },
    });

    expect((await app.request(`/web/factory/projects/${created.project.id}`, { method: 'DELETE' })).status).toBe(204);
    expect((await app.request(`/web/factory/projects/${created.project.id}`)).status).toBe(404);
  });

  it('requires an organization and scopes project access by organization', async () => {
    const seed = await createFactoryStorageForTests();
    const project = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Private' } });
    const buildApp = (user?: { workosId: string; organizationId?: string }) => {
      const app = new Hono();
      app.use('*', async (context, next) => {
        if (user) context.set('factoryAuthUser' as never, user as never);
        await next();
      });
      mountApiRoutes(app as never, projectRoutes(seed));
      return app;
    };

    expect((await buildApp().request('/web/factory/projects')).status).toBe(401);
    expect((await buildApp({ workosId: 'user-1' }).request('/web/factory/projects')).status).toBe(403);
    expect(
      (await buildApp({ workosId: 'user-2', organizationId: 'org-2' }).request(`/web/factory/projects/${project.id}`))
        .status,
    ).toBe(404);
  });

  describe('apply default model', () => {
    const mount = (
      seed: FactoryStorageTestSeed,
      overrides?: Partial<ConstructorParameters<typeof ProjectRoutes>[0]>,
      user: { workosId: string; organizationId?: string } | null = {
        workosId: 'user-1',
        organizationId: 'org-1',
      },
    ) => {
      const app = new Hono();
      app.use('*', async (context, next) => {
        if (user) context.set('factoryAuthUser' as never, user as never);
        await next();
      });
      mountApiRoutes(app as never, projectRoutes(seed, undefined, undefined, undefined, overrides));
      return app;
    };

    it('requires project access and a configured default model', async () => {
      const seed = await createFactoryStorageForTests();
      const project = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Platform' } });
      const path = `/web/factory/projects/${project.id}/apply-default-model`;

      expect((await mount(seed, undefined, null).request(path, { method: 'POST' })).status).toBe(401);
      expect(
        (
          await mount(seed, undefined, { workosId: 'user-2', organizationId: 'org-2' }).request(path, {
            method: 'POST',
          })
        ).status,
      ).toBe(404);

      const forbidden = await mount(seed, {
        auth: fakeRouteAuth({ isOrganizationAdmin: async () => false }),
      }).request(path, { method: 'POST' });
      expect(forbidden.status).toBe(403);
      expect(await forbidden.json()).toEqual({
        error: 'forbidden',
        message: 'Organization administrator access is required to update running sessions.',
      });

      const response = await mount(seed).request(path, { method: 'POST' });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: 'default_model_not_set',
        message: 'Set a default model on the project first.',
      });
    });

    it('applies the default to running bound threads and reports precise skip reasons', async () => {
      const seed = await createFactoryStorageForTests();
      const project = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Platform' } });
      await seed.projects.update({
        orgId: 'org-1',
        id: project.id,
        input: { defaultModelId: 'anthropic/claude-opus-4-6' },
      });
      const now = new Date();
      const binding = (threadId: string, workItemId: string, resourceId: string) => ({
        id: `binding-${threadId}`,
        orgId: 'org-1',
        factoryProjectId: project.id,
        workItemId,
        role: 'work',
        threadId,
        resourceId,
        sessionId: `session-${threadId}`,
        branch: `factory/${threadId}`,
        status: 'active' as const,
        createdAt: now,
        revokedAt: null,
      });
      const bindings = [
        binding('thread-applied', 'item-applied', 'resource-applied'),
        binding('thread-applied', 'item-applied', 'resource-applied'),
        binding('thread-no-item', 'item-missing', 'resource-no-item'),
        binding('thread-inactive', 'item-inactive', 'resource-inactive'),
        binding('thread-not-running', 'item-not-running', 'resource-not-running'),
        binding('thread-missing', 'item-thread-missing', 'resource-thread-missing'),
        binding('thread-mode-unknown', 'item-mode-unknown', 'resource-mode-unknown'),
        binding('thread-apply-failed', 'item-apply-failed', 'resource-apply-failed'),
      ];
      const item = (id: string, stages = ['execute']) => ({ id, factoryProjectId: project.id, stages });
      const items = new Map([
        ['item-applied', item('item-applied')],
        ['item-inactive', item('item-inactive', ['done'])],
        ['item-not-running', item('item-not-running')],
        ['item-thread-missing', item('item-thread-missing')],
        ['item-mode-unknown', item('item-mode-unknown')],
        ['item-apply-failed', item('item-apply-failed')],
      ]);
      const setSettingOn = vi.fn().mockResolvedValue(undefined);
      const failingSetSettingOn = vi.fn().mockRejectedValue(new Error('write failed'));
      const sessions = new Map([
        [
          'resource-applied',
          {
            thread: {
              getById: vi.fn().mockResolvedValue({ metadata: { currentModeId: 'plan' } }),
              setSettingOn,
            },
          },
        ],
        ['resource-thread-missing', { thread: { getById: vi.fn().mockResolvedValue(null), setSettingOn } }],
        ['resource-mode-unknown', { thread: { getById: vi.fn().mockResolvedValue({ metadata: {} }), setSettingOn } }],
        [
          'resource-apply-failed',
          {
            thread: {
              getById: vi.fn().mockResolvedValue({ metadata: { currentModeId: 'plan' } }),
              setSettingOn: failingSetSettingOn,
            },
          },
        ],
      ]);
      const workItems = {
        listRunBindings: vi.fn().mockResolvedValue(bindings),
        get: vi.fn(async ({ id }: { id: string }) => items.get(id) ?? null),
      } as unknown as NonNullable<ConstructorParameters<typeof ProjectRoutes>[0]['workItems']>;
      const controller = {
        getSessionByResource: vi.fn(async (resourceId: string) => sessions.get(resourceId) ?? null),
      } as NonNullable<ConstructorParameters<typeof ProjectRoutes>[0]['controller']>;

      const response = await mount(seed, { workItems, controller }).request(
        `/web/factory/projects/${project.id}/apply-default-model`,
        { method: 'POST' },
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        modelId: 'anthropic/claude-opus-4-6',
        applied: ['thread-applied', 'thread-mode-unknown'],
        skipped: [
          { threadId: 'thread-no-item', reason: 'work-item-missing' },
          { threadId: 'thread-inactive', reason: 'stage-inactive' },
          { threadId: 'thread-not-running', reason: 'not-running' },
          { threadId: 'thread-missing', reason: 'thread-missing' },
          { threadId: 'thread-apply-failed', reason: 'apply-failed' },
        ],
      });
      expect(setSettingOn).toHaveBeenCalledTimes(2);
      expect(setSettingOn).toHaveBeenNthCalledWith(1, {
        threadId: 'thread-applied',
        key: 'currentModelId',
        value: 'anthropic/claude-opus-4-6',
      });
      expect(setSettingOn).toHaveBeenNthCalledWith(2, {
        threadId: 'thread-mode-unknown',
        key: 'currentModelId',
        value: 'anthropic/claude-opus-4-6',
      });
    });
  });

  it('retires active repository sessions before destructive project deletion', async () => {
    const seed = await createFactoryStorageForTests();
    const project = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Platform' } });
    const github = seed.sourceControl.forIntegration('github');
    const installation = await github.installations.upsert({
      orgId: 'org-1',
      connectedByUserId: 'user-1',
      externalId: 'gh-1',
    });
    const repository = await github.repositories.upsert({
      orgId: 'org-1',
      input: {
        installationId: installation.id,
        externalId: 'repo-1',
        slug: 'acme/api',
        defaultBranch: 'main',
      },
    });
    const connection = await github.connections.create({
      orgId: 'org-1',
      factoryProjectId: project.id,
      installationId: installation.id,
      createdByUserId: 'user-1',
    });
    const link = await github.projectRepositories.link({
      orgId: 'org-1',
      connectionId: connection.id,
      repositoryId: repository.id,
      createdByUserId: 'user-1',
      sandboxProvider: 'local',
      sandboxWorkdir: '/workspace/acme/api',
      teardownCommand: 'pnpm local teardown',
    });
    await github.sessions.create({
      sessionId: 'session-1',
      projectRepositoryId: link.id,
      orgId: 'org-1',
      userId: 'user-1',
      branch: 'feat/x',
      baseBranch: 'main',
    });
    const retireProjectRepositorySessions = vi.fn(async () => {
      expect(await github.sessions.listByProjectRepository({ projectRepositoryId: link.id })).toHaveLength(1);
    });
    const app = new Hono();
    app.use('*', async (context, next) => {
      context.set('factoryAuthUser' as never, { workosId: 'user-1', organizationId: 'org-1' } as never);
      await next();
    });
    mountApiRoutes(app as never, projectRoutes(seed, ['github'], { retireProjectRepositorySessions } as any));

    const response = await app.request(`/web/factory/projects/${project.id}`, { method: 'DELETE' });

    expect(response.status).toBe(204);
    expect(retireProjectRepositorySessions).toHaveBeenCalledOnce();
    expect(retireProjectRepositorySessions.mock.calls[0]?.[0]).toMatchObject({
      sourceControl: { integrationId: 'github' },
      orgId: 'org-1',
      projectRepositoryId: link.id,
    });
  });

  it('rejects destructive project deletion when materialized sessions cannot be retired', async () => {
    const seed = await createFactoryStorageForTests();
    const project = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Platform' } });
    const github = seed.sourceControl.forIntegration('github');
    const installation = await github.installations.upsert({
      orgId: 'org-1',
      connectedByUserId: 'user-1',
      externalId: 'gh-1',
    });
    const repository = await github.repositories.upsert({
      orgId: 'org-1',
      input: {
        installationId: installation.id,
        externalId: 'repo-1',
        slug: 'acme/api',
        defaultBranch: 'main',
      },
    });
    const connection = await github.connections.create({
      orgId: 'org-1',
      factoryProjectId: project.id,
      installationId: installation.id,
      createdByUserId: 'user-1',
    });
    const link = await github.projectRepositories.link({
      orgId: 'org-1',
      connectionId: connection.id,
      repositoryId: repository.id,
      createdByUserId: 'user-1',
      sandboxProvider: 'local',
      sandboxWorkdir: '/workspace/acme/api',
      teardownCommand: 'pnpm local teardown',
    });
    const session = await github.sessions.create({
      sessionId: 'session-1',
      projectRepositoryId: link.id,
      orgId: 'org-1',
      userId: 'user-1',
      branch: 'feat/x',
      baseBranch: 'main',
    });
    await github.sessions.setSandbox({
      id: session.id,
      sandboxId: 'sandbox-1',
      sandboxWorkdir: '/workspace/acme/api/session-1',
    });
    const app = new Hono();
    app.use('*', async (context, next) => {
      context.set('factoryAuthUser' as never, { workosId: 'user-1', organizationId: 'org-1' } as never);
      await next();
    });
    mountApiRoutes(app as never, projectRoutes(seed, ['github']));

    const response = await app.request(`/web/factory/projects/${project.id}`, { method: 'DELETE' });

    expect(response.status).toBe(409);
    expect(await seed.projects.get({ orgId: 'org-1', id: project.id })).not.toBeNull();
    expect(await github.sessions.getBySessionId('session-1')).not.toBeNull();
  });

  it('links installations and repositories from multiple source-control providers', async () => {
    const seed = await createFactoryStorageForTests();
    const project = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Platform' } });
    const github = seed.sourceControl.forIntegration('github');
    const gitlab = seed.sourceControl.forIntegration('gitlab');
    const githubInstallation = await github.installations.upsert({
      orgId: 'org-1',
      connectedByUserId: 'user-1',
      externalId: 'gh-1',
      accountName: 'acme',
    });
    const gitlabInstallation = await gitlab.installations.upsert({
      orgId: 'org-1',
      connectedByUserId: 'user-1',
      externalId: 'gl-1',
      accountName: 'acme-group',
    });
    const resolveRepository = vi.fn(
      async ({
        orgId,
        installationId,
        externalId,
        slug,
      }: Parameters<NonNullable<ConstructorParameters<typeof ProjectRoutes>[0]['resolveRepository']>>[0]) =>
        github.repositories.upsert({
          orgId,
          input: { installationId, externalId, slug, defaultBranch: 'main' },
        }),
    );
    const gitlabRepository = await gitlab.repositories.upsert({
      orgId: 'org-1',
      input: {
        installationId: gitlabInstallation.id,
        externalId: 'repo-2',
        slug: 'acme/web',
        defaultBranch: 'trunk',
      },
    });
    const app = new Hono();
    app.use('*', async (context, next) => {
      context.set('factoryAuthUser' as never, { workosId: 'user-1', organizationId: 'org-1' } as never);
      await next();
    });
    mountApiRoutes(app as never, projectRoutes(seed, ['github', 'gitlab'], undefined, resolveRepository));

    const connect = async (integrationId: string, installationId: string) => {
      const response = await app.request(`/web/factory/projects/${project.id}/source-control-connections`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ integrationId, installationId }),
      });
      expect(response.status).toBe(201);
      return ((await response.json()) as { connection: { id: string } }).connection;
    };
    const githubConnection = await connect('github', githubInstallation.id);
    const gitlabConnection = await connect('gitlab', gitlabInstallation.id);

    const link = async (connectionId: string, repositoryId: string, branch: string) => {
      const response = await app.request(
        `/web/factory/projects/${project.id}/source-control-connections/${connectionId}/repositories`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            repositoryId,
            branch,
            sandboxProvider: 'local',
            sandboxWorkdir: `/workspace/${repositoryId}`,
            setupCommand: 'pnpm install',
            teardownCommand: 'pnpm local worktree teardown',
          }),
        },
      );
      expect(response.status).toBe(201);
      return ((await response.json()) as { projectRepository: { id: string } }).projectRepository;
    };
    const githubLinkResponse = await app.request(
      `/web/factory/projects/${project.id}/source-control-connections/${githubConnection.id}/repositories`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          repository: { externalId: 'repo-1', slug: 'acme/api' },
          branch: 'release',
          sandboxProvider: 'local',
          sandboxWorkdir: '/workspace/api',
          setupCommand: 'pnpm install',
          teardownCommand: 'pnpm local worktree teardown',
        }),
      },
    );
    expect(githubLinkResponse.status).toBe(201);
    const githubLink = ((await githubLinkResponse.json()) as { projectRepository: { id: string } }).projectRepository;
    expect(resolveRepository).toHaveBeenCalledWith({
      integrationId: 'github',
      orgId: 'org-1',
      userId: 'user-1',
      installationId: githubInstallation.id,
      externalId: 'repo-1',
      slug: 'acme/api',
    });
    await link(gitlabConnection.id, gitlabRepository.id, 'trunk');

    const listResponse = await app.request(`/web/factory/projects/${project.id}/source-control-connections`);
    expect(listResponse.status).toBe(200);
    const listed = (await listResponse.json()) as {
      connections: Array<{ integrationId: string; repositories: Array<{ repository: { slug: string } }> }>;
    };
    expect(listed.connections.map(connection => connection.integrationId).sort()).toEqual(['github', 'gitlab']);
    expect(
      listed.connections.flatMap(connection => connection.repositories.map(link => link.repository.slug)).sort(),
    ).toEqual(['acme/api', 'acme/web']);

    const updateResponse = await app.request(`/web/factory/projects/${project.id}/repositories/${githubLink.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ branch: 'stable', setupCommand: null, teardownCommand: 'docker compose down' }),
    });
    expect(updateResponse.status).toBe(200);
    expect((await updateResponse.json()) as unknown).toMatchObject({
      projectRepository: {
        branch: 'stable',
        setupCommand: null,
        teardownCommand: 'docker compose down',
        repository: { slug: 'acme/api' },
      },
    });
  });

  it('rejects cross-organization and cross-installation project links', async () => {
    const seed = await createFactoryStorageForTests();
    const project = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Platform' } });
    const github = seed.sourceControl.forIntegration('github');
    const installation = await github.installations.upsert({
      orgId: 'org-1',
      connectedByUserId: 'user-1',
      externalId: 'gh-1',
    });
    const otherInstallation = await github.installations.upsert({
      orgId: 'org-1',
      connectedByUserId: 'user-1',
      externalId: 'gh-2',
    });
    const otherOrgInstallation = await github.installations.upsert({
      orgId: 'org-2',
      connectedByUserId: 'user-2',
      externalId: 'gh-3',
    });
    const repository = await github.repositories.upsert({
      orgId: 'org-1',
      input: {
        installationId: otherInstallation.id,
        externalId: 'repo-1',
        slug: 'acme/other',
        defaultBranch: 'main',
      },
    });
    const app = new Hono();
    app.use('*', async (context, next) => {
      context.set('factoryAuthUser' as never, { workosId: 'user-1', organizationId: 'org-1' } as never);
      await next();
    });
    mountApiRoutes(app as never, projectRoutes(seed, ['github']));

    expect(
      (
        await app.request(`/web/factory/projects/${project.id}/source-control-connections`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ integrationId: 'github', installationId: otherOrgInstallation.id }),
        })
      ).status,
    ).toBe(404);

    const connection = await github.connections.create({
      orgId: 'org-1',
      factoryProjectId: project.id,
      installationId: installation.id,
      createdByUserId: 'user-1',
    });
    expect(
      (
        await app.request(
          `/web/factory/projects/${project.id}/source-control-connections/${connection.id}/repositories`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              repositoryId: repository.id,
              sandboxProvider: 'local',
              sandboxWorkdir: '/workspace/repo',
            }),
          },
        )
      ).status,
    ).toBe(404);
  });

  // Repro for "stuck on page loader after uninstalling + reinstalling the
  // GitHub App": when GitHub returns 404 for a known installation the factory
  // prunes the installation row (see integrations/github/routes.ts) but the
  // connection + project_repository rows are left behind pointing at the now-
  // deleted installation id. Reinstalling in GitHub does NOT resurrect that
  // installation id, so the stale connection is orphaned forever.
  //
  // The web UI hydrates every project via
  //   GET /web/factory/projects/:id/source-control-connections
  // through useFactoriesQuery. If that endpoint 500s for a single project the
  // whole query rejects and the app never leaves its page loader.
  //
  // Today, that GET throws:
  //   Error: Project source-control connection not found for this
  //   organization and integration.
  // because projects.ts iterates connections.list (which does not filter by
  // installation existence) and then calls projectRepositories.list, which
  // calls requireConnection, which throws when the installation is gone.
  it('does not 500 when a linked GitHub installation was pruned (uninstalled)', async () => {
    const seed = await createFactoryStorageForTests();
    const project = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Platform' } });
    const github = seed.sourceControl.forIntegration('github');
    const installation = await github.installations.upsert({
      orgId: 'org-1',
      connectedByUserId: 'user-1',
      externalId: 'gh-1',
      accountName: 'acme',
    });
    const repository = await github.repositories.upsert({
      orgId: 'org-1',
      input: {
        installationId: installation.id,
        externalId: 'repo-1',
        slug: 'acme/api',
        defaultBranch: 'main',
      },
    });

    const app = new Hono();
    app.use('*', async (context, next) => {
      context.set('factoryAuthUser' as never, { workosId: 'user-1', organizationId: 'org-1' } as never);
      await next();
    });
    mountApiRoutes(app as never, projectRoutes(seed, ['github']));

    const connectResponse = await app.request(`/web/factory/projects/${project.id}/source-control-connections`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ integrationId: 'github', installationId: installation.id }),
    });
    expect(connectResponse.status).toBe(201);
    const { connection } = (await connectResponse.json()) as { connection: { id: string } };

    const linkResponse = await app.request(
      `/web/factory/projects/${project.id}/source-control-connections/${connection.id}/repositories`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          repositoryId: repository.id,
          branch: 'main',
          sandboxProvider: 'local',
          sandboxWorkdir: '/workspace/acme/api',
        }),
      },
    );
    expect(linkResponse.status).toBe(201);

    // Sanity: hydration works before the app is uninstalled.
    const healthy = await app.request(`/web/factory/projects/${project.id}/source-control-connections`);
    expect(healthy.status).toBe(200);

    // Simulate the pruning that happens in integrations/github/routes.ts when
    // GitHub returns 404 for the installation (i.e. the user uninstalled the
    // GitHub App from their org/account).
    await github.installations.delete({ orgId: 'org-1', id: installation.id });

    // This is the request the web UI fires on every page load. It must not
    // 500, or useFactoriesQuery rejects and the page hangs on the loader.
    const stale = await app.request(`/web/factory/projects/${project.id}/source-control-connections`);
    expect(stale.status).toBe(200);
    const staleBody = (await stale.json()) as { connections: Array<{ id: string }> };
    // Orphaned connection is either omitted or returned in a
    // needs-reconnect shape — either is fine, but the request MUST succeed.
    expect(Array.isArray(staleBody.connections)).toBe(true);
  });

  it('rejects invalid create and update payloads', async () => {
    const seed = await createFactoryStorageForTests();
    const app = new Hono();
    app.use('*', async (context, next) => {
      context.set('factoryAuthUser' as never, { workosId: 'user-1', organizationId: 'org-1' } as never);
      await next();
    });
    mountApiRoutes(app as never, projectRoutes(seed));

    expect(
      (
        await app.request('/web/factory/projects', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: '   ' }),
        })
      ).status,
    ).toBe(400);
    const malformed = await app.request('/web/factory/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ error: 'invalid_project' });
    expect((await app.request('/web/factory/projects/not-a-uuid')).status).toBe(404);

    const project = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Valid' } });
    expect(
      (
        await app.request(`/web/factory/projects/${project.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        })
      ).status,
    ).toBe(400);
  });

  describe('environment', () => {
    async function seedEnvironment() {
      const seed = await createFactoryStorageForTests();
      const project = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Env' } });
      const github = seed.sourceControl.forIntegration('github');
      const installation = await github.installations.upsert({
        orgId: 'org-1',
        connectedByUserId: 'user-1',
        externalId: 'gh-1',
        accountName: 'acme',
      });
      const connection = await github.connections.create({
        orgId: 'org-1',
        factoryProjectId: project.id,
        installationId: installation.id,
        createdByUserId: 'user-1',
      });
      const links = [];
      for (const slug of ['acme/docs', 'acme/api', 'acme/web']) {
        const repository = await github.repositories.upsert({
          orgId: 'org-1',
          input: { installationId: installation.id, externalId: slug, slug, defaultBranch: 'main' },
        });
        links.push(
          await github.projectRepositories.link({
            orgId: 'org-1',
            connectionId: connection.id,
            repositoryId: repository.id,
            createdByUserId: 'user-1',
            branch: 'main',
            sandboxProvider: 'local',
            sandboxWorkdir: '/workspace',
            setupCommand: 'pnpm i',
          }),
        );
      }
      const app = new Hono();
      app.use('*', async (context, next) => {
        context.set('factoryAuthUser' as never, { workosId: 'user-1', organizationId: 'org-1' } as never);
        await next();
      });
      mountApiRoutes(app as never, projectRoutes(seed, ['github'], undefined, undefined, { pushSignal: 'polling' }));
      return { seed, project, github, links, app };
    }

    const patch = (app: Hono, projectId: string, body: unknown) =>
      app.request(`/web/factory/projects/${projectId}/environment`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

    it('reads unset resources as null and the ordered repositories, and writes settings, order and membership', async () => {
      const { seed, project, links, app, github } = await seedEnvironment();

      const read = await app.request(`/web/factory/projects/${project.id}/environment`);
      expect(read.status).toBe(200);
      const initial = (await read.json()) as { environment: Record<string, unknown> };
      expect(initial.environment).toMatchObject({
        sandboxWorkdir: null,
        sandboxCpuCount: null,
        sandboxMemoryMb: null,
        sandboxIdleTimeoutMinutes: null,
        workspaceSetupCommand: null,
        activeTemplateId: null,
        activeTemplateHeads: null,
        buildTriggers: {
          schedule: { enabled: true, hours: 24 },
          onPush: { enabled: true, debounceMinutes: 10, maxPerHour: 4 },
        },
        build: {
          status: null,
          error: null,
          lastBuiltAt: null,
          activeTemplateId: null,
          requestedAt: null,
          pushSignal: 'polling',
        },
      });
      // Defaults are applied on read, never written.
      expect(await seed.projects.getById({ id: project.id })).toMatchObject({
        sandboxCpuCount: null,
        sandboxMemoryMb: null,
      });
      expect(
        (initial.environment.repositories as Array<Record<string, unknown>>).map(r => [
          r.slug,
          r.position,
          r.inEnvironment,
          r.lastBuildStatus,
        ]),
      ).toEqual([
        ['acme/docs', 1, true, 'unbuilt'],
        ['acme/api', 2, true, 'unbuilt'],
        ['acme/web', 3, true, 'unbuilt'],
      ]);

      const updated = await patch(app, project.id, {
        sandboxWorkdir: '/home/user',
        sandboxCpuCount: 8,
        sandboxMemoryMb: 16384,
        sandboxIdleTimeoutMinutes: 30,
        workspaceSetupCommand: 'pnpm -r build',
        repositories: [
          { projectRepositoryId: links[2]!.id, position: 1 },
          { projectRepositoryId: links[0]!.id, position: 2, inEnvironment: false, setupCommand: null },
          { projectRepositoryId: links[1]!.id, position: 3, teardownCommand: 'docker compose down' },
        ],
      });
      expect(updated.status).toBe(200);
      const after = (await updated.json()) as { environment: Record<string, unknown> };
      expect(after.environment).toMatchObject({
        sandboxWorkdir: '/home/user',
        sandboxCpuCount: 8,
        sandboxMemoryMb: 16384,
        sandboxIdleTimeoutMinutes: 30,
        workspaceSetupCommand: 'pnpm -r build',
      });
      expect(
        (after.environment.repositories as Array<Record<string, unknown>>).map(r => [
          r.slug,
          r.position,
          r.inEnvironment,
          r.setupCommand,
          r.teardownCommand,
        ]),
      ).toEqual([
        ['acme/web', 1, true, 'pnpm i', null],
        ['acme/docs', 2, false, null, null],
        ['acme/api', 3, true, 'pnpm i', 'docker compose down'],
      ]);
      // Existing per-link fields are untouched by the environment route.
      const stored = await github.projectRepositories.get({ orgId: 'org-1', id: links[0]!.id });
      expect(stored).toMatchObject({ branch: 'main', sandboxProvider: 'local', sandboxWorkdir: '/workspace' });

      // Re-reading returns the same environment the PATCH returned (the PATCH alone flags the queued build).
      const reread = (await (await app.request(`/web/factory/projects/${project.id}/environment`)).json()) as unknown;
      expect(after).toMatchObject({ buildRequested: true });
      expect(reread).toEqual({ environment: after.environment });

      // Build-status fields in the body are ignored, not written.
      const mixed = await patch(app, project.id, {
        sandboxCpuCount: 2,
        repositories: [{ projectRepositoryId: links[1]!.id, inEnvironment: false, lastBuildStatus: 'failed' }],
      });
      expect(mixed.status).toBe(200);
      expect(await github.projectRepositories.get({ orgId: 'org-1', id: links[1]!.id })).toMatchObject({
        inEnvironment: false,
        lastBuildStatus: 'unbuilt',
      });

      // Clearing a resource hands it back to the provider default.
      const cleared = await patch(app, project.id, { sandboxCpuCount: null, sandboxMemoryMb: null });
      expect(cleared.status).toBe(200);
      expect(((await cleared.json()) as { environment: Record<string, unknown> }).environment).toMatchObject({
        sandboxCpuCount: null,
        sandboxMemoryMb: null,
      });
    });

    it('rejects invalid payloads without writing anything', async () => {
      const { project, links, app } = await seedEnvironment();
      const before = (await (await app.request(`/web/factory/projects/${project.id}/environment`)).json()) as unknown;

      const cases: unknown[] = [
        {},
        { sandboxCpuCount: 0 },
        { sandboxCpuCount: 65 },
        { sandboxMemoryMb: 256 },
        { sandboxIdleTimeoutMinutes: 0 },
        { sandboxWorkdir: 'relative/path' },
        { repositories: [{ projectRepositoryId: links[0]!.id, position: 2 }] },
        // A reorder that lists only some of the project's links.
        {
          repositories: [
            { projectRepositoryId: links[0]!.id, position: 1 },
            { projectRepositoryId: links[1]!.id, position: 2 },
          ],
        },
        {
          repositories: [
            { projectRepositoryId: links[0]!.id, position: 1 },
            { projectRepositoryId: links[1]!.id, position: 1 },
          ],
        },
        {
          repositories: [
            { projectRepositoryId: links[0]!.id, position: 1 },
            { projectRepositoryId: links[0]!.id, position: 2 },
          ],
        },
        {
          repositories: [{ projectRepositoryId: links[0]!.id, position: 1 }, { projectRepositoryId: links[1]!.id }],
        },
        { buildTriggers: { schedule: { hours: 0 } } },
        { buildTriggers: { schedule: { hours: 169 } } },
        { buildTriggers: { onPush: { debounceMinutes: -1 } } },
        { buildTriggers: { onPush: { debounceMinutes: 1441 } } },
        { buildTriggers: { onPush: { maxPerHour: 0 } } },
        { buildTriggers: { onPush: { maxPerHour: 61 } } },
      ];
      for (const body of cases) {
        const response = await patch(app, project.id, body);
        expect(response.status, JSON.stringify(body)).toBe(400);
        expect(await response.json()).toEqual({ error: 'invalid_environment' });
      }

      const foreign = await patch(app, project.id, {
        sandboxCpuCount: 2,
        repositories: [{ projectRepositoryId: '00000000-0000-4000-8000-000000000000', inEnvironment: false }],
      });
      expect(foreign.status).toBe(404);

      const after = (await (await app.request(`/web/factory/projects/${project.id}/environment`)).json()) as unknown;
      expect(after).toEqual(before);
    });

    it('writes build triggers without queuing a build, and queues one for template-affecting changes', async () => {
      const { seed, project, links, app } = await seedEnvironment();

      const triggersOnly = await patch(app, project.id, {
        buildTriggers: { schedule: { enabled: false, hours: 6 }, onPush: { debounceMinutes: 0, maxPerHour: null } },
      });
      expect(triggersOnly.status).toBe(200);
      const afterTriggers = (await triggersOnly.json()) as Record<string, unknown>;
      expect(afterTriggers).not.toHaveProperty('buildRequested');
      expect(afterTriggers.environment).toMatchObject({
        buildTriggers: {
          schedule: { enabled: false, hours: 6 },
          onPush: { enabled: true, debounceMinutes: 0, maxPerHour: null },
        },
        build: { requestedAt: null },
      });
      // Unlimited is stored as 0, never as null.
      expect(await seed.projects.getById({ id: project.id })).toMatchObject({
        buildScheduleEnabled: false,
        buildScheduleHours: 6,
        buildPushDebounceMinutes: 0,
        buildPushMaxPerHour: 0,
        buildRequestedAt: null,
      });

      const setupChange = await patch(app, project.id, {
        repositories: [{ projectRepositoryId: links[1]!.id, setupCommand: 'pnpm i && pnpm build' }],
      });
      const afterSetup = (await setupChange.json()) as {
        buildRequested?: boolean;
        environment: { build: { requestedAt: string | null } };
      };
      expect(afterSetup.buildRequested).toBe(true);
      expect(afterSetup.environment.build.requestedAt).toEqual(expect.any(String));

      // The idle timeout does not shape the template.
      const idleOnly = await patch(app, project.id, { sandboxIdleTimeoutMinutes: 15 });
      expect(await idleOnly.json()).not.toHaveProperty('buildRequested');
    });

    it('requests a build now and reports the build status', async () => {
      const { seed, project, app } = await seedEnvironment();
      const response = await app.request(`/web/factory/projects/${project.id}/environment/build`, { method: 'POST' });
      expect(response.status).toBe(200);
      const body = (await response.json()) as { requested: boolean; build: Record<string, unknown> };
      expect(body.requested).toBe(true);
      expect(body.build).toMatchObject({ status: null, activeTemplateId: null, pushSignal: 'polling' });
      expect(body.build.requestedAt).toEqual(expect.any(String));
      expect((await seed.projects.getById({ id: project.id }))?.buildRequestedAt).toBeInstanceOf(Date);

      expect(
        (
          await app.request(`/web/factory/projects/00000000-0000-4000-8000-000000000000/environment/build`, {
            method: 'POST',
          })
        ).status,
      ).toBe(404);
    });

    it('scopes the environment to the organization', async () => {
      const { seed, project, links } = await seedEnvironment();
      const app = new Hono();
      app.use('*', async (context, next) => {
        context.set('factoryAuthUser' as never, { workosId: 'user-2', organizationId: 'org-2' } as never);
        await next();
      });
      mountApiRoutes(app as never, projectRoutes(seed, ['github']));
      expect((await app.request(`/web/factory/projects/${project.id}/environment`)).status).toBe(404);
      expect(
        (await patch(app, project.id, { repositories: [{ projectRepositoryId: links[0]!.id, inEnvironment: false }] }))
          .status,
      ).toBe(404);
      expect(
        (await app.request(`/web/factory/projects/${project.id}/environment/build`, { method: 'POST' })).status,
      ).toBe(404);
    });
  });
});
