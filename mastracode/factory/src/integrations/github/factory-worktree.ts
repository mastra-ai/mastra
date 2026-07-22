import type { FactoryStorage } from '@mastra/core/storage';

import type { SandboxFleet } from '../../sandbox/fleet.js';
import type { GithubIntegration } from './integration.js';
import { withProjectLock } from './project-lock.js';
import { ensureProjectSandbox, ensureWorktree, materializeRepo, runWorktreeSetup } from './sandbox.js';

export async function ensureFactoryRuleWorktree(args: {
  github: GithubIntegration;
  fleet: SandboxFleet;
  factoryStorage?: FactoryStorage;
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
  return withProjectLock({
    key: `${resolved.projectRepository.id}:${userId}`,
    storage: args.factoryStorage,
    fn: async () => {
      let sandboxRow = await args.github.sourceControlStorage.sandboxes.getOrCreate({
        projectRepository: resolved.projectRepository,
        userId,
      });
      const token = await args.github.mintInstallationToken(Number(installation.externalId));
      let sandbox;
      if (!sandboxRow.sandboxId || !sandboxRow.materializedAt) {
        sandbox = await ensureProjectSandbox({
          fleet: args.fleet,
          row: sandboxRow,
          storage: args.github.sourceControlStorage.sandboxes,
        });
        sandboxRow = (await args.github.sourceControlStorage.sandboxes.getById({ id: sandboxRow.id })) ?? sandboxRow;
        await materializeRepo({
          row: sandboxRow,
          repoInfo: { repoFullName: repository.slug, defaultBranch: repository.defaultBranch },
          sandbox,
          token,
          storage: args.github.sourceControlStorage.sandboxes,
        });
      } else {
        sandbox = await args.fleet.reattachSandbox(sandboxRow.sandboxId);
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
    },
  });
}
