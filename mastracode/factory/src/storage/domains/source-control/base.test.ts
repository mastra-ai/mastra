import { LibSQLFactoryStorage } from '@mastra/libsql';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FactoryProjectsStorage } from '../projects/base.js';
import { SourceControlStorage } from './base.js';
import type { ProjectRepository, SourceControlStorageHandle } from './base.js';

const repositoryInput = {
  externalId: 'repository-34',
  slug: 'mastra-ai/mastra',
  defaultBranch: 'main',
  providerMetadata: { visibility: 'public' },
};

const projectRepositoryInput = {
  createdByUserId: 'user-1',
  branch: null,
  sandboxProvider: 'local',
  sandboxWorkdir: '/workspace/mastra',
};

describe('SourceControlStorage', () => {
  let backend: LibSQLFactoryStorage;
  let projects: FactoryProjectsStorage;
  let domain: SourceControlStorage;
  let github: SourceControlStorageHandle;
  let gitlab: SourceControlStorageHandle;

  beforeEach(async () => {
    backend = new LibSQLFactoryStorage({ id: 'source-control-test', url: ':memory:' });
    projects = backend.registerDomain(new FactoryProjectsStorage());
    domain = backend.registerDomain(new SourceControlStorage());
    await backend.init();
    github = domain.forIntegration('github');
    gitlab = domain.forIntegration('gitlab');
  });

  afterEach(async () => {
    await backend.close();
  });

  async function createProject(args: { orgId?: string; name?: string } = {}) {
    return projects.create({
      orgId: args.orgId ?? 'org-1',
      userId: 'user-1',
      input: { name: args.name ?? 'Factory project' },
    });
  }

  async function createInstallation(
    handle: SourceControlStorageHandle,
    args: { orgId?: string; externalId?: string } = {},
  ) {
    return handle.installations.upsert({
      orgId: args.orgId ?? 'org-1',
      connectedByUserId: 'user-1',
      externalId: args.externalId ?? `${handle.integrationId}-installation`,
      accountName: 'mastra-ai',
      accountType: 'organization',
    });
  }

  async function linkRepository(args: {
    handle?: SourceControlStorageHandle;
    factoryProjectId: string;
    installationId?: string;
    repositoryExternalId?: string;
    repositorySlug?: string;
  }): Promise<ProjectRepository> {
    const handle = args.handle ?? github;
    const installation = args.installationId
      ? await handle.installations.get({ orgId: 'org-1', id: args.installationId })
      : await createInstallation(handle);
    if (!installation) throw new Error('Test installation not found.');
    const repository = await handle.repositories.upsert({
      orgId: 'org-1',
      input: {
        installationId: installation.id,
        ...repositoryInput,
        externalId: args.repositoryExternalId ?? repositoryInput.externalId,
        slug: args.repositorySlug ?? repositoryInput.slug,
      },
    });
    const connection = await handle.connections.create({
      orgId: 'org-1',
      factoryProjectId: args.factoryProjectId,
      installationId: installation.id,
      createdByUserId: 'user-1',
    });
    return handle.projectRepositories.link({
      orgId: 'org-1',
      connectionId: connection.id,
      repositoryId: repository.id,
      ...projectRepositoryInput,
    });
  }

  it('rejects empty integration ids and access before registration', async () => {
    expect(() => domain.forIntegration('')).toThrow(/must not be empty/);
    await expect(
      new SourceControlStorage().forIntegration('github').installations.list({ orgId: 'org-1' }),
    ).rejects.toThrow(/has not been registered/);
  });

  it('stores concrete installations and repositories isolated by integration', async () => {
    const githubInstallation = await createInstallation(github, { externalId: 'shared-installation' });
    const gitlabInstallation = await createInstallation(gitlab, { externalId: 'shared-installation' });

    expect(githubInstallation.id).not.toBe(gitlabInstallation.id);
    expect(
      await github.installations.findByExternalId({ orgId: 'org-1', externalId: 'shared-installation' }),
    ).toMatchObject({
      integrationId: 'github',
    });
    expect(await github.installations.get({ orgId: 'org-1', id: gitlabInstallation.id })).toBeNull();

    const githubRepository = await github.repositories.upsert({
      orgId: 'org-1',
      input: { installationId: githubInstallation.id, ...repositoryInput },
    });
    const gitlabRepository = await gitlab.repositories.upsert({
      orgId: 'org-1',
      input: { installationId: gitlabInstallation.id, ...repositoryInput },
    });
    expect(githubRepository.id).not.toBe(gitlabRepository.id);
    expect(await github.repositories.get({ orgId: 'org-1', id: gitlabRepository.id })).toBeNull();
    expect(
      await github.repositories.findBySlug({
        orgId: 'org-1',
        installationId: githubInstallation.id,
        slug: repositoryInput.slug,
      }),
    ).toMatchObject({ id: githubRepository.id });
  });

  it('links one Factory project to multiple provider installations and multiple repositories per connection', async () => {
    const project = await createProject();
    const githubInstallation = await createInstallation(github);
    const gitlabInstallation = await createInstallation(gitlab);
    const githubConnection = await github.connections.create({
      orgId: 'org-1',
      factoryProjectId: project.id,
      installationId: githubInstallation.id,
      createdByUserId: 'user-1',
    });
    await gitlab.connections.create({
      orgId: 'org-1',
      factoryProjectId: project.id,
      installationId: gitlabInstallation.id,
      createdByUserId: 'user-1',
    });

    const firstRepository = await github.repositories.upsert({
      orgId: 'org-1',
      input: { installationId: githubInstallation.id, ...repositoryInput },
    });
    const secondRepository = await github.repositories.upsert({
      orgId: 'org-1',
      input: {
        installationId: githubInstallation.id,
        ...repositoryInput,
        externalId: 'repository-35',
        slug: 'mastra-ai/docs',
      },
    });
    await Promise.all(
      [firstRepository, secondRepository].map(repository =>
        github.projectRepositories.link({
          orgId: 'org-1',
          connectionId: githubConnection.id,
          repositoryId: repository.id,
          ...projectRepositoryInput,
        }),
      ),
    );

    expect(await github.connections.list({ orgId: 'org-1', factoryProjectId: project.id })).toHaveLength(1);
    expect(await gitlab.connections.list({ orgId: 'org-1', factoryProjectId: project.id })).toHaveLength(1);
    expect(await github.projectRepositories.list({ orgId: 'org-1', connectionId: githubConnection.id })).toHaveLength(
      2,
    );
  });

  it('allows one provider repository to link to multiple Factory projects with independent configuration', async () => {
    const firstProject = await createProject({ name: 'First' });
    const secondProject = await createProject({ name: 'Second' });
    const installation = await createInstallation(github);
    const repository = await github.repositories.upsert({
      orgId: 'org-1',
      input: { installationId: installation.id, ...repositoryInput },
    });
    const firstConnection = await github.connections.create({
      orgId: 'org-1',
      factoryProjectId: firstProject.id,
      installationId: installation.id,
      createdByUserId: 'user-1',
    });
    const secondConnection = await github.connections.create({
      orgId: 'org-1',
      factoryProjectId: secondProject.id,
      installationId: installation.id,
      createdByUserId: 'user-1',
    });
    const firstLink = await github.projectRepositories.link({
      orgId: 'org-1',
      connectionId: firstConnection.id,
      repositoryId: repository.id,
      ...projectRepositoryInput,
      branch: 'main',
      setupCommand: 'pnpm install',
    });
    const secondLink = await github.projectRepositories.link({
      orgId: 'org-1',
      connectionId: secondConnection.id,
      repositoryId: repository.id,
      ...projectRepositoryInput,
      branch: 'develop',
      sandboxProvider: 'railway',
    });

    expect(firstLink).toMatchObject({ repositoryId: repository.id, branch: 'main', setupCommand: 'pnpm install' });
    expect(secondLink).toMatchObject({ repositoryId: repository.id, branch: 'develop', sandboxProvider: 'railway' });
    expect(firstLink.id).not.toBe(secondLink.id);
  });

  it('scopes sandboxes and worktrees to the project-repository link', async () => {
    const project = await createProject();
    const firstLink = await linkRepository({ factoryProjectId: project.id });
    const secondLink = await linkRepository({
      factoryProjectId: project.id,
      repositoryExternalId: 'repository-35',
      repositorySlug: 'mastra-ai/docs',
    });
    const [firstSandbox, duplicateSandbox, secondSandbox] = await Promise.all([
      github.sandboxes.getOrCreate({ projectRepository: firstLink, userId: 'user-1' }),
      github.sandboxes.getOrCreate({ projectRepository: firstLink, userId: 'user-1' }),
      github.sandboxes.getOrCreate({ projectRepository: secondLink, userId: 'user-1' }),
    ]);
    expect(duplicateSandbox.id).toBe(firstSandbox.id);
    expect(secondSandbox.id).not.toBe(firstSandbox.id);
    expect(await gitlab.sandboxes.getById({ id: firstSandbox.id })).toBeNull();

    await github.worktrees.upsert({
      projectRepositoryId: firstLink.id,
      userId: 'user-1',
      branch: 'feature/a',
      baseBranch: 'main',
      worktreePath: '/workspace/worktrees/a',
    });
    expect(
      await github.worktrees.get({ projectRepositoryId: firstLink.id, userId: 'user-1', branch: 'feature/a' }),
    ).not.toBeNull();
    expect(
      await github.worktrees.get({ projectRepositoryId: secondLink.id, userId: 'user-1', branch: 'feature/a' }),
    ).toBeNull();
  });

  it('rejects cross-org, cross-provider, and cross-installation links', async () => {
    const project = await createProject();
    const otherProject = await createProject({ orgId: 'org-2', name: 'Other org' });
    const firstInstallation = await createInstallation(github);
    const secondInstallation = await createInstallation(github, { externalId: 'github-installation-2' });
    const gitlabInstallation = await createInstallation(gitlab);
    const connection = await github.connections.create({
      orgId: 'org-1',
      factoryProjectId: project.id,
      installationId: firstInstallation.id,
      createdByUserId: 'user-1',
    });
    const otherRepository = await github.repositories.upsert({
      orgId: 'org-1',
      input: { installationId: secondInstallation.id, ...repositoryInput },
    });

    await expect(
      github.connections.create({
        orgId: 'org-1',
        factoryProjectId: otherProject.id,
        installationId: firstInstallation.id,
        createdByUserId: 'user-1',
      }),
    ).rejects.toThrow(/Factory project not found/);
    await expect(
      github.connections.create({
        orgId: 'org-1',
        factoryProjectId: project.id,
        installationId: gitlabInstallation.id,
        createdByUserId: 'user-1',
      }),
    ).rejects.toThrow(/installation not found/);
    await expect(
      github.projectRepositories.link({
        orgId: 'org-1',
        connectionId: connection.id,
        repositoryId: otherRepository.id,
        ...projectRepositoryInput,
      }),
    ).rejects.toThrow(/does not belong to the connection installation/);
  });

  it('clears every owned source-control collection', async () => {
    const project = await createProject();
    const link = await linkRepository({ factoryProjectId: project.id });
    await github.sandboxes.getOrCreate({ projectRepository: link, userId: 'user-1' });
    await github.worktrees.upsert({
      projectRepositoryId: link.id,
      userId: 'user-1',
      branch: 'feature/a',
      baseBranch: 'main',
      worktreePath: '/workspace/worktrees/a',
    });

    await domain.dangerouslyClearAll();

    expect(await github.installations.list({ orgId: 'org-1' })).toEqual([]);
    expect(await github.projectRepositories.get({ orgId: 'org-1', id: link.id })).toBeNull();
  });
});
