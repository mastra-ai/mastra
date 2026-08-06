import { randomUUID } from 'node:crypto';

import type { GithubIntegration } from './integration.js';
import { subscribeToPullRequest } from './subscriptions.js';

/** Ties the branch a review session runs on to the pull request it reviews. */
export function factoryReviewBranch(pullRequestNumber: number): string {
  return `factory/pr-${pullRequestNumber}`;
}

export interface FactoryRuleSessionRepository {
  projectRepositoryId: string;
  repositoryExternalId: string;
  repositorySlug: string;
  installationExternalId: string;
}

export interface FactoryRuleSession {
  sessionId: string;
  userId: string;
  repository: FactoryRuleSessionRepository;
}

export async function ensureFactoryRuleSession(args: {
  github: GithubIntegration;
  orgId: string;
  factoryProjectId: string;
  repositorySlug?: string;
  branch: string;
}): Promise<FactoryRuleSession> {
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
  const installation = await args.github.sourceControlStorage.installations.get({
    orgId: args.orgId,
    id: connection.installationId,
  });
  if (!installation) throw new Error('Factory GitHub installation not found.');

  const userId = connection.createdByUserId;
  const session = await args.github.sourceControlStorage.sessions.create({
    sessionId: randomUUID(),
    projectRepositoryId: resolved.projectRepository.id,
    orgId: args.orgId,
    userId,
    branch: args.branch,
    baseBranch: resolved.projectRepository.branch ?? resolved.repository.defaultBranch,
  });
  return {
    sessionId: session.sessionId,
    userId,
    repository: {
      projectRepositoryId: resolved.projectRepository.id,
      repositoryExternalId: resolved.repository.externalId,
      repositorySlug: resolved.repository.slug,
      installationExternalId: installation.externalId,
    },
  };
}

/**
 * Subscribe a review session to the pull request it reviews.
 *
 * Nothing else does: `gh pr create` covers sessions that open their own pull
 * request, but a review session is bound to one that already exists. Without a
 * subscription row the merge signal has no thread to land on, and the session's
 * pull request stays `open` in the UI forever.
 */
export async function subscribeFactoryRuleSessionToPullRequest(args: {
  github: GithubIntegration;
  orgId: string;
  session: FactoryRuleSession;
  resourceId: string;
  threadId: string;
  pullRequestNumber: number;
}): Promise<void> {
  await subscribeToPullRequest(
    {
      orgId: args.orgId,
      installationExternalId: args.session.repository.installationExternalId,
      projectRepositoryId: args.session.repository.projectRepositoryId,
      repositoryExternalId: args.session.repository.repositoryExternalId,
      repositorySlug: args.session.repository.repositorySlug,
      changeRequestId: String(args.pullRequestNumber),
      sessionId: args.session.sessionId,
      ownerId: args.session.userId,
      resourceId: args.resourceId,
      threadId: args.threadId,
      source: 'factory-review-binding',
    },
    args.github.integrationStorage,
  );
}
