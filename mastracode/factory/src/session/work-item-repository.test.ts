import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { resolveWorkItemRepository } from './work-item-repository.js';

async function seedRepositories(slugs: string[]) {
  const seeded = await createFactoryStorageForTests();
  const sourceControl = seeded.sourceControl.forIntegration('github');
  const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Factory' } });
  const installation = await sourceControl.installations.upsert({
    orgId: 'org-1',
    connectedByUserId: 'user-1',
    externalId: 'installation-1',
  });
  const connection = await sourceControl.connections.create({
    orgId: 'org-1',
    factoryProjectId: project.id,
    installationId: installation.id,
    createdByUserId: 'user-1',
  });
  const repositories = [];
  for (const [index, slug] of slugs.entries()) {
    const repository = await sourceControl.repositories.upsert({
      orgId: 'org-1',
      input: { installationId: installation.id, externalId: String(index + 1), slug, defaultBranch: 'main' },
    });
    const projectRepository = await sourceControl.projectRepositories.link({
      orgId: 'org-1',
      connectionId: connection.id,
      repositoryId: repository.id,
      createdByUserId: 'user-1',
      sandboxProvider: 'local',
      sandboxWorkdir: `/sandbox/${slug}`,
    });
    repositories.push({ repository, projectRepository });
  }
  return { sourceControl, project, repositories };
}

describe('resolveWorkItemRepository', () => {
  it('resolves repository slug and external-id signals', async () => {
    const { sourceControl, project, repositories } = await seedRepositories(['acme/one', 'acme/two']);
    const args = { sourceControl, orgId: 'org-1', factoryProjectId: project.id };

    await expect(
      resolveWorkItemRepository({ ...args, item: { metadata: { repository: 'acme/two' } } }),
    ).resolves.toEqual({
      status: 'resolved',
      projectRepositoryId: repositories[1]!.projectRepository.id,
      slug: 'acme/two',
    });
    await expect(
      resolveWorkItemRepository({ ...args, item: { metadata: { githubRepositoryId: 1 } } }),
    ).resolves.toMatchObject({ status: 'resolved', slug: 'acme/one' });
  });

  it('uses a Linear project mapping and resolves an unattributed single-repository item', async () => {
    const { sourceControl, project, repositories } = await seedRepositories(['acme/one', 'acme/two']);
    const args = { sourceControl, orgId: 'org-1', factoryProjectId: project.id };

    await expect(
      resolveWorkItemRepository({
        ...args,
        item: { metadata: { linearProjectId: 'linear-project' } },
        linearRepositoryMap: { 'linear-project': 'acme/two' },
      }),
    ).resolves.toMatchObject({ status: 'resolved', projectRepositoryId: repositories[1]!.projectRepository.id });

    const single = await seedRepositories(['acme/only']);
    await expect(
      resolveWorkItemRepository({
        sourceControl: single.sourceControl,
        orgId: 'org-1',
        factoryProjectId: single.project.id,
        item: { metadata: null },
      }),
    ).resolves.toMatchObject({ status: 'resolved', slug: 'acme/only' });
  });

  it('reports ambiguous and unlinked repository targets instead of choosing the first', async () => {
    const { sourceControl, project } = await seedRepositories(['acme/one', 'acme/two']);
    const args = { sourceControl, orgId: 'org-1', factoryProjectId: project.id };

    await expect(resolveWorkItemRepository({ ...args, item: { metadata: null } })).resolves.toEqual({
      status: 'ambiguous',
      candidates: ['acme/one', 'acme/two'],
    });
    await expect(
      resolveWorkItemRepository({ ...args, item: { metadata: { repository: 'other/repo' } } }),
    ).resolves.toMatchObject({ status: 'unlinked' });
  });
});
