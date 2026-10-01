import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { resolveJiraMappedRepository, resolveWorkItemRepository } from './work-item-repository.js';

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

  it('routes Jira cards by component before the project default', async () => {
    const { sourceControl, project, repositories } = await seedRepositories(['acme/api', 'acme/web']);
    const args = { sourceControl, orgId: 'org-1', factoryProjectId: project.id };
    const jiraRepositoryRoutes = {
      byProject: { '10001': 'acme/web' },
      byComponent: { '10001': { Backend: 'acme/api' } },
    };

    await expect(
      resolveWorkItemRepository({
        ...args,
        item: { metadata: { jiraSourceId: '10001', components: ['Docs', 'backend'] } },
        jiraRepositoryRoutes,
      }),
    ).resolves.toEqual({
      status: 'resolved',
      projectRepositoryId: repositories[0]!.projectRepository.id,
      slug: 'acme/api',
    });
    await expect(
      resolveWorkItemRepository({
        ...args,
        item: { metadata: { jiraSourceId: '10001', components: ['Docs'] } },
        jiraRepositoryRoutes,
      }),
    ).resolves.toMatchObject({ status: 'resolved', slug: 'acme/web' });
    // A card from an unrouted project still asks the user to choose.
    await expect(
      resolveWorkItemRepository({
        ...args,
        item: { metadata: { jiraSourceId: '10002', components: ['Backend'] } },
        jiraRepositoryRoutes,
      }),
    ).resolves.toEqual({ status: 'ambiguous', candidates: ['acme/api', 'acme/web'] });
    // A stamped repository on the card always wins over the mapping.
    await expect(
      resolveWorkItemRepository({
        ...args,
        item: { metadata: { repository: 'acme/web', jiraSourceId: '10001', components: ['Backend'] } },
        jiraRepositoryRoutes,
      }),
    ).resolves.toMatchObject({ status: 'resolved', slug: 'acme/web' });
  });

  it('reports a Jira mapping that points at a repository no longer linked to the Factory', async () => {
    const { sourceControl, project } = await seedRepositories(['acme/api', 'acme/web']);
    await expect(
      resolveWorkItemRepository({
        sourceControl,
        orgId: 'org-1',
        factoryProjectId: project.id,
        item: { metadata: { jiraSourceId: '10001' } },
        jiraRepositoryRoutes: { byProject: { '10001': 'acme/retired' } },
      }),
    ).resolves.toEqual({ status: 'unlinked', hint: 'Mapped repository acme/retired is not linked to this Factory.' });
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

describe('resolveJiraMappedRepository', () => {
  it('ignores cards without a Jira source id and matches components case-insensitively', () => {
    const routes = { byProject: { '10001': 'acme/web' }, byComponent: { '10001': { 'Mobile App': 'acme/mobile' } } };
    expect(resolveJiraMappedRepository({ components: ['Mobile App'] }, routes)).toBeUndefined();
    expect(resolveJiraMappedRepository({ jiraSourceId: '10001', components: ['mobile app'] }, routes)).toBe(
      'acme/mobile',
    );
    expect(resolveJiraMappedRepository({ jiraSourceId: '10001', components: 'Mobile App' }, routes)).toBe('acme/web');
    expect(resolveJiraMappedRepository({ jiraSourceId: '10001' }, undefined)).toBeUndefined();
  });
});
