import { randomUUID } from 'node:crypto';

import type { GithubIntegration } from './integration.js';

export async function ensureFactoryRuleSession(args: {
  github: GithubIntegration;
  orgId: string;
  factoryProjectId: string;
  repositorySlug?: string;
  branch: string;
}): Promise<{ sessionId: string; userId: string }> {
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

  const userId = connection.createdByUserId;
  const session = await args.github.sourceControlStorage.sessions.create({
    sessionId: randomUUID(),
    projectRepositoryId: resolved.projectRepository.id,
    orgId: args.orgId,
    userId,
    branch: args.branch,
    baseBranch: resolved.projectRepository.branch ?? resolved.repository.defaultBranch,
  });
  return { sessionId: session.sessionId, userId };
}
