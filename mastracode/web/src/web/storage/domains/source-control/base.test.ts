import { LibSQLFactoryStorage } from '@mastra/libsql';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SourceControlStorage } from './base';
import type { SourceControlStorageHandle } from './base';

const githubProject = {
  orgId: 'org-1',
  createdByUserId: 'user-1',
  installationExternalId: 'installation-12',
  repositoryExternalId: 'repository-34',
  repositorySlug: 'mastra-ai/mastra',
  defaultBranch: 'main',
  sandboxProvider: 'local',
  sandboxWorkdir: '/workspace/mastra',
  providerMetadata: { visibility: 'public' },
};

describe('SourceControlStorage', () => {
  let backend: LibSQLFactoryStorage;
  let domain: SourceControlStorage;
  let github: SourceControlStorageHandle;
  let gitlab: SourceControlStorageHandle;

  beforeEach(async () => {
    backend = new LibSQLFactoryStorage({ id: 'source-control-test', url: ':memory:' });
    domain = backend.registerDomain(new SourceControlStorage());
    await backend.init();
    github = domain.forIntegration('github');
    gitlab = domain.forIntegration('gitlab');
  });

  afterEach(async () => {
    await backend.close();
  });

  it('rejects empty integration ids and access before registration', async () => {
    expect(() => domain.forIntegration('')).toThrow(/must not be empty/);
    await expect(new SourceControlStorage().forIntegration('github').installations.list('org-1')).rejects.toThrow(
      /has not been registered/,
    );
  });

  it('supports string external ids and isolates identical ids by integration', async () => {
    const installation = {
      orgId: 'org-1',
      connectedByUserId: 'user-1',
      externalId: 'shared-installation-id',
      accountName: 'mastra-ai',
      accountType: 'organization',
    };
    await github.installations.insert(installation);
    await github.installations.insert({ ...installation, connectedByUserId: 'ignored-duplicate' });
    await gitlab.installations.insert(installation);

    expect(await github.installations.list('org-1')).toHaveLength(1);
    expect(await github.installations.get('org-1', installation.externalId)).toMatchObject({
      integrationId: 'github',
      connectedByUserId: 'user-1',
    });
    expect(await gitlab.installations.get('org-1', installation.externalId)).toMatchObject({
      integrationId: 'gitlab',
    });

    const githubCreated = await github.projects.upsert(githubProject);
    const gitlabCreated = await gitlab.projects.upsert(githubProject);
    expect(gitlabCreated.id).not.toBe(githubCreated.id);
    expect(await github.projects.getById(gitlabCreated.id)).toBeNull();
    expect(await gitlab.projects.getById(githubCreated.id)).toBeNull();
    const otherOrgCreated = await github.projects.upsert({
      ...githubProject,
      orgId: 'org-2',
      createdByUserId: 'user-2',
    });
    expect(await github.projects.findByRepository('org-1', 'installation-12', 'mastra-ai/mastra')).toMatchObject({
      id: githubCreated.id,
      repositoryExternalId: 'repository-34',
    });
    expect(await github.projects.findByRepository('org-2', 'installation-12', 'mastra-ai/mastra')).toMatchObject({
      id: otherOrgCreated.id,
    });
    expect(await github.projects.listByRepository('installation-12', 'mastra-ai/mastra')).toHaveLength(2);
  });

  it('refreshes project metadata without clearing its setup command', async () => {
    const created = await github.projects.upsert(githubProject);
    await github.projects.setSetupCommand(created.id, 'pnpm install');

    const updated = await github.projects.upsert({
      ...githubProject,
      sandboxProvider: 'railway',
      sandboxWorkdir: '/app/mastra',
      providerMetadata: { visibility: 'private' },
    });

    expect(updated).toMatchObject({
      id: created.id,
      sandboxProvider: 'railway',
      sandboxWorkdir: '/app/mastra',
      setupCommand: 'pnpm install',
      providerMetadata: { visibility: 'private' },
    });
    expect(await github.projects.list('org-1')).toEqual([updated]);
    expect(await github.projects.list('org-2')).toEqual([]);
    expect(await github.projects.getOrg('org-2', created.id)).toBeNull();

    await github.projects.delete('org-2', created.id);
    expect(await github.projects.getById(created.id)).not.toBeNull();
    await github.projects.delete('org-1', created.id);
    expect(await github.projects.getById(created.id)).toBeNull();
  });

  it('converges concurrent sandbox creation and keeps bindings provider-scoped', async () => {
    const project = await github.projects.upsert(githubProject);
    const [first, second] = await Promise.all([
      github.sandboxes.getOrCreate(project, 'user-1'),
      github.sandboxes.getOrCreate(project, 'user-1'),
    ]);

    expect(second.id).toBe(first.id);
    expect(await gitlab.sandboxes.getById(first.id)).toBeNull();
    await github.sandboxes.setSandboxId(first.id, 'sandbox-1');
    await github.sandboxes.markMaterialized(first.id);
    expect(await github.sandboxes.getById(first.id)).toMatchObject({ sandboxId: 'sandbox-1' });

    const movedProject = await github.projects.upsert({
      ...githubProject,
      sandboxWorkdir: '/tmp/mastracode/sandboxes/mastra-ai/mastra',
    });
    const moved = await github.sandboxes.getOrCreate(movedProject, 'user-1');
    expect(moved).toMatchObject({
      id: first.id,
      sandboxId: null,
      sandboxWorkdir: '/tmp/mastracode/sandboxes/mastra-ai/mastra',
      materializedAt: null,
    });

    await github.sandboxes.clearBinding(first.id);
    expect(await github.sandboxes.getById(first.id)).toMatchObject({ sandboxId: null, materializedAt: null });
  });

  it('atomically upserts worktrees and enforces project ownership', async () => {
    const project = await github.projects.upsert(githubProject);
    const input = {
      projectId: project.id,
      orgId: project.orgId,
      userId: 'user-1',
      branch: 'feature/a',
      baseBranch: 'main',
      worktreePath: '/workspace/worktrees/a',
    };
    await github.worktrees.upsert(input);
    await github.worktrees.upsert({ ...input, baseBranch: 'develop', worktreePath: '/workspace/worktrees/b' });

    expect(await github.worktrees.get(project.id, 'user-1', 'feature/a')).toMatchObject({
      baseBranch: 'develop',
      worktreePath: '/workspace/worktrees/b',
    });
    expect(await github.worktrees.findByPath(project.id, 'user-1', '/workspace/worktrees/b')).not.toBeNull();
    expect(await gitlab.worktrees.get(project.id, 'user-1', 'feature/a')).toBeNull();
    await expect(gitlab.worktrees.upsert(input)).rejects.toThrow(/not found for this integration/);

    await github.worktrees.delete(project.id, 'user-1', 'feature/a');
    expect(await github.worktrees.get(project.id, 'user-1', 'feature/a')).toBeNull();
  });

  it('clears every owned collection', async () => {
    await github.installations.insert({
      orgId: 'org-1',
      connectedByUserId: 'user-1',
      externalId: 'installation-12',
    });
    const project = await github.projects.upsert(githubProject);
    await github.sandboxes.getOrCreate(project, 'user-1');
    await github.worktrees.upsert({
      projectId: project.id,
      orgId: project.orgId,
      userId: 'user-1',
      branch: 'feature/a',
      baseBranch: 'main',
      worktreePath: '/workspace/worktrees/a',
    });

    await domain.dangerouslyClearAll();

    expect(await github.installations.list('org-1')).toEqual([]);
    expect(await github.projects.getById(project.id)).toBeNull();
  });
});
