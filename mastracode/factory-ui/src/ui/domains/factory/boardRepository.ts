import type { LinkedRepositoryPayload } from '../workspaces/services/github';
import type { IntakeConfig } from './services/intake';

export function cardLinearProjectId(source: string, metadata: Record<string, unknown> | undefined) {
  if (source !== 'linear-issue') return undefined;
  if (typeof metadata?.linearProjectId !== 'string') return undefined;
  return metadata.linearProjectId;
}

export function cardRepositorySlug(
  source: string,
  metadata: Record<string, unknown> | undefined,
  config: IntakeConfig | undefined,
  repositories: LinkedRepositoryPayload[],
) {
  // The provider id survives repository renames, so it outranks a possibly stale slug.
  const externalId = metadata?.githubRepositoryId ?? metadata?.gitlabProjectId;
  if (externalId != null) {
    const matches = repositories.filter(repository => repository.externalId === String(externalId));
    if (matches.length === 1) return matches[0]!.slug;
  }
  if (typeof metadata?.repository === 'string') return metadata.repository;
  const projectId = cardLinearProjectId(source, metadata);
  if (projectId === undefined) return undefined;
  return config?.linear.repositoryByLinearProject?.[projectId];
}
