import { LibSQLFactoryStorage } from '@mastra/libsql';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { baseCheckpointIsStale } from '../../../sandbox/base-checkpoint-triggers.js';
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

  it('stores, reads, and clears base-checkpoint metadata', async () => {
    const project = await createProject();
    const link = await linkRepository({ factoryProjectId: project.id });
    expect(link.baseCheckpoint).toBeNull();

    const builtAt = new Date();
    await github.projectRepositories.setBaseCheckpoint({
      id: link.id,
      checkpoint: { name: `repo-${link.id}`, sha: 'abc123', builtAt, setupCommandHash: 'hash-1' },
    });
    let fresh = await github.projectRepositories.get({ orgId: 'org-1', id: link.id });
    expect(fresh?.baseCheckpoint).toMatchObject({ name: `repo-${link.id}`, sha: 'abc123', setupCommandHash: 'hash-1' });

    await github.projectRepositories.setBaseCheckpoint({ id: link.id, checkpoint: null });
    fresh = await github.projectRepositories.get({ orgId: 'org-1', id: link.id });
    expect(fresh?.baseCheckpoint).toBeNull();
  });

  it('round-trips a null setupCommandHash so no-setup-command checkpoints stay fresh', async () => {
    const project = await createProject();
    const link = await linkRepository({ factoryProjectId: project.id });
    await github.projectRepositories.setBaseCheckpoint({
      id: link.id,
      checkpoint: { name: `repo-${link.id}`, sha: 'abc123', builtAt: new Date(), setupCommandHash: null },
    });
    const fresh = await github.projectRepositories.get({ orgId: 'org-1', id: link.id });
    // Must stay null (not ''), otherwise baseCheckpointIsStale() compares
    // '' !== hashSetupCommand(null) and permanently marks the checkpoint stale.
    expect(fresh?.baseCheckpoint?.setupCommandHash).toBeNull();
    expect(baseCheckpointIsStale(fresh!)).toBe(false);
  });

  it('invalidates base-checkpoint metadata when the setup command changes', async () => {
    const project = await createProject();
    const link = await linkRepository({ factoryProjectId: project.id });
    await github.projectRepositories.setBaseCheckpoint({
      id: link.id,
      checkpoint: { name: `repo-${link.id}`, sha: 'abc123', builtAt: new Date(), setupCommandHash: 'hash-1' },
    });

    // Unrelated update keeps the checkpoint.
    await github.projectRepositories.update({ orgId: 'org-1', id: link.id, input: { branch: 'develop' } });
    let fresh = await github.projectRepositories.get({ orgId: 'org-1', id: link.id });
    expect(fresh?.baseCheckpoint).not.toBeNull();

    // Setup-command change invalidates it.
    await github.projectRepositories.update({ orgId: 'org-1', id: link.id, input: { setupCommand: 'pnpm i' } });
    fresh = await github.projectRepositories.get({ orgId: 'org-1', id: link.id });
    expect(fresh?.baseCheckpoint).toBeNull();
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

  it('releases and claims pooled sandboxes scoped to the project-repository link', async () => {
    const project = await createProject();
    const link = await linkRepository({ factoryProjectId: project.id });

    expect(await github.sandboxPool.claim({ projectRepositoryId: link.id })).toBeNull();

    await github.sandboxPool.release({
      orgId: 'org-1',
      projectRepositoryId: link.id,
      userId: 'user-1',
      sandboxId: 'sandbox-a',
      sandboxWorkdir: '/workspace/mastra',
    });
    await github.sandboxPool.release({
      orgId: 'org-1',
      projectRepositoryId: link.id,
      userId: 'user-1',
      sandboxId: 'sandbox-b',
      sandboxWorkdir: '/workspace/mastra',
    });
    // Releasing the same provider sandbox twice keeps one pool row.
    await github.sandboxPool.release({
      orgId: 'org-1',
      projectRepositoryId: link.id,
      userId: 'user-1',
      sandboxId: 'sandbox-a',
      sandboxWorkdir: '/workspace/mastra',
    });

    expect(await github.sandboxPool.claim({ projectRepositoryId: 'missing' })).toBeNull();

    // The pool is per-repository, not per-user: a different user's session
    // may claim a VM released by user-1 (tokens are never stored in the VM).
    const first = await github.sandboxPool.claim({ projectRepositoryId: link.id });
    const second = await github.sandboxPool.claim({ projectRepositoryId: link.id });
    expect([first?.sandboxId, second?.sandboxId].sort()).toEqual(['sandbox-a', 'sandbox-b']);
    expect([first, second].find(claimed => claimed?.sandboxId === 'sandbox-a')).toMatchObject({
      orgId: 'org-1',
      projectRepositoryId: link.id,
      userId: 'user-1',
      sandboxWorkdir: '/workspace/mastra',
    });
    expect(await github.sandboxPool.claim({ projectRepositoryId: link.id })).toBeNull();
  });

  it('hands one pooled sandbox to exactly one concurrent claimer', async () => {
    const project = await createProject();
    const link = await linkRepository({ factoryProjectId: project.id });
    await github.sandboxPool.release({
      orgId: 'org-1',
      projectRepositoryId: link.id,
      userId: 'user-1',
      sandboxId: 'sandbox-a',
      sandboxWorkdir: '/workspace/mastra',
    });

    const claims = await Promise.all([
      github.sandboxPool.claim({ projectRepositoryId: link.id }),
      github.sandboxPool.claim({ projectRepositoryId: link.id }),
    ]);
    expect(claims.filter(claimed => claimed !== null)).toHaveLength(1);
  });

  it('treats releasing into a missing project repository as a silent no-op', async () => {
    // Best-effort contract: a concurrently unlinked repository must not turn
    // a background release into a thrown error.
    await expect(
      github.sandboxPool.release({
        orgId: 'org-1',
        projectRepositoryId: 'missing',
        userId: 'user-1',
        sandboxId: 'sandbox-a',
        sandboxWorkdir: '/workspace/mastra',
      }),
    ).resolves.toBeUndefined();
    expect(await github.sandboxPool.claim({ projectRepositoryId: 'missing' })).toBeNull();
  });

  it('drops pooled sandboxes when the project repository is unlinked', async () => {
    const project = await createProject();
    const link = await linkRepository({ factoryProjectId: project.id });
    await github.sandboxPool.release({
      orgId: 'org-1',
      projectRepositoryId: link.id,
      userId: 'user-1',
      sandboxId: 'sandbox-a',
      sandboxWorkdir: '/workspace/mastra',
    });

    await github.projectRepositories.unlink({ orgId: 'org-1', id: link.id });

    expect(await github.sandboxPool.claim({ projectRepositoryId: link.id })).toBeNull();
  });

  it('re-points a sandbox binding workdir and clears its materialization', async () => {
    const project = await createProject();
    const link = await linkRepository({ factoryProjectId: project.id });
    const binding = await github.sandboxes.getOrCreate({ projectRepository: link, userId: 'user-1' });
    await github.sandboxes.markMaterialized({ id: binding.id });

    await github.sandboxes.setWorkdir({ id: binding.id, sandboxWorkdir: '/local/mastra-ai/mastra' });

    const updated = await github.sandboxes.getById({ id: binding.id });
    expect(updated).toMatchObject({ sandboxWorkdir: '/local/mastra-ai/mastra', materializedAt: null });
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

  it('round-trips nullable session titles', async () => {
    const project = await createProject();
    const link = await linkRepository({ factoryProjectId: project.id });
    const titled = await github.sessions.create({
      sessionId: '00000000-0000-4000-8000-000000000001',
      projectRepositoryId: link.id,
      orgId: 'org-1',
      userId: 'user-1',
      branch: 'user/session-00000000-0000-4000-8000-000000000001',
      baseBranch: 'main',
      title: 'Fix login flow',
    });
    const untitled = await github.sessions.create({
      sessionId: '00000000-0000-4000-8000-000000000002',
      projectRepositoryId: link.id,
      orgId: 'org-1',
      userId: 'user-1',
      branch: 'user/session-00000000-0000-4000-8000-000000000002',
      baseBranch: 'main',
    });

    expect(titled.title).toBe('Fix login flow');
    expect(untitled.title).toBeNull();
    await expect(github.sessions.getBySessionId(titled.sessionId)).resolves.toMatchObject({
      title: 'Fix login flow',
    });
    await expect(github.sessions.list({ projectRepositoryId: link.id, userId: 'user-1' })).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sessionId: titled.sessionId, title: 'Fix login flow' }),
        expect.objectContaining({ sessionId: untitled.sessionId, title: null }),
      ]),
    );
  });

  it('records first_message_at write-once via markFirstMessage', async () => {
    const project = await createProject();
    const link = await linkRepository({ factoryProjectId: project.id });
    const session = await github.sessions.create({
      sessionId: '00000000-0000-4000-8000-000000000003',
      projectRepositoryId: link.id,
      orgId: 'org-1',
      userId: 'user-1',
      branch: 'user/session-00000000-0000-4000-8000-000000000003',
      baseBranch: 'main',
    });
    expect(session.firstMessageAt).toBeNull();

    await github.sessions.markFirstMessage({ sessionId: session.sessionId });
    const marked = await github.sessions.getBySessionId(session.sessionId);
    expect(marked?.firstMessageAt).toBeInstanceOf(Date);

    // A later call must not move the timestamp: the guarded update only
    // matches rows where the column is still NULL.
    await new Promise(resolve => setTimeout(resolve, 5));
    await github.sessions.markFirstMessage({ sessionId: session.sessionId });
    const again = await github.sessions.getBySessionId(session.sessionId);
    expect(again?.firstMessageAt?.getTime()).toBe(marked!.firstMessageAt!.getTime());

    // Sessions without a source-control row are a zero-row no-op.
    await expect(github.sessions.markFirstMessage({ sessionId: 'missing-session' })).resolves.toBeUndefined();
  });

  it('records first_meaningful_exec_at write-once via markFirstMeaningfulExec', async () => {
    const project = await createProject();
    const link = await linkRepository({ factoryProjectId: project.id });
    const session = await github.sessions.create({
      sessionId: '00000000-0000-4000-8000-000000000004',
      projectRepositoryId: link.id,
      orgId: 'org-1',
      userId: 'user-1',
      branch: 'user/session-00000000-0000-4000-8000-000000000004',
      baseBranch: 'main',
    });
    expect(session.firstMeaningfulExecAt).toBeNull();

    await github.sessions.markFirstMeaningfulExec({ sessionId: session.sessionId });
    const marked = await github.sessions.getBySessionId(session.sessionId);
    expect(marked?.firstMeaningfulExecAt).toBeInstanceOf(Date);

    // A later call must not move the timestamp: the guarded update only
    // matches rows where the column is still NULL.
    await new Promise(resolve => setTimeout(resolve, 5));
    await github.sessions.markFirstMeaningfulExec({ sessionId: session.sessionId });
    const again = await github.sessions.getBySessionId(session.sessionId);
    expect(again?.firstMeaningfulExecAt?.getTime()).toBe(marked!.firstMeaningfulExecAt!.getTime());

    // Sessions without a source-control row are a zero-row no-op.
    await expect(github.sessions.markFirstMeaningfulExec({ sessionId: 'missing-session' })).resolves.toBeUndefined();
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
