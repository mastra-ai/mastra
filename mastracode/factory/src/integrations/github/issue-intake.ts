import type { IntakeStorage } from '../../storage/domains/intake/base.js';
import type { SourceControlStorageHandle } from '../../storage/domains/source-control/base.js';

export const SEED_GITHUB_ISSUE_SOURCES_MIGRATION = 'seed_github_issue_sources_from_linked_repositories';

/** Whether issues opened in `repositoryName` become new cards: only repositories the org selected in Work Intake do. */
export async function githubIssueIntakeSelected(
  intake: Pick<IntakeStorage, 'getConfig'>,
  orgId: string,
  repositoryName: string,
): Promise<boolean> {
  const { github } = await intake.getConfig({ orgId, integrationIds: ['github'] });
  const synced = github?.enabled ? (github.sourceIds ?? []) : [];
  const slug = repositoryName.toLowerCase();
  return synced.some(sourceId => sourceId.toLowerCase() === slug);
}

type LinkedRepositorySource = Pick<SourceControlStorageHandle, 'projectRepositories' | 'repositories'>;

async function* linkedGithubRepositories(sourceControl: LinkedRepositorySource) {
  for (const key of await sourceControl.projectRepositories.listConfiguredExternalKeys()) {
    for (const target of await sourceControl.projectRepositories.listByExternalRepository(key)) {
      const repository = await sourceControl.repositories.get({
        orgId: target.orgId,
        id: target.projectRepository.repositoryId,
      });
      if (repository) yield { orgId: target.orgId, projectRepositoryId: target.projectRepository.id, slug: repository.slug };
    }
  }
}

/** Every repository linked to a Factory project, grouped by org, as intake source ids. */
export async function linkedGithubSlugsByOrg(sourceControl: LinkedRepositorySource): Promise<Map<string, string[]>> {
  const slugsByOrg = new Map<string, Set<string>>();
  for await (const { orgId, slug } of linkedGithubRepositories(sourceControl)) {
    const slugs = slugsByOrg.get(orgId) ?? new Set<string>();
    slugs.add(slug);
    slugsByOrg.set(orgId, slugs);
  }
  return new Map([...slugsByOrg].map(([orgId, slugs]) => [orgId, [...slugs]]));
}

/**
 * One Factory link per selected repository, so selecting it can bring in its open issues. One is enough: the
 * backlog it feeds reaches every project linked to that repository.
 */
export async function linkedGithubProjectRepositoryIds(
  sourceControl: LinkedRepositorySource,
  orgId: string,
  slugs: string[],
): Promise<string[]> {
  const idBySlug = new Map(slugs.map(slug => [slug.toLowerCase(), '']));
  for await (const linked of linkedGithubRepositories(sourceControl)) {
    const slug = linked.slug.toLowerCase();
    if (linked.orgId === orgId && idBySlug.get(slug) === '') idBySlug.set(slug, linked.projectRepositoryId);
  }
  return [...idBySlug.values()].filter(Boolean);
}
