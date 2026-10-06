import { LibSQLFactoryStorage } from '@mastra/libsql';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FactoryProjectsStorage } from '../projects/base.js';
import { SourceControlStorage } from './base.js';
import type { ProjectRepository, SourceControlStorageHandle } from './base.js';
import { SourceControlStorageInMemory } from './inmemory.js';

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
      teardownCommand: 'pnpm local worktree teardown',
    });
    const secondLink = await github.projectRepositories.link({
      orgId: 'org-1',
      connectionId: secondConnection.id,
      repositoryId: repository.id,
      ...projectRepositoryInput,
      branch: 'develop',
      sandboxProvider: 'railway',
    });

    expect(firstLink).toMatchObject({
      repositoryId: repository.id,
      branch: 'main',
      setupCommand: 'pnpm install',
      teardownCommand: 'pnpm local worktree teardown',
    });
    await github.projectRepositories.update({
      orgId: 'org-1',
      id: firstLink.id,
      input: { teardownCommand: 'docker compose down --remove-orphans' },
    });
    expect(await github.projectRepositories.get({ orgId: 'org-1', id: firstLink.id })).toMatchObject({
      teardownCommand: 'docker compose down --remove-orphans',
    });
    expect(secondLink).toMatchObject({ repositoryId: repository.id, branch: 'develop', sandboxProvider: 'railway' });
    expect(firstLink.id).not.toBe(secondLink.id);
  });

  it('returns the existing row unchanged when link() is retried for the same connection', async () => {
    const project = await createProject();
    const installation = await createInstallation(github);
    const repository = await github.repositories.upsert({
      orgId: 'org-1',
      input: { installationId: installation.id, ...repositoryInput },
    });
    const connection = await github.connections.create({
      orgId: 'org-1',
      factoryProjectId: project.id,
      installationId: installation.id,
      createdByUserId: 'user-1',
    });
    const firstLink = await github.projectRepositories.link({
      orgId: 'org-1',
      connectionId: connection.id,
      repositoryId: repository.id,
      ...projectRepositoryInput,
    });
    const retried = await github.projectRepositories.link({
      orgId: 'org-1',
      connectionId: connection.id,
      repositoryId: repository.id,
      ...projectRepositoryInput,
      branch: 'retry-should-not-overwrite',
    });
    const fresh = await github.projectRepositories.get({ orgId: 'org-1', id: firstLink.id });

    expect(retried.id).toBe(firstLink.id);
    expect(retried.branch).toBeNull();
    expect(fresh?.id).toBe(firstLink.id);
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
    await expect(github.sessions.list({ projectRepositoryId: link.id, viewerUserId: 'user-1' })).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sessionId: titled.sessionId, title: 'Fix login flow' }),
        expect.objectContaining({ sessionId: untitled.sessionId, title: null }),
      ]),
    );
  });

  it('defaults session visibility to org and round-trips private', async () => {
    const project = await createProject();
    const link = await linkRepository({ factoryProjectId: project.id });
    const defaulted = await github.sessions.create({
      sessionId: '00000000-0000-4000-8000-000000000011',
      projectRepositoryId: link.id,
      orgId: 'org-1',
      userId: 'user-1',
      branch: 'user/session-00000000-0000-4000-8000-000000000011',
      baseBranch: 'main',
    });
    expect(defaulted.visibility).toBe('org');

    const dm = await github.sessions.create({
      sessionId: '00000000-0000-4000-8000-000000000012',
      projectRepositoryId: link.id,
      orgId: 'org-1',
      userId: 'user-1',
      branch: 'slack/1786574059-209929',
      baseBranch: 'main',
      visibility: 'private',
    });
    expect(dm.visibility).toBe('private');
    await expect(github.sessions.getBySessionId(dm.sessionId)).resolves.toMatchObject({
      visibility: 'private',
    });
    await expect(
      github.sessions.getForBranch({
        projectRepositoryId: link.id,
        userId: 'user-1',
        branch: 'slack/1786574059-209929',
      }),
    ).resolves.toMatchObject({ visibility: 'private' });
  });

  it('reads NULL visibility as org for rows created before the column existed', async () => {
    const project = await createProject();
    const link = await linkRepository({ factoryProjectId: project.id });
    const session = await github.sessions.create({
      sessionId: '00000000-0000-4000-8000-000000000013',
      projectRepositoryId: link.id,
      orgId: 'org-1',
      userId: 'user-1',
      branch: 'user/session-00000000-0000-4000-8000-000000000013',
      baseBranch: 'main',
      visibility: 'private',
    });

    // Simulate a legacy row from before the visibility column existed.
    await backend.ops.updateMany('source_control_sessions', { session_id: session.sessionId }, { visibility: null });
    await expect(github.sessions.getBySessionId(session.sessionId)).resolves.toMatchObject({
      visibility: 'org',
    });
  });

  it("lists org-visible sessions from all users plus the viewer's own private ones", async () => {
    const project = await createProject();
    const link = await linkRepository({ factoryProjectId: project.id });
    const create = (sessionId: string, userId: string, visibility?: 'org' | 'private') =>
      github.sessions.create({
        sessionId,
        projectRepositoryId: link.id,
        orgId: 'org-1',
        userId,
        branch: `user/session-${sessionId}`,
        baseBranch: 'main',
        ...(visibility ? { visibility } : {}),
      });
    const orgOther = await create('00000000-0000-4000-8000-000000000021', 'user-1', 'org');
    const privateOther = await create('00000000-0000-4000-8000-000000000022', 'user-1', 'private');
    const privateMine = await create('00000000-0000-4000-8000-000000000023', 'user-2', 'private');
    const legacyNull = await create('00000000-0000-4000-8000-000000000024', 'user-1');
    // Simulate a legacy row from before the visibility column existed.
    await backend.ops.updateMany('source_control_sessions', { session_id: legacyNull.sessionId }, { visibility: null });

    const listed = await github.sessions.list({ projectRepositoryId: link.id, viewerUserId: 'user-2' });
    const ids = listed.map(s => s.sessionId).sort();
    expect(ids).toEqual([orgOther.sessionId, privateMine.sessionId, legacyNull.sessionId].sort());
    expect(ids).not.toContain(privateOther.sessionId);
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

  it('records materialized_at write-once via sessions.markMaterialized', async () => {
    const project = await createProject();
    const link = await linkRepository({ factoryProjectId: project.id });
    const session = await github.sessions.create({
      sessionId: '00000000-0000-4000-8000-000000000005',
      projectRepositoryId: link.id,
      orgId: 'org-1',
      userId: 'user-1',
      branch: 'user/session-00000000-0000-4000-8000-000000000005',
      baseBranch: 'main',
    });
    expect(session.materializedAt).toBeNull();

    await github.sessions.markMaterialized({ id: session.id });
    const marked = await github.sessions.getBySessionId(session.sessionId);
    expect(marked?.materializedAt).toBeInstanceOf(Date);

    // A resume (second markMaterialized call) must not move the timestamp:
    // the guarded update only matches rows where the column is still NULL.
    // Without this, `materialize_s = materialized_at - created_at` counts the
    // entire idle-and-resume duration as initial-materialize latency.
    await new Promise(resolve => setTimeout(resolve, 5));
    await github.sessions.markMaterialized({ id: session.id });
    const again = await github.sessions.getBySessionId(session.sessionId);
    expect(again?.materializedAt?.getTime()).toBe(marked!.materializedAt!.getTime());
  });

  it('clears every owned source-control collection', async () => {
    const project = await createProject();
    const link = await linkRepository({ factoryProjectId: project.id });

    await domain.dangerouslyClearAll();

    expect(await github.installations.list({ orgId: 'org-1' })).toEqual([]);
    expect(await github.projectRepositories.get({ orgId: 'org-1', id: link.id })).toBeNull();
  });

  describe('environment', () => {
    /** Links under their own installation + connection so one project can hold the same slug several times. */
    async function linkUnderOwnInstallation(args: {
      factoryProjectId: string;
      externalId: string;
      slug: string;
      createdAt: Date;
      handle?: SourceControlStorageHandle;
      sandboxWorkdir?: string;
    }): Promise<ProjectRepository> {
      const handle = args.handle ?? github;
      const installation = await createInstallation(handle, { externalId: `installation-${args.externalId}` });
      const repository = await handle.repositories.upsert({
        orgId: 'org-1',
        input: { installationId: installation.id, ...repositoryInput, externalId: args.externalId, slug: args.slug },
      });
      const connection = await handle.connections.create({
        orgId: 'org-1',
        factoryProjectId: args.factoryProjectId,
        installationId: installation.id,
        createdByUserId: 'user-1',
      });
      const link = await handle.projectRepositories.link({
        orgId: 'org-1',
        connectionId: connection.id,
        repositoryId: repository.id,
        ...projectRepositoryInput,
        sandboxWorkdir: args.sandboxWorkdir ?? projectRepositoryInput.sandboxWorkdir,
      });
      await backend.ops.updateMany('factory_project_repositories', { id: link.id }, { created_at: args.createdAt });
      return link;
    }

    /** Put rows back into the shape they had before the environment columns existed. */
    async function resetToPreEnvironmentShape(projectId: string): Promise<void> {
      await backend.ops.updateMany('factory_project_repositories', {}, { position: 0, in_environment: true });
      await backend.ops.updateMany(
        'factory_projects',
        { id: projectId },
        { sandbox_provider: null, sandbox_workdir: null, sandbox_cpu_count: null, sandbox_memory_mb: null },
      );
    }

    async function snapshot() {
      return {
        projects: await backend.ops.findMany('factory_projects', {}, { orderBy: [['id', 'asc']] }),
        links: await backend.ops.findMany('factory_project_repositories', {}, { orderBy: [['id', 'asc']] }),
      };
    }

    const at = (second: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, second));

    async function seedDuplicateSlugProject() {
      const project = await createProject();
      const first = await linkUnderOwnInstallation({
        factoryProjectId: project.id,
        externalId: 'r1',
        slug: 'mastra-ai/mastra',
        createdAt: at(1),
        sandboxWorkdir: '/workspace/oldest',
      });
      const second = await linkUnderOwnInstallation({
        factoryProjectId: project.id,
        externalId: 'r2',
        slug: 'mastra-ai/mastra',
        createdAt: at(2),
        handle: gitlab,
      });
      const third = await linkUnderOwnInstallation({
        factoryProjectId: project.id,
        externalId: 'r3',
        slug: 'mastra-ai/docs',
        createdAt: at(3),
      });
      const fourth = await linkUnderOwnInstallation({
        factoryProjectId: project.id,
        externalId: 'r4',
        slug: 'mastra-ai/mastra',
        createdAt: at(4),
      });
      await resetToPreEnvironmentShape(project.id);
      return { project, first, second, third, fourth };
    }

    it('backfills positions, dedupes slugs and copies the oldest link onto the project', async () => {
      const { project, first, second, third, fourth } = await seedDuplicateSlugProject();

      await domain.init();

      const linkRow = async (id: string) =>
        backend.ops.findOne<{ position: number; in_environment: boolean }>('factory_project_repositories', { id });
      expect(await linkRow(first.id)).toMatchObject({ position: 1, in_environment: true });
      expect(await linkRow(second.id)).toMatchObject({ position: 2, in_environment: false });
      expect(await linkRow(third.id)).toMatchObject({ position: 3, in_environment: true });
      expect(await linkRow(fourth.id)).toMatchObject({ position: 4, in_environment: false });
      expect(await projects.getById({ id: project.id })).toMatchObject({
        sandboxProvider: 'local',
        sandboxWorkdir: '/workspace/oldest',
        sandboxCpuCount: 4,
        sandboxMemoryMb: 8192,
      });
    });

    it('is a no-op when re-run', async () => {
      await seedDuplicateSlugProject();
      await domain.init();
      const before = await snapshot();

      await domain.init();

      expect(await snapshot()).toEqual(before);
    });

    it('leaves a new project unconfigured until the next init, then fills resources and the oldest link', async () => {
      const withLink = await createProject({ name: 'with link' });
      const withoutLink = await createProject({ name: 'without link' });
      expect(await projects.getById({ id: withLink.id })).toMatchObject({
        sandboxProvider: null,
        sandboxWorkdir: null,
        sandboxCpuCount: null,
        sandboxMemoryMb: null,
        sandboxIdleTimeoutMinutes: null,
        workspaceSetupCommand: null,
        activeTemplateId: null,
        activeTemplateHeads: null,
      });
      await linkUnderOwnInstallation({
        factoryProjectId: withLink.id,
        externalId: 'r1',
        slug: 'mastra-ai/mastra',
        createdAt: at(1),
        sandboxWorkdir: '/workspace/linked',
      });

      await domain.init();

      expect(await projects.getById({ id: withLink.id })).toMatchObject({
        sandboxProvider: 'local',
        sandboxWorkdir: '/workspace/linked',
        sandboxCpuCount: 4,
        sandboxMemoryMb: 8192,
      });
      expect(await projects.getById({ id: withoutLink.id })).toMatchObject({
        sandboxProvider: null,
        sandboxWorkdir: null,
        sandboxCpuCount: 4,
        sandboxMemoryMb: 8192,
      });
    });

    it('adds the project columns itself when the projects domain has not initialized yet', async () => {
      const fresh = new LibSQLFactoryStorage({ id: 'source-control-order-test', url: ':memory:' });
      const sourceControl = fresh.registerDomain(new SourceControlStorage());
      const projectsDomain = fresh.registerDomain(new FactoryProjectsStorage());
      try {
        await sourceControl.init();
        expect(
          await fresh.ops.findMany('factory_projects', { sandbox_cpu_count: null }, { orderBy: [['id', 'asc']] }),
        ).toEqual([]);

        await Promise.all([sourceControl.init(), projectsDomain.init()]);
        const created = await projectsDomain.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Late' } });
        expect(created.sandboxCpuCount).toBeNull();
      } finally {
        await fresh.close();
      }
    });

    it('never overwrites values a user set between boots', async () => {
      const { project, second } = await seedDuplicateSlugProject();
      await domain.init();
      await projects.update({ orgId: 'org-1', id: project.id, input: { sandboxWorkdir: '/workspace/custom' } });
      await gitlab.projectRepositories.update({ orgId: 'org-1', id: second.id, input: { inEnvironment: true } });
      await backend.ops.updateMany('factory_projects', { id: project.id }, { sandbox_cpu_count: null });

      await domain.init();

      expect(await projects.getById({ id: project.id })).toMatchObject({
        sandboxWorkdir: '/workspace/custom',
        sandboxCpuCount: 4,
      });
      expect(await gitlab.projectRepositories.get({ orgId: 'org-1', id: second.id })).toMatchObject({
        position: 2,
        inEnvironment: true,
      });
    });

    it('link assigns the next position and keeps a duplicate slug out of the environment', async () => {
      const project = await createProject();
      const first = await linkUnderOwnInstallation({
        factoryProjectId: project.id,
        externalId: 'r1',
        slug: 'mastra-ai/mastra',
        createdAt: at(1),
      });
      const duplicate = await linkUnderOwnInstallation({
        factoryProjectId: project.id,
        externalId: 'r2',
        slug: 'mastra-ai/mastra',
        createdAt: at(2),
        handle: gitlab,
      });
      const other = await linkUnderOwnInstallation({
        factoryProjectId: project.id,
        externalId: 'r3',
        slug: 'mastra-ai/docs',
        createdAt: at(3),
      });

      expect(first).toMatchObject({ position: 1, inEnvironment: true, lastBuildStatus: 'unbuilt' });
      expect(duplicate).toMatchObject({ position: 2, inEnvironment: false });
      expect(other).toMatchObject({ position: 3, inEnvironment: true });
    });

    it('listByProject orders by position within the handle integration', async () => {
      const project = await createProject();
      const a = await linkUnderOwnInstallation({
        factoryProjectId: project.id,
        externalId: 'r1',
        slug: 'mastra-ai/a',
        createdAt: at(1),
      });
      const b = await linkUnderOwnInstallation({
        factoryProjectId: project.id,
        externalId: 'r2',
        slug: 'mastra-ai/b',
        createdAt: at(2),
      });
      const c = await linkUnderOwnInstallation({
        factoryProjectId: project.id,
        externalId: 'r3',
        slug: 'mastra-ai/c',
        createdAt: at(3),
        handle: gitlab,
      });
      await github.projectRepositories.update({ orgId: 'org-1', id: a.id, input: { position: 5 } });

      expect(
        (await github.projectRepositories.listByProject({ orgId: 'org-1', factoryProjectId: project.id })).map(
          link => link.id,
        ),
      ).toEqual([b.id, a.id]);
      expect(
        (await gitlab.projectRepositories.listByProject({ orgId: 'org-1', factoryProjectId: project.id })).map(
          link => link.id,
        ),
      ).toEqual([c.id]);
      expect(
        await github.projectRepositories.listByProject({ orgId: 'other-org', factoryProjectId: project.id }),
      ).toEqual([]);
    });

    it('update round-trips position and inEnvironment; setBuildStatus records the last build', async () => {
      const project = await createProject();
      const link = await linkRepository({ factoryProjectId: project.id });

      const updated = await github.projectRepositories.update({
        orgId: 'org-1',
        id: link.id,
        input: { position: 7, inEnvironment: false },
      });
      expect(updated).toMatchObject({ position: 7, inEnvironment: false, lastBuildStatus: 'unbuilt' });

      const builtAt = at(10);
      expect(
        await github.projectRepositories.setBuildStatus({
          orgId: 'org-1',
          id: link.id,
          status: 'failed',
          error: 'pnpm install exited 1',
          builtAt,
        }),
      ).toMatchObject({ lastBuildStatus: 'failed', lastBuildError: 'pnpm install exited 1', lastBuiltAt: builtAt });
      expect(
        await github.projectRepositories.setBuildStatus({ orgId: 'other-org', id: link.id, status: 'configured' }),
      ).toBeNull();
    });

    it('the in-memory handle mirrors link ordering, dedupe, listByProject and setBuildStatus', async () => {
      const store = new SourceControlStorageInMemory();
      const installation = await store.installations.upsert({
        orgId: 'org-1',
        connectedByUserId: 'user-1',
        externalId: '1',
      });
      const connection = await store.connections.create({
        orgId: 'org-1',
        factoryProjectId: 'project-1',
        installationId: installation.id,
        createdByUserId: 'user-1',
      });
      const linkSlug = async (externalId: string, slug: string) => {
        const repository = await store.repositories.upsert({
          orgId: 'org-1',
          input: { installationId: installation.id, externalId, slug, defaultBranch: 'main' },
        });
        return store.projectRepositories.link({
          orgId: 'org-1',
          connectionId: connection.id,
          repositoryId: repository.id,
          ...projectRepositoryInput,
        });
      };
      const first = await linkSlug('1', 'mastra-ai/mastra');
      const duplicate = await linkSlug('2', 'mastra-ai/mastra');
      const other = await linkSlug('3', 'mastra-ai/docs');
      expect(first).toMatchObject({ position: 1, inEnvironment: true });
      expect(duplicate).toMatchObject({ position: 2, inEnvironment: false });
      expect(other).toMatchObject({ position: 3, inEnvironment: true });

      await store.projectRepositories.update({ orgId: 'org-1', id: first.id, input: { position: 9 } });
      expect(
        (await store.projectRepositories.listByProject({ orgId: 'org-1', factoryProjectId: 'project-1' })).map(
          link => link.id,
        ),
      ).toEqual([duplicate.id, other.id, first.id]);
      expect(
        await store.projectRepositories.setBuildStatus({
          orgId: 'org-1',
          id: other.id,
          status: 'configured',
          builtAt: at(1),
        }),
      ).toMatchObject({ lastBuildStatus: 'configured', lastBuildError: null, lastBuiltAt: at(1) });
    });
  });
});

describe('SourceControlStorageInMemory sessions.markMaterialized', () => {
  it('records materialized_at write-once', async () => {
    const store = new SourceControlStorageInMemory();
    const installation = await store.installations.upsert({
      orgId: 'org-1',
      connectedByUserId: 'user-1',
      externalId: '1',
    });
    const repository = await store.repositories.upsert({
      orgId: 'org-1',
      input: { installationId: installation.id, externalId: '2', slug: 'mastra-ai/mastra', defaultBranch: 'main' },
    });
    const connection = await store.connections.create({
      orgId: 'org-1',
      factoryProjectId: 'project-1',
      installationId: installation.id,
      createdByUserId: 'user-1',
    });
    const link = await store.projectRepositories.link({
      orgId: 'org-1',
      connectionId: connection.id,
      repositoryId: repository.id,
      createdByUserId: 'user-1',
      sandboxProvider: 'local',
      sandboxWorkdir: '/sandbox/mastra',
    });
    const session = await store.sessions.create({
      sessionId: '00000000-0000-4000-8000-00000000aaaa',
      projectRepositoryId: link.id,
      orgId: 'org-1',
      userId: 'user-1',
      branch: 'user/session-00000000-0000-4000-8000-00000000aaaa',
      baseBranch: 'main',
    });
    expect(session.materializedAt).toBeNull();

    await store.sessions.markMaterialized({ id: session.id });
    const first = await store.sessions.getBySessionId(session.sessionId);
    expect(first?.materializedAt).toBeInstanceOf(Date);

    await new Promise(resolve => setTimeout(resolve, 5));
    await store.sessions.markMaterialized({ id: session.id });
    const second = await store.sessions.getBySessionId(session.sessionId);
    expect(second?.materializedAt?.getTime()).toBe(first!.materializedAt!.getTime());
  });
});
