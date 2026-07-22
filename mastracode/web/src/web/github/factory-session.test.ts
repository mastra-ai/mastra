import { seedFactoryStorageForTests } from '../storage/test-utils';
import type { GithubIntegration } from './integration';
import { describe, expect, it } from 'vitest';

import { ensureFactoryRuleSession } from './factory-session';

describe('ensureFactoryRuleSession', () => {
  it('creates a source-control session for the Factory rule branch', async () => {
    const seeded = await seedFactoryStorageForTests();
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
    const github = { id: 'github', sourceControlStorage } as unknown as GithubIntegration;

    const result = await ensureFactoryRuleSession({
      github,
      orgId: 'org-1',
      factoryProjectId: project.id,
      repositorySlug: repository.slug,
      branch: 'factory/issue-49',
    });

    expect(result.userId).toBe('user-1');
    await expect(sourceControlStorage.sessions.getBySessionId(result.sessionId)).resolves.toEqual(
      expect.objectContaining({
        projectRepositoryId: projectRepository.id,
        userId: 'user-1',
        branch: 'factory/issue-49',
        baseBranch: 'main',
      }),
    );
  });
});
