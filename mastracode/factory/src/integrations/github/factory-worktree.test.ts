import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MaterializationSandbox, SandboxFleet } from '../../sandbox/fleet';
import { createFactoryStorageForTests } from '../../storage/test-utils';
import { ensureFactoryRuleWorktree } from './factory-worktree';
import type { GithubIntegration } from './integration';
import type * as sandboxModule from './sandbox';

const sandbox: MaterializationSandbox = {
  id: 'sandbox-1',
  start: vi.fn(async () => {}),
  getInfo: vi.fn(async () => ({})),
  executeCommand: vi.fn(async () => ({ exitCode: 0, stdout: '', stderr: '' })),
};

const mocks = vi.hoisted(() => ({
  ensureProjectSandbox: vi.fn(),
  materializeRepo: vi.fn(),
  ensureWorktree: vi.fn(),
  runWorktreeSetup: vi.fn(),
  reattachSandbox: vi.fn(),
}));

const fleet = { reattachSandbox: mocks.reattachSandbox } as unknown as SandboxFleet;

vi.mock('./sandbox', async importOriginal => ({
  ...(await importOriginal<typeof sandboxModule>()),
  ensureProjectSandbox: mocks.ensureProjectSandbox,
  materializeRepo: mocks.materializeRepo,
  ensureWorktree: mocks.ensureWorktree,
  runWorktreeSetup: mocks.runWorktreeSetup,
}));

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.MASTRACODE_DISTRIBUTED_LOCK;
});

describe('ensureFactoryRuleWorktree', () => {
  it('provisions and materializes a fresh project before creating the rule worktree', async () => {
    process.env.MASTRACODE_DISTRIBUTED_LOCK = '0';
    const seeded = await createFactoryStorageForTests();
    const sourceControlStorage = seeded.sourceControl.forIntegration('github');
    const project = await seeded.projects.create({
      orgId: 'org-1',
      userId: 'user-1',
      input: { name: 'Mastra' },
    });
    const installation = await sourceControlStorage.installations.upsert({
      orgId: 'org-1',
      connectedByUserId: 'user-1',
      externalId: '123',
    });
    const repository = await sourceControlStorage.repositories.upsert({
      orgId: 'org-1',
      input: {
        installationId: installation.id,
        externalId: '456',
        slug: 'mastra-ai/mastra',
        defaultBranch: 'main',
      },
    });
    const connection = await sourceControlStorage.connections.create({
      orgId: 'org-1',
      factoryProjectId: project.id,
      installationId: installation.id,
      createdByUserId: 'user-1',
    });
    const projectRepository = await sourceControlStorage.projectRepositories.link({
      orgId: 'org-1',
      connectionId: connection.id,
      repositoryId: repository.id,
      createdByUserId: 'user-1',
      sandboxProvider: 'local',
      sandboxWorkdir: '/sandbox/mastra',
    });
    const github = {
      id: 'github',
      sourceControlStorage,
      mintInstallationToken: vi.fn(async () => 'installation-token'),
    } as unknown as GithubIntegration;

    mocks.ensureProjectSandbox.mockImplementation(async ({ row, storage }) => {
      await storage.setSandboxId({ id: row.id, sandboxId: sandbox.id });
      return sandbox;
    });
    mocks.materializeRepo.mockImplementation(async ({ row, storage }) => {
      await storage.markMaterialized({ id: row.id });
    });
    mocks.ensureWorktree.mockResolvedValue({
      worktreePath: '/sandbox/mastra-worktrees/factory-issue-49',
      branch: 'factory/issue-49',
      baseBranch: 'main',
      reused: false,
    });

    const result = await ensureFactoryRuleWorktree({
      github,
      fleet,
      orgId: 'org-1',
      factoryProjectId: project.id,
      repositorySlug: repository.slug,
      branch: 'factory/issue-49',
    });

    expect(result.projectPath).toBe('/sandbox/mastra-worktrees/factory-issue-49');
    expect(result.userId).toBe('user-1');
    expect(mocks.ensureProjectSandbox).toHaveBeenCalledOnce();
    expect(mocks.materializeRepo).toHaveBeenCalledOnce();
    expect(mocks.ensureWorktree).toHaveBeenCalledOnce();
    await expect(
      sourceControlStorage.worktrees.list({ projectRepositoryId: projectRepository.id, userId: 'user-1' }),
    ).resolves.toEqual([expect.objectContaining({ branch: 'factory/issue-49', worktreePath: result.projectPath })]);
  });
});
