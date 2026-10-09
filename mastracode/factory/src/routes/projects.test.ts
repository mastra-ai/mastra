import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { FactorySandbox } from '@mastra/core/workspace';
import type { FactorySandboxBuilds, FactorySandboxContext } from '@mastra/core/workspace';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { EnvironmentBuildRunner } from '../environment/build-runner.js';
import { scheduleIdFor } from '../environment/build-schedule.js';
import { ENVIRONMENT_BUILD_WORKFLOW_ID } from '../environment/build-workflow.js';
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
    /** A provider with two integer settings, strict about unknown keys. */
    class StubFactorySandbox extends FactorySandbox<{ cpuCount?: number; memoryMb?: number }> {
      readonly provider = 'stub';
      readonly settings = {
        type: 'object',
        properties: {
          // A schema default is advertised to the UI and never written by factory (D8).
          cpuCount: { type: 'integer', minimum: 1, maximum: 64, default: 2 },
          memoryMb: { type: 'integer', minimum: 512 },
        },
        additionalProperties: false,
      } as const;
      create(_ctx: FactorySandboxContext) {
        throw new Error('not constructed in route tests');
      }
    }

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
      mountApiRoutes(
        app as never,
        projectRoutes(seed, ['github'], undefined, undefined, { sandbox: new StubFactorySandbox() }),
      );
      return { seed, project, github, links, app };
    }

    const patch = (app: Hono, projectId: string, body: unknown) =>
      app.request(`/web/factory/projects/${projectId}/environment`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

    it('reads the provider schema and empty settings with the ordered repositories, and writes settings, order and membership', async () => {
      const { seed, project, links, app, github } = await seedEnvironment();

      const read = await app.request(`/web/factory/projects/${project.id}/environment`);
      expect(read.status).toBe(200);
      const initial = (await read.json()) as { environment: Record<string, unknown> };
      expect(initial.environment).toMatchObject({
        sandbox: {
          provider: 'stub',
          settingsSchema: { type: 'object', additionalProperties: false },
          capabilities: { template: false, builds: { available: false, history: false } },
        },
        settings: {},
        sandboxWorkdir: null,
        workspaceSetupCommand: null,
        activeTemplateId: null,
        activeTemplateHeads: null,
      });
      expect(
        Object.keys(
          (initial.environment.sandbox as { settingsSchema: { properties: object } }).settingsSchema.properties,
        ),
      ).toEqual(['cpuCount', 'memoryMb']);
      // An unset setting is absent from the stored document; nothing is written on read.
      expect(await seed.projects.getById({ id: project.id })).toMatchObject({ sandboxSettings: null });
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
        settings: { cpuCount: 8 },
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
        settings: { cpuCount: 8 },
        workspaceSetupCommand: 'pnpm -r build',
      });
      expect(await seed.projects.getById({ id: project.id })).toMatchObject({ sandboxSettings: { cpuCount: 8 } });
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

      // Re-reading returns the same shape the PATCH returned.
      const reread = (await (await app.request(`/web/factory/projects/${project.id}/environment`)).json()) as unknown;
      expect(reread).toEqual(after);

      // Build-status fields in the body are ignored, not written.
      const mixed = await patch(app, project.id, {
        settings: { memoryMb: 1024 },
        repositories: [{ projectRepositoryId: links[1]!.id, inEnvironment: false, lastBuildStatus: 'failed' }],
      });
      expect(mixed.status).toBe(200);
      expect(await github.projectRepositories.get({ orgId: 'org-1', id: links[1]!.id })).toMatchObject({
        inEnvironment: false,
        lastBuildStatus: 'unbuilt',
      });

      // The patch merged onto the stored document.
      expect(await seed.projects.getById({ id: project.id })).toMatchObject({
        sandboxSettings: { cpuCount: 8, memoryMb: 1024 },
      });

      // A key the user never set is absent even though the schema declares a default for it.
      await patch(app, project.id, { settings: { cpuCount: null } });
      expect((await seed.projects.getById({ id: project.id }))?.sandboxSettings).toEqual({ memoryMb: 1024 });
      await patch(app, project.id, { settings: { cpuCount: 8 } });

      // null removes a key and hands it back to the provider default; an empty document is stored as null.
      const cleared = await patch(app, project.id, { settings: { cpuCount: null } });
      expect(cleared.status).toBe(200);
      expect(((await cleared.json()) as { environment: Record<string, unknown> }).environment).toMatchObject({
        settings: { memoryMb: 1024 },
      });
      await patch(app, project.id, { settings: { memoryMb: null } });
      expect(await seed.projects.getById({ id: project.id })).toMatchObject({ sandboxSettings: null });
      expect(
        (
          (await (await app.request(`/web/factory/projects/${project.id}/environment`)).json()) as {
            environment: Record<string, unknown>;
          }
        ).environment.settings,
      ).toEqual({});
    });

    it('rejects settings the provider schema refuses, naming the field', async () => {
      const { project, app, seed } = await seedEnvironment();
      await patch(app, project.id, { settings: { cpuCount: 4 } });

      for (const [settings, field] of [
        [{ cpuCount: 'two' }, 'cpuCount'],
        [{ cpuCount: 65 }, 'cpuCount'],
        [{ memoryMb: 256 }, 'memoryMb'],
        // Ajv reports the extra key in its message, not the path.
        [{ unknown: 1 }, 'additional properties'],
      ] as const) {
        const response = await patch(app, project.id, { settings });
        expect(response.status, JSON.stringify(settings)).toBe(400);
        const body = (await response.json()) as { error: string; issues: Array<{ message: string; path: unknown[] }> };
        expect(body.error).toBe('invalid_environment');
        expect(JSON.stringify(body.issues)).toContain(field);
      }
      // A rejected merge leaves the stored document untouched.
      expect(await seed.projects.getById({ id: project.id })).toMatchObject({ sandboxSettings: { cpuCount: 4 } });
    });

    it('reports no sandbox and refuses settings when the factory has none configured', async () => {
      const seed = await createFactoryStorageForTests();
      const project = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Env' } });
      const app = new Hono();
      app.use('*', async (context, next) => {
        context.set('factoryAuthUser' as never, { workosId: 'user-1', organizationId: 'org-1' } as never);
        await next();
      });
      mountApiRoutes(app as never, projectRoutes(seed));

      const read = (await (await app.request(`/web/factory/projects/${project.id}/environment`)).json()) as {
        environment: { sandbox: { provider: string }; settings: object };
      };
      expect(read.environment.sandbox).toEqual({
        provider: 'none',
        settingsSchema: { type: 'object', properties: {}, additionalProperties: false },
        capabilities: { template: false, builds: { available: false, history: false } },
      });
      expect(read.environment.settings).toEqual({});

      const refused = await patch(app, project.id, { settings: { cpuCount: 2 } });
      expect(refused.status).toBe(400);
      expect(await refused.json()).toEqual({ error: 'no_sandbox' });
      expect((await patch(app, project.id, { sandboxWorkdir: '/home/user' })).status).toBe(200);
    });

    it('rejects invalid payloads without writing anything', async () => {
      const { project, links, app } = await seedEnvironment();
      const before = (await (await app.request(`/web/factory/projects/${project.id}/environment`)).json()) as unknown;

      const cases: unknown[] = [
        {},
        { settings: 'cpu' },
        { settings: { cpuCount: 'two' } },
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
      ];
      for (const body of cases) {
        const response = await patch(app, project.id, body);
        expect(response.status, JSON.stringify(body)).toBe(400);
        expect(await response.json()).toMatchObject({ error: 'invalid_environment' });
      }

      const foreign = await patch(app, project.id, {
        settings: { cpuCount: 2 },
        repositories: [{ projectRepositoryId: '00000000-0000-4000-8000-000000000000', inEnvironment: false }],
      });
      expect(foreign.status).toBe(404);

      const after = (await (await app.request(`/web/factory/projects/${project.id}/environment`)).json()) as unknown;
      expect(after).toEqual(before);
    });

    describe('builds', () => {
      const SHA = 'f'.repeat(40);
      vi.mock('../integrations/github/commits.js', () => ({ getBranchHead: vi.fn(async () => 'f'.repeat(40)) }));

      type Settings = Record<string, unknown>;
      class BuildingSandbox extends FactorySandbox<Settings> {
        readonly provider = 'building';
        readonly settings = {
          type: 'object',
          properties: { cpuCount: { type: 'integer', minimum: 1 } },
          additionalProperties: false,
        } as const;
        readonly starts: Array<{ sessionId: string; settings: Settings }> = [];
        readonly reads: Array<{ buildId: string; heads: Record<string, string | undefined> }> = [];
        withHistory = false;
        readonly builds: FactorySandboxBuilds<Settings> = {
          start: async (ctx, settings) => {
            this.starts.push({ sessionId: ctx.sessionId, settings });
            return { buildId: 'tpl-1:build-1', status: 'building', templateId: 'tpl-1' };
          },
          get: async (ctx, _settings, buildId) => {
            this.reads.push({
              buildId,
              heads: { api: await ctx.resolveHead!('https://github.com/acme/api.git') },
            });
            return { buildId, status: 'ready', templateId: 'tpl-1' };
          },
          list: async () =>
            this.withHistory
              ? [
                  { buildId: 'tpl-1:build-1', status: 'ready' as const, templateId: 'tpl-1' },
                  {
                    buildId: 'tpl-1:build-0',
                    status: 'failed' as const,
                    error: 'clone https://x-access-token:ghs_secret@github.com/acme/api.git failed',
                    logs: ['git clone https://x-access-token:ghs_secret@github.com/acme/api.git', 'fatal: 403'],
                  },
                  { buildId: 'tpl%201:b', status: 'ready' as const, templateId: 'tpl-1' },
                ]
              : [],
        };
        create(): never {
          throw new Error('not constructed in route tests');
        }
      }

      async function seedBuilding(sandbox = new BuildingSandbox()) {
        const seed = await createFactoryStorageForTests();
        const project = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Env' } });
        const github = seed.sourceControl.forIntegration('github');
        const installation = await github.installations.upsert({
          orgId: 'org-1',
          connectedByUserId: 'user-1',
          externalId: 'gh-1',
        });
        const connection = await github.connections.create({
          orgId: 'org-1',
          factoryProjectId: project.id,
          installationId: installation.id,
          createdByUserId: 'user-1',
        });
        const repository = await github.repositories.upsert({
          orgId: 'org-1',
          input: { installationId: installation.id, externalId: 'acme/api', slug: 'acme/api', defaultBranch: 'main' },
        });
        await github.projectRepositories.link({
          orgId: 'org-1',
          connectionId: connection.id,
          repositoryId: repository.id,
          createdByUserId: 'user-1',
          sandboxProvider: 'platform',
          sandboxWorkdir: '/workspace',
        });
        let mastra: Mastra | undefined;
        const runner = new EnvironmentBuildRunner(
          {
            sandbox,
            projects: seed.projects,
            sourceControl: {
              storage: github,
              versionControl: { getRepositoryAccess: async () => ({ token: 't', cloneUrl: 'u' }) as never },
            },
          },
          { getMastra: () => mastra, sleep: async () => {} },
        );
        mastra = new Mastra({
          logger: false,
          storage: new InMemoryStore({ id: `routes-builds-${project.id}` }),
          workflows: { [ENVIRONMENT_BUILD_WORKFLOW_ID]: runner.workflow },
          notifications: { dispatch: { enabled: false } },
        });
        await runner.probeSchedules();
        const app = new Hono();
        app.use('*', async (context, next) => {
          context.set('factoryAuthUser' as never, { workosId: 'user-1', organizationId: 'org-1' } as never);
          await next();
        });
        mountApiRoutes(
          app as never,
          projectRoutes(seed, ['github'], undefined, undefined, { sandbox, environmentBuilds: runner }),
        );
        return { seed, project, app, sandbox, runner, mastra };
      }

      const read = async (app: Hono, projectId: string) =>
        (
          (await (await app.request(`/web/factory/projects/${projectId}/environment`)).json()) as {
            environment: Record<string, any>;
          }
        ).environment;

      const until = async (check: () => Promise<boolean>) => {
        for (let i = 0; i < 100 && !(await check()); i += 1) await new Promise(r => setTimeout(r, 20));
      };

      it('reports triggers and the last build on GET without calling the provider', async () => {
        const { app, project, sandbox } = await seedBuilding();
        const environment = await read(app, project.id);
        expect(environment.sandbox.capabilities.builds).toEqual({ available: true, history: true });
        expect(environment.buildTriggers).toEqual({
          schedule: { enabled: false, cron: null, timezone: null, scheduleAvailable: true },
          push: { enabled: false, debounceMinutes: 10 },
        });
        expect(environment.build).toBeNull();
        expect(environment.buildRequested).toBeUndefined();
        expect(sandbox.reads).toEqual([]);
      });

      it('builds now, serves live status by id with heads from the stored template, then lists history', async () => {
        const { app, project, sandbox, seed } = await seedBuilding();
        const started = await app.request(`/web/factory/projects/${project.id}/environment/build`, { method: 'POST' });
        expect(started.status).toBe(200);
        expect(await started.json()).toEqual({
          outcome: 'started',
          buildId: 'tpl-1:build-1',
          templateId: 'tpl-1',
        });
        expect(sandbox.starts).toEqual([{ sessionId: `environment-build:${project.id}`, settings: {} }]);
        await until(async () => (await seed.projects.getById({ id: project.id }))?.activeTemplateId === 'tpl-1');
        expect(await seed.projects.getById({ id: project.id })).toMatchObject({
          activeTemplateId: 'tpl-1',
          activeTemplateHeads: { 'acme/api': SHA },
          lastBuildId: 'tpl-1:build-1',
        });
        expect((await read(app, project.id)).build).toMatchObject({ buildId: 'tpl-1:build-1' });

        const detail = await app.request(
          `/web/factory/projects/${project.id}/environment/builds/${encodeURIComponent('tpl-1:build-1')}`,
        );
        expect(detail.status).toBe(200);
        expect(await detail.json()).toEqual({
          build: { buildId: 'tpl-1:build-1', status: 'ready', templateId: 'tpl-1' },
        });
        // The route decoded the composite id and resolved heads from the pinned template, not GitHub.
        expect(sandbox.reads.at(-1)).toEqual({ buildId: 'tpl-1:build-1', heads: { api: SHA } });

        sandbox.withHistory = true;
        const history = await app.request(`/web/factory/projects/${project.id}/environment/builds`);
        expect(history.status).toBe(200);
        // Provider output is shown to the user with clone credentials stripped.
        expect(await history.json()).toEqual({
          builds: [
            { buildId: 'tpl-1:build-1', status: 'ready', templateId: 'tpl-1' },
            {
              buildId: 'tpl-1:build-0',
              status: 'failed',
              error: 'clone https://***@github.com/acme/api.git failed',
              logs: ['git clone https://***@github.com/acme/api.git', 'fatal: 403'],
            },
            { buildId: 'tpl%201:b', status: 'ready', templateId: 'tpl-1' },
          ],
        });

        // An id with a percent sign survives the path once, decoded by the router alone.
        const odd = await app.request(
          `/web/factory/projects/${project.id}/environment/builds/${encodeURIComponent('tpl%201:b')}`,
        );
        expect(odd.status).toBe(200);
        expect(sandbox.reads.at(-1)?.buildId).toBe('tpl%201:b');

        // An id the project does not own is never forwarded to the provider,
        // which would otherwise answer for any build on the host's account.
        const readsBefore = sandbox.reads.length;
        const foreign = await app.request(
          `/web/factory/projects/${project.id}/environment/builds/${encodeURIComponent('tpl-9:build-9')}`,
        );
        expect(foreign.status).toBe(404);
        expect(await foreign.json()).toEqual({ error: 'Build not found' });
        expect(sandbox.reads).toHaveLength(readsBefore);
      });

      it('builds after a repository link, edit or unlink, and after a repository patch on the environment', async () => {
        const { app, project, sandbox, seed } = await seedBuilding();
        const github = seed.sourceControl.forIntegration('github');
        const [link] = await github.projectRepositories.listByProject({ orgId: 'org-1', factoryProjectId: project.id });

        const patched = await patch(app, project.id, {
          repositories: [{ projectRepositoryId: link!.id, setupCommand: 'pnpm i' }],
        });
        expect(((await patched.json()) as any).environment.buildRequested).toBe(true);
        expect(sandbox.starts).toHaveLength(1);

        const edited = await app.request(`/web/factory/projects/${project.id}/repositories/${link!.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ setupCommand: 'pnpm build' }),
        });
        expect(edited.status).toBe(200);
        await until(async () => sandbox.starts.length === 2);

        const unlinked = await app.request(`/web/factory/projects/${project.id}/repositories/${link!.id}`, {
          method: 'DELETE',
        });
        expect(unlinked.status).toBe(204);
        // The unlink left no environment repository, so the run skipped instead of building.
        await until(async () => (await seed.projects.getById({ id: project.id }))?.lastBuildId === 'tpl-1:build-1');
        expect(sandbox.starts).toHaveLength(2);
      });

      it('deletes the project schedule with the project', async () => {
        const { app, project, mastra } = await seedBuilding();
        const enabled = await patch(app, project.id, {
          buildTriggers: { schedule: { enabled: true, cron: '0 3 * * *' } },
        });
        expect(enabled.status).toBe(200);
        await expect(mastra!.schedules.get(scheduleIdFor(project.id))).resolves.toMatchObject({ cron: '0 3 * * *' });

        const deleted = await app.request(`/web/factory/projects/${project.id}`, { method: 'DELETE' });
        expect(deleted.status).toBe(204);
        await expect(mastra!.schedules.get(scheduleIdFor(project.id))).resolves.toBeNull();
      });

      it('answers 404 no_builds without a builds capability and no_history without list', async () => {
        const { seed, project } = await seedEnvironment();
        const plain = new Hono();
        plain.use('*', async (context, next) => {
          context.set('factoryAuthUser' as never, { workosId: 'user-1', organizationId: 'org-1' } as never);
          await next();
        });
        mountApiRoutes(
          plain as never,
          projectRoutes(seed, ['github'], undefined, undefined, { sandbox: new StubFactorySandbox() }),
        );
        for (const [path, method] of [
          ['/environment/build', 'POST'],
          ['/environment/builds', 'GET'],
          ['/environment/builds/x', 'GET'],
        ] as const) {
          const response = await plain.request(`/web/factory/projects/${project.id}${path}`, { method });
          expect([path, response.status, await response.json()]).toEqual([path, 404, { error: 'no_builds' }]);
        }
        expect((await patch(plain, project.id, { buildTriggers: { push: { enabled: true } } })).status).toBe(400);

        const sandbox = new BuildingSandbox();
        (sandbox.builds as { list?: unknown }).list = undefined;
        const { app, project: building } = await seedBuilding(sandbox);
        const response = await app.request(`/web/factory/projects/${building.id}/environment/builds`);
        expect([response.status, await response.json()]).toEqual([404, { error: 'no_history' }]);
      });

      it('stores push triggers, keeps the cron in core Schedules, and rejects a bad cron', async () => {
        const { app, project, mastra } = await seedBuilding();
        const pushed = await patch(app, project.id, { buildTriggers: { push: { enabled: true, debounceMinutes: 3 } } });
        expect(pushed.status).toBe(200);
        expect(((await pushed.json()) as any).environment.buildTriggers.push).toEqual({
          enabled: true,
          debounceMinutes: 3,
        });

        const bad = await patch(app, project.id, {
          buildTriggers: { schedule: { enabled: true, cron: 'not a cron' } },
        });
        expect(bad.status).toBe(400);
        expect(((await bad.json()) as any).issues[0].path).toEqual(['buildTriggers', 'schedule', 'cron']);
        expect((await patch(app, project.id, { buildTriggers: { schedule: { enabled: true } } })).status).toBe(400);

        const scheduled = await patch(app, project.id, {
          buildTriggers: { schedule: { enabled: true, cron: '0 3 * * *', timezone: 'UTC' } },
        });
        expect(scheduled.status).toBe(200);
        expect(((await scheduled.json()) as any).environment.buildTriggers.schedule).toEqual({
          enabled: true,
          cron: '0 3 * * *',
          timezone: 'UTC',
          scheduleAvailable: true,
        });
        const row = await mastra.schedules.get(scheduleIdFor(project.id));
        expect(row).toMatchObject({
          workflowId: ENVIRONMENT_BUILD_WORKFLOW_ID,
          cron: '0 3 * * *',
          status: 'active',
          inputData: { projectId: project.id, trigger: 'schedule' },
        });

        const paused = await patch(app, project.id, { buildTriggers: { schedule: { enabled: false } } });
        expect(((await paused.json()) as any).environment.buildTriggers.schedule).toMatchObject({
          enabled: false,
          cron: '0 3 * * *',
        });
        expect((await mastra.schedules.get(scheduleIdFor(project.id)))?.status).toBe('paused');
      });

      it('starts a build when a setting changes and reports buildRequested', async () => {
        const { app, project, sandbox } = await seedBuilding();
        const unchanged = await patch(app, project.id, { buildTriggers: { push: { enabled: true } } });
        expect(((await unchanged.json()) as any).environment.buildRequested).toBe(false);
        expect(sandbox.starts).toEqual([]);

        const changed = await patch(app, project.id, { settings: { cpuCount: 4 } });
        expect(changed.status).toBe(200);
        const body = (await changed.json()) as any;
        expect(body.environment.buildRequested).toBe(true);
        expect(body.environment.build).toMatchObject({ buildId: 'tpl-1:build-1' });
        expect(sandbox.starts).toEqual([{ sessionId: `environment-build:${project.id}`, settings: { cpuCount: 4 } }]);
      });
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
    });
  });
});
