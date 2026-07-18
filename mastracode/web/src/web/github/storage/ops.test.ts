import { LibSQLFactoryStorage } from '@mastra/libsql';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GithubStorageOps } from './ops';

const projectInput = {
  orgId: 'org-1',
  userId: 'user-1',
  installationId: 12,
  repoFullName: 'mastra-ai/mastra',
  repoId: 34,
  defaultBranch: 'main',
  sandboxProvider: 'local',
  sandboxWorkdir: '/workspace/mastra',
};

describe('GithubStorageOps', () => {
  let backend: LibSQLFactoryStorage;
  let storage: GithubStorageOps;

  beforeEach(async () => {
    backend = new LibSQLFactoryStorage({ id: 'github-storage-test', url: ':memory:' });
    await backend.init();
    storage = new GithubStorageOps();
    await storage.init({ storage: backend });
  });

  afterEach(async () => {
    await backend.close();
  });

  it('refuses queries before init succeeds', async () => {
    await expect(new GithubStorageOps().listInstallations('org-1')).rejects.toThrow(/Not initialized/);
  });

  it('keeps installation inserts idempotent', async () => {
    await storage.insertInstallation({
      orgId: 'org-1',
      userId: 'user-1',
      installationId: 12,
      accountLogin: 'mastra-ai',
      accountType: 'Organization',
    });
    await storage.insertInstallation({
      orgId: 'org-1',
      userId: 'user-2',
      installationId: 12,
      accountLogin: 'changed',
      accountType: 'User',
    });

    expect(await storage.listInstallations('org-1')).toHaveLength(1);
    expect(await storage.getInstallation('org-1', 12)).toMatchObject({
      userId: 'user-1',
      accountLogin: 'mastra-ai',
    });
  });

  it('refreshes project metadata without clearing its setup command', async () => {
    const created = await storage.upsertProject(projectInput);
    await storage.setProjectSetupCommand(created.id, 'pnpm install');

    const updated = await storage.upsertProject({
      ...projectInput,
      sandboxProvider: 'railway',
      sandboxWorkdir: '/app/mastra',
    });

    expect(updated).toMatchObject({
      id: created.id,
      sandboxProvider: 'railway',
      sandboxWorkdir: '/app/mastra',
      setupCommand: 'pnpm install',
    });
    expect(await storage.getOrgProject('org-2', created.id)).toBeNull();
    expect(await storage.findProjectByRepo(12, 'mastra-ai/mastra')).toMatchObject({ id: created.id });
  });

  it('converges concurrent sandbox creation and updates the binding', async () => {
    const project = await storage.upsertProject(projectInput);
    const [first, second] = await Promise.all([
      storage.getOrCreateSandbox(project, 'user-1'),
      storage.getOrCreateSandbox(project, 'user-1'),
    ]);

    expect(second.id).toBe(first.id);
    await storage.setSandboxId(first.id, 'sandbox-1');
    await storage.markSandboxMaterialized(first.id);
    expect(await storage.getSandboxById(first.id)).toMatchObject({ sandboxId: 'sandbox-1' });

    await storage.clearSandboxBinding(first.id);
    expect(await storage.getSandboxById(first.id)).toMatchObject({ sandboxId: null, materializedAt: null });
  });

  it('upserts and deletes worktrees', async () => {
    const project = await storage.upsertProject(projectInput);
    const input = {
      orgId: project.orgId,
      userId: 'user-1',
      githubProjectId: project.id,
      branch: 'feature/a',
      baseBranch: 'main',
      worktreePath: '/workspace/worktrees/a',
    };
    await storage.upsertWorktree(input);
    await storage.upsertWorktree({ ...input, baseBranch: 'develop', worktreePath: '/workspace/worktrees/b' });

    expect(await storage.getWorktree(project.id, 'user-1', 'feature/a')).toMatchObject({
      baseBranch: 'develop',
      worktreePath: '/workspace/worktrees/b',
    });
    expect(await storage.findWorktreeByPath(project.id, 'user-1', '/workspace/worktrees/b')).not.toBeNull();

    await storage.deleteWorktree(project.id, 'user-1', 'feature/a');
    expect(await storage.getWorktree(project.id, 'user-1', 'feature/a')).toBeNull();
  });
});
