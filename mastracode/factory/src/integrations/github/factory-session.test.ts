import { beforeEach, describe, expect, it } from 'vitest';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import { ensureFactoryRuleSession, subscribeFactoryRuleSessionToPullRequest } from './factory-session.js';
import type { GithubIntegration } from './integration.js';
import { listPullRequestSubscriptionsForThread } from './subscriptions.js';

let github: GithubIntegration;
let factoryProjectId: string;
let projectRepositoryId: string;

beforeEach(async () => {
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
  factoryProjectId = project.id;
  projectRepositoryId = projectRepository.id;
  github = {
    id: 'github',
    sourceControlStorage,
    integrationStorage: seeded.integrations.forIntegration('github'),
  } as unknown as GithubIntegration;
});

describe('ensureFactoryRuleSession', () => {
  it('creates a source-control session for the Factory rule branch', async () => {
    const result = await ensureFactoryRuleSession({
      github,
      orgId: 'org-1',
      factoryProjectId,
      repositorySlug: 'mastra-ai/mastra',
      branch: 'factory/issue-49',
    });

    expect(result.userId).toBe('user-1');
    expect(result.repository).toEqual({
      projectRepositoryId,
      repositoryExternalId: '456',
      repositorySlug: 'mastra-ai/mastra',
      installationExternalId: '123',
    });
    await expect(github.sourceControlStorage.sessions.getBySessionId(result.sessionId)).resolves.toEqual(
      expect.objectContaining({
        projectRepositoryId,
        userId: 'user-1',
        branch: 'factory/issue-49',
        baseBranch: 'main',
      }),
    );
  });
});

describe('subscribeFactoryRuleSessionToPullRequest', () => {
  it('subscribes the review thread to the pull request it reviews', async () => {
    const session = await ensureFactoryRuleSession({
      github,
      orgId: 'org-1',
      factoryProjectId,
      repositorySlug: 'mastra-ai/mastra',
      branch: 'factory/pr-20468',
    });

    await subscribeFactoryRuleSessionToPullRequest({
      github,
      orgId: 'org-1',
      session,
      resourceId: session.sessionId,
      threadId: session.sessionId,
      pullRequestNumber: 20468,
    });

    const subscriptions = await listPullRequestSubscriptionsForThread(
      { orgId: 'org-1', resourceId: session.sessionId, threadId: session.sessionId },
      github.integrationStorage,
    );
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0]).toEqual(
      expect.objectContaining({
        sessionId: session.sessionId,
        status: 'open',
        data: expect.objectContaining({
          changeRequestId: '20468',
          installationExternalId: '123',
          repositoryExternalId: '456',
          repositorySlug: 'mastra-ai/mastra',
          source: 'factory-review-binding',
        }),
      }),
    );
  });

  it('does not create a second subscription when the binding is prepared again', async () => {
    const session = await ensureFactoryRuleSession({
      github,
      orgId: 'org-1',
      factoryProjectId,
      repositorySlug: 'mastra-ai/mastra',
      branch: 'factory/pr-20468',
    });
    const subscribe = () =>
      subscribeFactoryRuleSessionToPullRequest({
        github,
        orgId: 'org-1',
        session,
        resourceId: session.sessionId,
        threadId: session.sessionId,
        pullRequestNumber: 20468,
      });

    await subscribe();
    await subscribe();

    await expect(
      listPullRequestSubscriptionsForThread(
        { orgId: 'org-1', resourceId: session.sessionId, threadId: session.sessionId },
        github.integrationStorage,
      ),
    ).resolves.toHaveLength(1);
  });
});
