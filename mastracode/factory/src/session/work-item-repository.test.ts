import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { resolveWorkItemRepository } from './work-item-repository.js';

async function seedRepositories(slugs: string[], integrationId: 'github' | 'gitlab' = 'github') {
  const seeded = await createFactoryStorageForTests();
  const sourceControl = seeded.sourceControl.forIntegration(integrationId);
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

  it('resolves a renamed repository by its provider id when the stored slug is stale', async () => {
    const { sourceControl, project, repositories } = await seedRepositories(['acme/renamed', 'acme/two']);
    const args = { sourceControl, orgId: 'org-1', factoryProjectId: project.id };

    await expect(
      resolveWorkItemRepository({
        ...args,
        item: { metadata: { repository: 'acme/old-name', githubRepositoryId: 1 } },
      }),
    ).resolves.toEqual({
      status: 'resolved',
      projectRepositoryId: repositories[0]!.projectRepository.id,
      slug: 'acme/renamed',
    });
    // A GitLab project id must not match a GitHub repository that happens to share it.
    await expect(
      resolveWorkItemRepository({ ...args, item: { metadata: { repository: 'acme/old-name', gitlabProjectId: '2' } } }),
    ).resolves.toMatchObject({ status: 'unlinked' });

    const gitlab = await seedRepositories(['acme/gitlab-renamed'], 'gitlab');
    await expect(
      resolveWorkItemRepository({
        sourceControl: gitlab.sourceControl,
        orgId: 'org-1',
        factoryProjectId: gitlab.project.id,
        item: { metadata: { repository: 'acme/old-name', gitlabProjectId: '1' } },
      }),
    ).resolves.toMatchObject({ status: 'resolved', slug: 'acme/gitlab-renamed' });
    await expect(
      resolveWorkItemRepository({
        ...args,
        item: { metadata: { repository: 'acme/old-name', githubRepositoryId: 99 } },
      }),
    ).resolves.toEqual({ status: 'unlinked', hint: 'Repository acme/old-name is not linked to this Factory.' });
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

  it.each(['github', 'gitlab'] as const)(
    'uses only the %s id when both provider ids are present',
    async integrationId => {
      const { sourceControl, project } = await seedRepositories(['acme/one', 'acme/two'], integrationId);

      await expect(
        resolveWorkItemRepository({
          sourceControl,
          orgId: 'org-1',
          factoryProjectId: project.id,
          item: { metadata: { repository: 'acme/old-name', githubRepositoryId: 1, gitlabProjectId: '2' } },
        }),
      ).resolves.toMatchObject({ status: 'resolved', slug: integrationId === 'github' ? 'acme/one' : 'acme/two' });
    },
  );

  it('falls back to a linked slug for unmatched ids and reports an empty factory', async () => {
    const { sourceControl, project } = await seedRepositories(['acme/one']);
    await expect(
      resolveWorkItemRepository({
        sourceControl,
        orgId: 'org-1',
        factoryProjectId: project.id,
        item: { metadata: { repository: 'acme/one', githubRepositoryId: 99 } },
      }),
    ).resolves.toMatchObject({ status: 'resolved', slug: 'acme/one' });

    const empty = await seedRepositories([]);
    await expect(
      resolveWorkItemRepository({
        sourceControl: empty.sourceControl,
        orgId: 'org-1',
        factoryProjectId: empty.project.id,
        item: { metadata: null },
      }),
    ).resolves.toEqual({ status: 'unlinked', hint: 'This Factory has no linked source-control repositories.' });
  });

  it('does not pick a provider id shared by multiple linked installations', async () => {
    const { sourceControl, project } = await seedRepositories(['acme/one']);
    const installation = await sourceControl.installations.upsert({
      orgId: 'org-1',
      connectedByUserId: 'user-1',
      externalId: 'installation-2',
    });
    const connection = await sourceControl.connections.create({
      orgId: 'org-1',
      factoryProjectId: project.id,
      installationId: installation.id,
      createdByUserId: 'user-1',
    });
    const repository = await sourceControl.repositories.upsert({
      orgId: 'org-1',
      input: { installationId: installation.id, externalId: '1', slug: 'acme/two', defaultBranch: 'main' },
    });
    await sourceControl.projectRepositories.link({
      orgId: 'org-1',
      connectionId: connection.id,
      repositoryId: repository.id,
      createdByUserId: 'user-1',
      sandboxProvider: 'local',
      sandboxWorkdir: '/sandbox/acme/two',
    });
    const args = { sourceControl, orgId: 'org-1', factoryProjectId: project.id };

    await expect(
      resolveWorkItemRepository({ ...args, item: { metadata: { githubRepositoryId: 1 } } }),
    ).resolves.toEqual({
      status: 'unlinked',
      hint: 'Source-control repository 1 is not linked to this Factory.',
    });
    await expect(
      resolveWorkItemRepository({
        ...args,
        item: { metadata: { githubRepositoryId: 1, repository: 'acme/two' } },
      }),
    ).resolves.toMatchObject({ status: 'resolved', slug: 'acme/two' });
  });
});
