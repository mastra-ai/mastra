import { UniqueViolationError } from '@mastra/core/storage';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

  describe('session factory', () => {
    const sessionInput = (sessionId: string, projectRepositoryId: string, userId = 'user-1', branch = 'feat/x') => ({
      sessionId,
      projectRepositoryId,
      orgId: 'org-1',
      userId,
      branch,
      baseBranch: 'main',
    });

    /** A session row written the way the code before `factory_project_id` wrote it. */
    async function insertLegacySession(args: {
      sessionId: string;
      projectRepositoryId: string;
      userId?: string;
      branch?: string;
      createdAt: Date;
    }) {
      return backend.ops.insertOne<{ id: string }>('source_control_sessions', {
        session_id: args.sessionId,
        project_repository_id: args.projectRepositoryId,
        org_id: 'org-1',
        user_id: args.userId ?? 'user-1',
        branch: args.branch ?? 'feat/x',
        base_branch: 'main',
        title: null,
        visibility: null,
        sandbox_id: null,
        sandbox_workdir: null,
        materialized_at: null,
        first_message_at: null,
        created_at: args.createdAt,
        updated_at: args.createdAt,
      });
    }

    const factoryOf = async (sessionId: string) =>
      (
        await backend.ops.findOne<{ factory_project_id: string | null }>('source_control_sessions', {
          session_id: sessionId,
        })
      )?.factory_project_id;

    async function twoLinks(factoryProjectId: string) {
      const installation = await createInstallation(github);
      const first = await linkRepository({ factoryProjectId, installationId: installation.id });
      const second = await linkRepository({
        factoryProjectId,
        installationId: installation.id,
        repositoryExternalId: 'repo-2',
        repositorySlug: 'mastra-ai/second',
      });
      return { first, second };
    }

    it('create derives the factory from the link and rejects a mismatching one', async () => {
      const project = await createProject();
      const other = await createProject({ name: 'other' });
      const link = await linkRepository({ factoryProjectId: project.id });

      const session = await github.sessions.create(sessionInput('00000000-0000-4000-8000-000000000101', link.id));
      expect(session.factoryProjectId).toBe(project.id);
      expect(await factoryOf(session.sessionId)).toBe(project.id);
      expect(
        await github.sessions.create({
          ...sessionInput('00000000-0000-4000-8000-000000000102', link.id),
          factoryProjectId: project.id,
        }),
      ).toMatchObject({ id: session.id });
      await expect(
        github.sessions.create({
          ...sessionInput('00000000-0000-4000-8000-000000000103', link.id, 'user-1', 'feat/y'),
          factoryProjectId: other.id,
        }),
      ).rejects.toThrow(/does not match/);
      expect(
        await github.sessions.getForBranch({ factoryProjectId: project.id, userId: 'user-1', branch: 'feat/x' }),
      ).toMatchObject({ id: session.id });
      expect(
        await github.sessions.getForBranch({ projectRepositoryId: link.id, userId: 'user-1', branch: 'feat/x' }),
      ).toMatchObject({ id: session.id });
    });

    it('rejects the same (factory, user, branch) across two links and allows it across two factories', async () => {
      const project = await createProject();
      const other = await createProject({ name: 'other' });
      const { first, second } = await twoLinks(project.id);
      const elsewhere = await linkRepository({ factoryProjectId: other.id });

      const session = await github.sessions.create(sessionInput('00000000-0000-4000-8000-000000000111', first.id));
      // `create` returns the existing session of the (factory, user, branch) instead of inserting on the second link.
      const again = await github.sessions.create(sessionInput('00000000-0000-4000-8000-000000000112', second.id));
      expect(again.id).toBe(session.id);
      const forced = await insertLegacySession({
        sessionId: '00000000-0000-4000-8000-000000000113',
        projectRepositoryId: second.id,
        createdAt: new Date(),
      });
      await expect(
        backend.ops.updateMany('source_control_sessions', { id: forced.id }, { factory_project_id: project.id }),
      ).rejects.toBeInstanceOf(UniqueViolationError);
      const otherFactory = await github.sessions.create(
        sessionInput('00000000-0000-4000-8000-000000000114', elsewhere.id),
      );
      expect(otherFactory.factoryProjectId).toBe(other.id);
      expect(otherFactory.id).not.toBe(session.id);
    });

    it('backfills factory_project_id on legacy rows, reports stale links and keeps the oldest of a collision', async () => {
      const project = await createProject();
      const { first, second } = await twoLinks(project.id);
      const plain = await insertLegacySession({
        sessionId: '00000000-0000-4000-8000-000000000121',
        projectRepositoryId: first.id,
        branch: 'solo',
        createdAt: new Date(Date.UTC(2026, 0, 1)),
      });
      const older = await insertLegacySession({
        sessionId: '00000000-0000-4000-8000-000000000122',
        projectRepositoryId: first.id,
        createdAt: new Date(Date.UTC(2026, 0, 2)),
      });
      const newer = await insertLegacySession({
        sessionId: '00000000-0000-4000-8000-000000000123',
        projectRepositoryId: second.id,
        createdAt: new Date(Date.UTC(2026, 0, 3)),
      });
      const stale = await insertLegacySession({
        sessionId: '00000000-0000-4000-8000-000000000124',
        projectRepositoryId: '00000000-0000-4000-8000-0000000000ff',
        branch: 'stale',
        createdAt: new Date(Date.UTC(2026, 0, 4)),
      });
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        await domain.init();
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0]![0]).toContain('1 sessions have no resolvable factory, 1 sessions collide');

        expect(await factoryOf('00000000-0000-4000-8000-000000000121')).toBe(project.id);
        expect(await factoryOf('00000000-0000-4000-8000-000000000122')).toBe(project.id);
        expect(await factoryOf('00000000-0000-4000-8000-000000000123')).toBeNull();
        expect(await factoryOf('00000000-0000-4000-8000-000000000124')).toBeNull();
        const ids = (await backend.ops.findMany<{ id: string }>('source_control_sessions', {})).map(r => r.id).sort();
        expect(ids).toEqual([plain.id, older.id, newer.id, stale.id].sort());

        // Re-running reports the same rows and changes nothing.
        const before = await backend.ops.findMany('source_control_sessions', {}, { orderBy: [['id', 'asc']] });
        await domain.init();
        expect(warn).toHaveBeenCalledTimes(2);
        expect(await backend.ops.findMany('source_control_sessions', {}, { orderBy: [['id', 'asc']] })).toEqual(before);
      } finally {
        warn.mockRestore();
      }
    });

    it('listByProject spans the links of one project within the handle integration and respects visibility', async () => {
      const project = await createProject();
      const other = await createProject({ name: 'other' });
      const { first, second } = await twoLinks(project.id);
      const gitlabLink = await linkRepository({ handle: gitlab, factoryProjectId: project.id });
      const elsewhere = await linkRepository({ factoryProjectId: other.id });

      const a = await github.sessions.create(
        sessionInput('00000000-0000-4000-8000-000000000131', first.id, 'user-1', 'a'),
      );
      const b = await github.sessions.create(
        sessionInput('00000000-0000-4000-8000-000000000132', second.id, 'user-2', 'b'),
      );
      const mine = await github.sessions.create({
        ...sessionInput('00000000-0000-4000-8000-000000000133', second.id, 'user-2', 'c'),
        visibility: 'private',
      });
      await github.sessions.create({
        ...sessionInput('00000000-0000-4000-8000-000000000134', first.id, 'user-1', 'd'),
        visibility: 'private',
      });
      const viaGitlab = await gitlab.sessions.create(
        sessionInput('00000000-0000-4000-8000-000000000135', gitlabLink.id, 'user-1', 'e'),
      );
      await github.sessions.create(sessionInput('00000000-0000-4000-8000-000000000136', elsewhere.id, 'user-1', 'a'));

      const listed = await github.sessions.listByProject({
        orgId: 'org-1',
        factoryProjectId: project.id,
        viewerUserId: 'user-2',
      });
      expect(listed.map(s => s.id).sort()).toEqual([a.id, b.id, mine.id].sort());
      expect(
        (
          await gitlab.sessions.listByProject({ orgId: 'org-1', factoryProjectId: project.id, viewerUserId: 'user-1' })
        ).map(s => s.id),
      ).toEqual([viaGitlab.id]);
      expect(
        await github.sessions.listByProject({ orgId: 'org-2', factoryProjectId: project.id, viewerUserId: 'user-2' }),
      ).toEqual([]);
    });

    it('session repository rows round-trip, are unique per (session, link) and go away with the session', async () => {
      const project = await createProject();
      const { first, second } = await twoLinks(project.id);
      const session = await github.sessions.create(sessionInput('00000000-0000-4000-8000-000000000141', first.id));

      const pushed = await github.sessionRepositories.upsert({
        sessionId: session.sessionId,
        projectRepositoryId: first.id,
        branch: 'feat/x',
      });
      expect(pushed).toMatchObject({ branch: 'feat/x', changeRequestId: null, changeRequestUrl: null });
      const withPr = await github.sessionRepositories.upsert({
        sessionId: session.sessionId,
        projectRepositoryId: first.id,
        branch: 'feat/x',
        changeRequestId: '42',
        changeRequestUrl: 'https://example.test/pr/42',
      });
      expect(withPr.id).toBe(pushed.id);
      expect(withPr.createdAt).toEqual(pushed.createdAt);
      expect(withPr).toMatchObject({ changeRequestId: '42', changeRequestUrl: 'https://example.test/pr/42' });
      await github.sessionRepositories.upsert({
        sessionId: session.sessionId,
        projectRepositoryId: second.id,
        branch: 'feat/x',
      });
      const rows = await github.sessionRepositories.listBySession({ sessionId: session.sessionId });
      expect(rows.map(r => r.projectRepositoryId)).toEqual([first.id, second.id]);
      expect(await backend.ops.findMany('source_control_session_repositories', {})).toHaveLength(2);

      await github.sessions.delete(session.id);
      expect(await github.sessionRepositories.listBySession({ sessionId: session.sessionId })).toEqual([]);
      expect(await backend.ops.findMany('source_control_session_repositories', {})).toHaveLength(0);
    });

    it('unlink removes the link sessions and their repository rows', async () => {
      const project = await createProject();
      const { first, second } = await twoLinks(project.id);
      const session = await github.sessions.create(sessionInput('00000000-0000-4000-8000-000000000151', first.id));
      const kept = await github.sessions.create(
        sessionInput('00000000-0000-4000-8000-000000000152', second.id, 'user-1', 'other'),
      );
      await github.sessionRepositories.upsert({
        sessionId: session.sessionId,
        projectRepositoryId: second.id,
        branch: 'feat/x',
      });
      await github.sessionRepositories.upsert({
        sessionId: kept.sessionId,
        projectRepositoryId: first.id,
        branch: 'other',
      });
      await github.sessionRepositories.upsert({
        sessionId: kept.sessionId,
        projectRepositoryId: second.id,
        branch: 'other',
      });

      await github.projectRepositories.unlink({ orgId: 'org-1', id: first.id });

      expect(await github.sessions.getBySessionId(session.sessionId)).toBeNull();
      expect(await github.sessions.getBySessionId(kept.sessionId)).toMatchObject({ id: kept.id });
      expect(
        (await github.sessionRepositories.listBySession({ sessionId: kept.sessionId })).map(r => r.projectRepositoryId),
      ).toEqual([second.id]);
      expect(await backend.ops.findMany('source_control_session_repositories', {})).toHaveLength(1);
    });

    it('the in-memory handle mirrors factory derivation, listByProject and session repositories', async () => {
      const store = new SourceControlStorageInMemory('github');
      const installation = await store.installations.upsert({
        orgId: 'org-1',
        connectedByUserId: 'user-1',
        externalId: 'inst',
      });
      const repoA = await store.repositories.upsert({
        orgId: 'org-1',
        input: { installationId: installation.id, externalId: 'a', slug: 'acme/a', defaultBranch: 'main' },
      });
      const repoB = await store.repositories.upsert({
        orgId: 'org-1',
        input: { installationId: installation.id, externalId: 'b', slug: 'acme/b', defaultBranch: 'main' },
      });
      const connection = await store.connections.create({
        orgId: 'org-1',
        factoryProjectId: 'project-1',
        installationId: installation.id,
        createdByUserId: 'user-1',
      });
      const linkInput = { orgId: 'org-1', connectionId: connection.id, ...projectRepositoryInput };
      const first = await store.projectRepositories.link({ ...linkInput, repositoryId: repoA.id });
      const second = await store.projectRepositories.link({ ...linkInput, repositoryId: repoB.id });

      const session = await store.sessions.create(sessionInput('s-1', first.id));
      expect(session.factoryProjectId).toBe('project-1');
      expect((await store.sessions.create(sessionInput('s-2', second.id))).id).toBe(session.id);
      await expect(
        store.sessions.create({ ...sessionInput('s-3', first.id, 'user-1', 'y'), factoryProjectId: 'project-2' }),
      ).rejects.toThrow(/does not match/);
      const priv = await store.sessions.create({
        ...sessionInput('s-4', second.id, 'user-2', 'z'),
        visibility: 'private',
      });
      const listFor = async (viewerUserId: string) =>
        (await store.sessions.listByProject({ orgId: 'org-1', factoryProjectId: 'project-1', viewerUserId })).map(
          s => s.id,
        );
      expect(await listFor('user-1')).toEqual([session.id]);
      expect(await listFor('user-2')).toEqual([session.id, priv.id]);
      expect(
        await store.sessions.getForBranch({ factoryProjectId: 'project-1', userId: 'user-1', branch: 'feat/x' }),
      ).toBe(session);

      const row = await store.sessionRepositories.upsert({
        sessionId: 's-1',
        projectRepositoryId: second.id,
        branch: 'feat/x',
      });
      const updated = await store.sessionRepositories.upsert({
        sessionId: 's-1',
        projectRepositoryId: second.id,
        branch: 'feat/x',
        changeRequestId: '7',
      });
      expect(updated.id).toBe(row.id);
      expect(await store.sessionRepositories.listBySession({ sessionId: 's-1' })).toHaveLength(1);
      await store.sessions.delete(session.id);
      expect(await store.sessionRepositories.listBySession({ sessionId: 's-1' })).toEqual([]);
    });
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
        { sandbox_workdir: null, environment_backfilled_at: null },
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
        sandboxWorkdir: '/workspace/oldest',
        sandboxSettings: null,
      });
    });

    it('is a no-op when re-run', async () => {
      const { project } = await seedDuplicateSlugProject();
      await domain.init();
      const before = await snapshot();

      await domain.init();
      expect(await snapshot()).toEqual(before);

      // Same when the project is selected again but its links already carry positions.
      await backend.ops.updateMany('factory_projects', { id: project.id }, { environment_backfilled_at: null });
      await domain.init();
      const again = await snapshot();
      // Only the marker moves; every other column and every link is untouched.
      const stripMarker = (rows: Array<Record<string, unknown>>) =>
        rows.map(({ environment_backfilled_at: _marker, ...row }) => row);
      expect(stripMarker(again.projects)).toEqual(stripMarker(before.projects));
      expect(again.links).toEqual(before.links);
    });

    it('leaves a new project unconfigured until the next init, then copies the oldest link and never sets resources', async () => {
      const withLink = await createProject({ name: 'with link' });
      const withoutLink = await createProject({ name: 'without link' });
      expect(await projects.getById({ id: withLink.id })).toMatchObject({
        sandboxWorkdir: null,
        sandboxSettings: null,
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
        sandboxWorkdir: '/workspace/linked',
        sandboxSettings: null,
      });
      expect(await projects.getById({ id: withoutLink.id })).toMatchObject({
        sandboxWorkdir: null,
        sandboxSettings: null,
      });
    });

    it('adds the project columns itself when the projects domain has not initialized yet', async () => {
      const fresh = new LibSQLFactoryStorage({ id: 'source-control-order-test', url: ':memory:' });
      const sourceControl = fresh.registerDomain(new SourceControlStorage());
      const projectsDomain = fresh.registerDomain(new FactoryProjectsStorage());
      try {
        await sourceControl.init();
        expect(
          await fresh.ops.findMany(
            'factory_projects',
            { environment_backfilled_at: null },
            { orderBy: [['id', 'asc']] },
          ),
        ).toEqual([]);

        await Promise.all([sourceControl.init(), projectsDomain.init()]);
        const created = await projectsDomain.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Late' } });
        expect(created.sandboxSettings).toBeNull();
      } finally {
        await fresh.close();
      }
    });

    it('never overwrites values a user set between boots', async () => {
      const { project, second } = await seedDuplicateSlugProject();
      await domain.init();
      await projects.update({ orgId: 'org-1', id: project.id, input: { sandboxWorkdir: '/workspace/custom' } });
      await gitlab.projectRepositories.update({ orgId: 'org-1', id: second.id, input: { inEnvironment: true } });
      await projects.update({ orgId: 'org-1', id: project.id, input: { sandboxSettings: { cpuCount: 2 } } });
      await backend.ops.updateMany('factory_projects', { id: project.id }, { environment_backfilled_at: null });

      await domain.init();

      expect(await projects.getById({ id: project.id })).toMatchObject({
        sandboxWorkdir: '/workspace/custom',
        sandboxSettings: { cpuCount: 2 },
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
