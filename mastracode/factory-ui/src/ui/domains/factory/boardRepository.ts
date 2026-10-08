import type { LinkedRepositoryPayload } from '../workspaces/services/github';
import type { IntakeConfig } from './services/intake';

export function cardLinearProjectId(source: string, metadata: Record<string, unknown> | undefined) {
  if (source !== 'linear-issue') return undefined;
  if (typeof metadata?.linearProjectId !== 'string') return undefined;
  return metadata.linearProjectId;
}

export function repositoryMatchesCardSource(repository: LinkedRepositoryPayload, source: string) {
  const provider = repository.provider ?? 'github';
  if (source === 'github-issue' || source === 'github-pr') return provider === 'github';
  if (source === 'gitlab-issue' || source === 'gitlab-pr') return provider === 'gitlab';
  return true;
}

function matchesProviderRepositoryId(
  repository: LinkedRepositoryPayload,
  source: string,
  metadata: Record<string, unknown> | undefined,
) {
  if (!repositoryMatchesCardSource(repository, source)) return false;
  const provider = repository.provider ?? 'github';
  const id = provider === 'github' ? metadata?.githubRepositoryId : metadata?.gitlabProjectId;
  return id != null && repository.externalId === String(id);
}

function findUniqueRepositoryByProviderId(
  repositories: LinkedRepositoryPayload[],
  source: string,
  metadata: Record<string, unknown> | undefined,
) {
  const matches = repositories.filter(repository => matchesProviderRepositoryId(repository, source, metadata));
  const [match] = matches;
  return matches.length === 1 ? match : undefined;
}

export function cardRepositorySlug(
  source: string,
  metadata: Record<string, unknown> | undefined,
  config: IntakeConfig | undefined,
  repositories: LinkedRepositoryPayload[],
) {
  // The provider id survives repository renames, so it outranks a possibly stale slug.
  const repository = findUniqueRepositoryByProviderId(repositories, source, metadata);
  if (repository) return repository.slug;
  if (typeof metadata?.repository === 'string') return metadata.repository;
  const projectId = cardLinearProjectId(source, metadata);
  if (projectId === undefined) return undefined;
  return config?.linear.repositoryByLinearProject?.[projectId];
}
