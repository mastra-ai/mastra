import { reattachSandbox } from '../sandbox/fleet.js';
import type { GithubIntegration } from './integration.js';
import { withProjectLock } from './project-lock.js';
import { ensureProjectSandbox, ensureWorktree, materializeRepo, runWorktreeSetup } from './sandbox.js';

export async function ensureFactoryRuleWorktree(args: {
  github: GithubIntegration;
  orgId: string;
  factoryProjectId: string;
  repositorySlug?: string;
  branch: string;
}): Promise<{ projectPath: string; userId: string }> {
  const connections = await args.github.sourceControlStorage.connections.list({
    orgId: args.orgId,
    factoryProjectId: args.factoryProjectId,
  });
  const connection = connections.find(candidate => candidate.integrationId === args.github.id);
  if (!connection) throw new Error('Factory GitHub connection not found.');

  const projectRepositories = await args.github.sourceControlStorage.projectRepositories.list({
    orgId: args.orgId,
    connectionId: connection.id,
  });
  const resolvedRepositories = await Promise.all(
    projectRepositories.map(async projectRepository => ({
      projectRepository,
      repository: await args.github.sourceControlStorage.repositories.get({
        orgId: args.orgId,
        id: projectRepository.repositoryId,
      }),
    })),
  );
  const resolved = resolvedRepositories.find(
    candidate => candidate.repository && (!args.repositorySlug || candidate.repository.slug === args.repositorySlug),
  );
  if (!resolved?.repository) throw new Error('Factory GitHub repository not found.');
  const repository = resolved.repository;

  const installation = await args.github.sourceControlStorage.installations.get({
    orgId: args.orgId,
    id: connection.installationId,
  });
  if (!installation) throw new Error('Factory GitHub installation not found.');

  const userId = connection.createdByUserId;
  return withProjectLock(`${resolved.projectRepository.id}:${userId}`, async () => {
    let sandboxRow = await args.github.sourceControlStorage.sandboxes.getOrCreate({
      projectRepository: resolved.projectRepository,
      userId,
    });
    const token = await args.github.mintInstallationToken(Number(installation.externalId));
    let sandbox;
    if (!sandboxRow.sandboxId || !sandboxRow.materializedAt) {
      sandbox = await ensureProjectSandbox(sandboxRow, args.github.sourceControlStorage.sandboxes);
      sandboxRow = (await args.github.sourceControlStorage.sandboxes.getById({ id: sandboxRow.id })) ?? sandboxRow;
      await materializeRepo(
        sandboxRow,
        { repoFullName: repository.slug, defaultBranch: repository.defaultBranch },
        sandbox,
        token,
        args.github.sourceControlStorage.sandboxes,
      );
    } else {
      sandbox = await reattachSandbox(sandboxRow.sandboxId);
    }

    const result = await ensureWorktree(sandbox, sandboxRow.sandboxWorkdir, {
      branch: args.branch,
      baseBranch: resolved.projectRepository.branch ?? repository.defaultBranch,
      token,
      repoFullName: repository.slug,
    });
    if (!result.reused && resolved.projectRepository.setupCommand) {
      await runWorktreeSetup(sandbox, result.worktreePath, resolved.projectRepository.setupCommand);
    }
    await args.github.sourceControlStorage.worktrees.upsert({
      projectRepositoryId: resolved.projectRepository.id,
      userId,
      branch: result.branch,
      baseBranch: result.baseBranch,
      worktreePath: result.worktreePath,
    });
    return { projectPath: result.worktreePath, userId };
  });
}
