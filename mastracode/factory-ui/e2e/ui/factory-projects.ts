import type { ProjectListRepository } from '@mastra/factory/routes/contracts';

/**
 * One repository linked to a project, as `GET /web/factory/projects` lists it
 * under that project. Defaults describe a GitHub repository whose link follows
 * the repository's `main` branch.
 */
export function listedRepository(
  projectRepositoryId: string,
  slug: string,
  overrides: Partial<ProjectListRepository> = {},
): ProjectListRepository {
  return {
    projectRepositoryId,
    connectionId: 'connection-1',
    integrationId: 'github',
    repositoryId: `repository-${projectRepositoryId}`,
    externalId: null,
    slug,
    defaultBranch: 'main',
    branch: null,
    sandboxWorkdir: `/workspace/${slug}`,
    ...overrides,
  };
}
