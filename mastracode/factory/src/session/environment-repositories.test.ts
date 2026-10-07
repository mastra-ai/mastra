import { afterEach, describe, expect, it, vi } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import {
  environmentSlugs,
  findEnvironmentRepository,
  resolveEnvironmentRepositories,
  resolveSessionRepositories,
} from './environment-repositories.js';

async function seed() {
  const seeded = await createFactoryStorageForTests();
  const sourceControl = seeded.sourceControl.forIntegration('github');
  const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Mastra' } });
  const installation = await sourceControl.installations.upsert({
    orgId: 'org-1',
    connectedByUserId: 'user-1',
    externalId: '123',
  });
  const connection = await sourceControl.connections.create({
    orgId: 'org-1',
    factoryProjectId: project.id,
    installationId: installation.id,
    createdByUserId: 'user-1',
  });
  const link = async (slug: string, externalId: string) => {
    const repository = await sourceControl.repositories.upsert({
      orgId: 'org-1',
      input: { installationId: installation.id, externalId, slug, defaultBranch: 'main' },
    });
    return sourceControl.projectRepositories.link({
      orgId: 'org-1',
      connectionId: connection.id,
      repositoryId: repository.id,
      createdByUserId: 'user-1',
      sandboxProvider: 'local',
      sandboxWorkdir: `/sandbox/${slug.split('/')[1]}`,
    });
  };
  const website = await link('mastra-ai/mastra-website', '1');
  const mastra = await link('mastra-ai/mastra', '2');
  const platform = await link('mastra-ai/platform', '3');
  return { seeded, sourceControl, project, connection, website, mastra, platform };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolveEnvironmentRepositories', () => {
  it('returns the in-environment links in position order with their repository and connection', async () => {
    const { sourceControl, project, website, mastra, platform, connection } = await seed();
    await sourceControl.projectRepositories.update({ orgId: 'org-1', id: platform.id, input: { position: 1 } });
    await sourceControl.projectRepositories.update({ orgId: 'org-1', id: website.id, input: { position: 2 } });
    await sourceControl.projectRepositories.update({
      orgId: 'org-1',
      id: mastra.id,
      input: { position: 3, inEnvironment: false },
    });

    const repositories = await resolveEnvironmentRepositories({
      sourceControl,
      orgId: 'org-1',
      factoryProjectId: project.id,
    });

    expect(environmentSlugs(repositories)).toEqual(['mastra-ai/platform', 'mastra-ai/mastra-website']);
    expect(repositories[0]).toMatchObject({
      link: { id: platform.id },
      repository: { slug: 'mastra-ai/platform', defaultBranch: 'main' },
      connection: { id: connection.id, createdByUserId: 'user-1' },
    });
  });

  it('skips a link whose repository row is gone, with one warning carrying ids only', async () => {
    const { sourceControl, project, mastra } = await seed();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const get = sourceControl.repositories.get.bind(sourceControl.repositories);
    vi.spyOn(sourceControl.repositories, 'get').mockImplementation(async args =>
      args.id === mastra.repositoryId ? null : get(args),
    );

    const repositories = await resolveEnvironmentRepositories({
      sourceControl,
      orgId: 'org-1',
      factoryProjectId: project.id,
    });

    expect(environmentSlugs(repositories)).toEqual(['mastra-ai/mastra-website', 'mastra-ai/platform']);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![1]).toEqual({
      orgId: 'org-1',
      factoryProjectId: project.id,
      projectRepositoryId: mastra.id,
      reason: 'repository',
    });
  });

  it('matches slugs case-insensitively', async () => {
    const { sourceControl, project, platform } = await seed();
    const repositories = await resolveEnvironmentRepositories({
      sourceControl,
      orgId: 'org-1',
      factoryProjectId: project.id,
    });
    expect(findEnvironmentRepository(repositories, ' Mastra-AI/Platform ')?.link.id).toBe(platform.id);
    expect(findEnvironmentRepository(repositories, 'mastra-ai/nope')).toBeUndefined();
  });
});

describe('resolveSessionRepositories', () => {
  it('appends the session own link when it is no longer in the environment, and never duplicates it', async () => {
    const { sourceControl, project, mastra } = await seed();
    const session = {
      orgId: 'org-1',
      factoryProjectId: project.id,
      projectRepositoryId: mastra.id,
    };

    const inEnvironment = await resolveSessionRepositories({ sourceControl, session });
    expect(environmentSlugs(inEnvironment)).toEqual([
      'mastra-ai/mastra-website',
      'mastra-ai/mastra',
      'mastra-ai/platform',
    ]);

    await sourceControl.projectRepositories.update({ orgId: 'org-1', id: mastra.id, input: { inEnvironment: false } });
    const withOwn = await resolveSessionRepositories({ sourceControl, session });
    expect(environmentSlugs(withOwn)).toEqual(['mastra-ai/mastra-website', 'mastra-ai/platform', 'mastra-ai/mastra']);
    expect(withOwn[2]!.link.inEnvironment).toBe(false);
  });

  it('returns only the environment when the session names no link', async () => {
    const { sourceControl, project } = await seed();
    const repositories = await resolveSessionRepositories({
      sourceControl,
      session: { orgId: 'org-1', factoryProjectId: project.id, projectRepositoryId: null },
    });
    expect(repositories).toHaveLength(3);
  });
});
