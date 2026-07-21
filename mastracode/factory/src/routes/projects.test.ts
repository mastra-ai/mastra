import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import type { FactoryStorageTestSeed } from '../storage/test-utils';
import { createFactoryStorageForTests } from '../storage/test-utils';
import { ProjectRoutes } from './projects';
import { fakeRouteAuth, mountApiRoutes } from './test-utils';

const projectRoutes = (seed: FactoryStorageTestSeed, versionControlIntegrationIds?: string[]) =>
  new ProjectRoutes({
    auth: fakeRouteAuth(),
    projects: seed.projects,
    sourceControl: seed.sourceControl,
    versionControlIntegrationIds,
  }).routes();

describe('ProjectRoutes', () => {
  it('creates, lists, reads, updates, and deletes a project without integrations', async () => {
    const seed = await createFactoryStorageForTests();
    const app = new Hono();
    app.use('*', async (context, next) => {
      context.set('webAuthUser' as never, { workosId: 'user-1', organizationId: 'org-1' } as never);
      await next();
    });
    mountApiRoutes(app as never, projectRoutes(seed));

    const createdResponse = await app.request('/web/factory/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: ' Platform ', description: ' Core services ' }),
    });
    expect(createdResponse.status).toBe(201);
    const created = (await createdResponse.json()) as { project: { id: string; name: string; description: string } };
    expect(created.project).toMatchObject({ name: 'Platform', description: 'Core services' });

    const listed = (await (await app.request('/web/factory/projects')).json()) as { projects: Array<{ id: string }> };
    expect(listed.projects.map(project => project.id)).toEqual([created.project.id]);
    expect((await app.request(`/web/factory/projects/${created.project.id}`)).status).toBe(200);

    const updatedResponse = await app.request(`/web/factory/projects/${created.project.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Platform engineering', description: null }),
    });
    expect(updatedResponse.status).toBe(200);
    expect((await updatedResponse.json()) as unknown).toMatchObject({
      project: { name: 'Platform engineering', description: null },
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
        if (user) context.set('webAuthUser' as never, user as never);
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
    const githubRepository = await github.repositories.upsert({
      orgId: 'org-1',
      input: {
        installationId: githubInstallation.id,
        externalId: 'repo-1',
        slug: 'acme/api',
        defaultBranch: 'main',
      },
    });
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
      context.set('webAuthUser' as never, { workosId: 'user-1', organizationId: 'org-1' } as never);
      await next();
    });
    mountApiRoutes(app as never, projectRoutes(seed, ['github', 'gitlab']));

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
          }),
        },
      );
      expect(response.status).toBe(201);
      return ((await response.json()) as { projectRepository: { id: string } }).projectRepository;
    };
    const githubLink = await link(githubConnection.id, githubRepository.id, 'release');
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
      body: JSON.stringify({ branch: 'stable', setupCommand: null }),
    });
    expect(updateResponse.status).toBe(200);
    expect((await updateResponse.json()) as unknown).toMatchObject({
      projectRepository: { branch: 'stable', setupCommand: null, repository: { slug: 'acme/api' } },
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
      context.set('webAuthUser' as never, { workosId: 'user-1', organizationId: 'org-1' } as never);
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

  it('rejects invalid create and update payloads', async () => {
    const seed = await createFactoryStorageForTests();
    const app = new Hono();
    app.use('*', async (context, next) => {
      context.set('webAuthUser' as never, { workosId: 'user-1', organizationId: 'org-1' } as never);
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
