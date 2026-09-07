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
) =>
  new ProjectRoutes({
    auth: fakeRouteAuth(),
    projects: seed.projects,
    sourceControl: seed.sourceControl,
    versionControlIntegrationIds,
    sessionRetirement,
    resolveRepository,
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
});
