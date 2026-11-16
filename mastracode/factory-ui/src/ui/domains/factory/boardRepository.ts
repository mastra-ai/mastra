import type { LinkedRepositoryPayload } from '../workspaces/services/github';
import type { IntakeConfig } from './services/intake';

export function cardLinearProjectId(source: string, metadata: Record<string, unknown> | undefined) {
  if (source !== 'linear-issue') return undefined;
  if (typeof metadata?.linearProjectId !== 'string') return undefined;
  return metadata.linearProjectId;
}

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

interface CardRepositoryFacts {
  source: string;
  metadata?: Record<string, unknown>;
  workItem?: { metadata: Record<string, unknown> | null };
}

/** The provider's facts about a card's source outrank what the card stored itself. */
export function cardSourceMetadata(card: CardRepositoryFacts): Record<string, unknown> {
  return { ...card.metadata, ...card.workItem?.metadata };
}

export type CardSessionRepository =
  | { kind: 'resolved'; repository: LinkedRepositoryPayload }
  | { kind: 'choose'; choices: LinkedRepositoryPayload[] }
  | { kind: 'unavailable'; reason: string };

/** Where a card's own session can start: the repository its source names, else the one it could live in. */
export function cardSessionRepository(
  repositories: LinkedRepositoryPayload[],
  card: CardRepositoryFacts,
  config: IntakeConfig | undefined,
): CardSessionRepository {
  const compatible = repositories.filter(repository => repositoryMatchesCardSource(repository, card.source));
  if (compatible.length === 0) {
    return { kind: 'unavailable', reason: "No repository matching this card's provider is linked to this Factory." };
  }
  const slug = cardRepositorySlug(card.source, cardSourceMetadata(card), config, repositories);
  if (slug === undefined) {
    const [only] = compatible;
    return compatible.length === 1 && only
      ? { kind: 'resolved', repository: only }
      : { kind: 'choose', choices: compatible };
  }
  const named = compatible.filter(candidate => candidate.slug === slug);
  const [only] = named;
  if (named.length > 1) return { kind: 'choose', choices: named };
  if (only) return { kind: 'resolved', repository: only };
  return {
    kind: 'unavailable',
    reason: `Repository ${slug} is not linked to this Factory with a provider matching this card.`,
  };
}

/** The linked repository a card's source lives in, else the board's primary repository. */
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
