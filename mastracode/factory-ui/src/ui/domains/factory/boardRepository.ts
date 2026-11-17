import type { LinkedRepositoryPayload } from '../workspaces/services/github';

function repositoryMatchesCardSource(repository: LinkedRepositoryPayload, source: string) {
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

interface CardRepositoryFacts {
  source: string;
  metadata?: Record<string, unknown>;
  workItem?: { metadata: Record<string, unknown> | null };
}

function cardSourceMetadata(card: CardRepositoryFacts): Record<string, unknown> {
  return { ...card.metadata, ...card.workItem?.metadata };
}

export function cardProjectRepositoryId<Fallback extends string | undefined>(
  repositories: LinkedRepositoryPayload[],
  card: CardRepositoryFacts,
  fallback: Fallback,
): string | Fallback {
  return (
    findUniqueRepositoryByProviderId(repositories, card.source, cardSourceMetadata(card))?.projectRepositoryId ??
    fallback
  );
}
