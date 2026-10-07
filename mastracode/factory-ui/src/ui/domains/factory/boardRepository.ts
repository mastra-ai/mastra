import type { LinkedRepositoryPayload } from '../workspaces/services/github';
import type { IntakeConfig } from './services/intake';

export function cardLinearProjectId(source: string, metadata: Record<string, unknown> | undefined) {
  if (source !== 'linear-issue') return undefined;
  if (typeof metadata?.linearProjectId !== 'string') return undefined;
  return metadata.linearProjectId;
}

function matchesProviderRepositoryId(
  repository: LinkedRepositoryPayload,
  metadata: Record<string, unknown> | undefined,
) {
  const provider = repository.provider ?? 'github';
  const id = provider === 'github' ? metadata?.githubRepositoryId : metadata?.gitlabProjectId;
  return id != null && repository.externalId === String(id);
}

function findUniqueRepositoryByProviderId(
  repositories: LinkedRepositoryPayload[],
  metadata: Record<string, unknown> | undefined,
) {
  const matches = repositories.filter(repository => matchesProviderRepositoryId(repository, metadata));
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
  const repository = findUniqueRepositoryByProviderId(repositories, metadata);
  if (repository) return repository.slug;
  if (typeof metadata?.repository === 'string') return metadata.repository;
  const projectId = cardLinearProjectId(source, metadata);
  if (projectId === undefined) return undefined;
  return config?.linear.repositoryByLinearProject?.[projectId];
}
