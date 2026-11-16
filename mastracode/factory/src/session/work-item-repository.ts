import { SourceControlConnectionNotFoundError } from '../storage/domains/source-control/base.js';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import type { Card } from '../storage/domains/work-items/base.js';
import { resolveEnvironmentRepositories } from './environment-repositories.js';

export type WorkItemRepositoryResolution =
  | { status: 'resolved'; projectRepositoryId: string; slug: string }
  | { status: 'unlinked'; hint: string }
  | { status: 'ambiguous'; candidates: string[] };

interface LinkedRepository {
  projectRepositoryId: string;
  externalId: string;
  slug: string;
  inEnvironment: boolean;
}

async function listLinkedRepositories(args: {
  sourceControl: SourceControlStorageHandle;
  orgId: string;
  factoryProjectId: string;
}): Promise<LinkedRepository[]> {
  const { sourceControl, orgId, factoryProjectId } = args;
  const connections = await sourceControl.connections.list({ orgId, factoryProjectId });
  const linked: LinkedRepository[] = [];

  for (const connection of connections.filter(candidate => candidate.integrationId === sourceControl.integrationId)) {
    try {
      const projectRepositories = await sourceControl.projectRepositories.list({ orgId, connectionId: connection.id });
      const repositories = await Promise.all(
        projectRepositories.map(async projectRepository => ({
          projectRepository,
          repository: await sourceControl.repositories.get({ orgId, id: projectRepository.repositoryId }),
        })),
      );
      for (const { projectRepository, repository } of repositories) {
        if (repository) {
          linked.push({
            projectRepositoryId: projectRepository.id,
            externalId: repository.externalId,
            slug: repository.slug,
            inEnvironment: projectRepository.inEnvironment,
          });
        }
      }
    } catch (error) {
      if (!(error instanceof SourceControlConnectionNotFoundError)) throw error;
      // A stale provider connection must not hide healthy linked repositories.
    }
  }

  return linked;
}

function getExternalRepositoryId(integrationId: string, metadata: Record<string, unknown>): string | undefined {
  let id: unknown;
  switch (integrationId) {
    case 'github':
      id = metadata.githubRepositoryId;
      break;
    case 'gitlab':
      id = metadata.gitlabProjectId;
      break;
    default:
      return undefined;
  }
  return id == null ? undefined : String(id);
}

/**
 * The one link among `matches` a run can use. A repository can be linked more
 * than once (a provider-app reinstall adds a second link for the same slug),
 * but only one of those links is in the environment, and only an environment
 * link can start a session, so it wins over its out-of-environment duplicates.
 */
function pickLink(matches: LinkedRepository[]): LinkedRepository | undefined {
  if (matches.length === 1) return matches[0];
  const inEnvironment = matches.filter(repository => repository.inEnvironment);
  return inEnvironment.length === 1 ? inEnvironment[0] : undefined;
}

function findRepositoryBySlug(repositories: LinkedRepository[], slug: string) {
  const matches = repositories.filter(repository => repository.slug === slug);
  return pickLink(matches) ?? matches[0];
}

function resolvedRepository(repository: LinkedRepository): WorkItemRepositoryResolution {
  return { status: 'resolved', projectRepositoryId: repository.projectRepositoryId, slug: repository.slug };
}

export async function resolveWorkItemRepository(args: {
  sourceControl: SourceControlStorageHandle;
  orgId: string;
  factoryProjectId: string;
  item: Pick<Card, 'metadata'> & { workItem: Pick<Card['workItem'], 'metadata'> };
  linearRepositoryMap?: Record<string, string>;
}): Promise<WorkItemRepositoryResolution> {
  const { sourceControl, item, linearRepositoryMap } = args;
  const metadata = item.workItem.metadata ?? {};
  const linked = await listLinkedRepositories(args);
  const repositorySignal = typeof item.metadata?.repository === 'string' ? item.metadata.repository : undefined;
  const externalRepositorySignal = getExternalRepositoryId(sourceControl.integrationId, metadata);
  const linearProjectId = typeof metadata.linearProjectId === 'string' ? metadata.linearProjectId : undefined;
  const mappedRepository = linearProjectId ? linearRepositoryMap?.[linearProjectId] : undefined;

  // The provider id survives repository renames, so it outranks a possibly stale slug.
  if (externalRepositorySignal !== undefined) {
    const match = pickLink(linked.filter(repository => repository.externalId === externalRepositorySignal));
    if (match) return resolvedRepository(match);
  }

  if (repositorySignal) {
    const match = findRepositoryBySlug(linked, repositorySignal);
    return match
      ? resolvedRepository(match)
      : { status: 'unlinked', hint: `Repository ${repositorySignal} is not linked to this Factory.` };
  }

  if (externalRepositorySignal !== undefined) {
    return {
      status: 'unlinked',
      hint: `Source-control repository ${externalRepositorySignal} is not linked to this Factory.`,
    };
  }

  if (mappedRepository) {
    const match = findRepositoryBySlug(linked, mappedRepository);
    return match
      ? resolvedRepository(match)
      : { status: 'unlinked', hint: `Mapped repository ${mappedRepository} is not linked to this Factory.` };
  }

  const candidates = [...new Set(linked.map(repository => repository.slug))].sort();
  if (candidates.length === 0) {
    return { status: 'unlinked', hint: 'This Factory has no linked source-control repositories.' };
  }
  // Every link shares the one slug here, so prefer the environment link among them.
  const onlyRepository = candidates.length === 1 ? (pickLink(linked) ?? linked[0]) : undefined;
  if (onlyRepository) return resolvedRepository(onlyRepository);
  return { status: 'ambiguous', candidates };
}

export type RunRepositoryResolution =
  | {
      status: 'resolved';
      projectRepositoryId: string;
      slug: string;
      /**
       * Set when the card names no repository: the sandbox repositories its
       * agent chooses among. The run is filed under `slug` until it does.
       */
      unnamed?: { repositories: string[] };
    }
  | { status: 'unlinked'; hint: string };

/**
 * Where a run on `item` is filed. A card that names its repository resolves
 * exactly as {@link resolveWorkItemRepository} does. A card that names none
 * among several repositories is not refused: the sandbox holds every
 * environment repository, so the run stays in `boundProjectRepositoryId` (the
 * session already working on the card) or else in the environment's first
 * repository, and its agent determines which repository the card belongs to.
 */
export async function resolveRunRepository(
  args: Parameters<typeof resolveWorkItemRepository>[0] & { boundProjectRepositoryId?: string },
): Promise<RunRepositoryResolution> {
  const resolution = await resolveWorkItemRepository(args);
  if (resolution.status !== 'ambiguous') return resolution;
  const { sourceControl, orgId, factoryProjectId, boundProjectRepositoryId } = args;
  const environment = await resolveEnvironmentRepositories({ sourceControl, orgId, factoryProjectId });
  const unnamed = { repositories: environment.map(entry => entry.repository.slug) };
  if (boundProjectRepositoryId !== undefined) {
    const link = await sourceControl.projectRepositories.get({ orgId, id: boundProjectRepositoryId });
    const linked = link && (await sourceControl.repositories.get({ orgId, id: link.repositoryId }));
    const currentLinks = link
      ? await sourceControl.projectRepositories.list({ orgId, connectionId: link.connectionId })
      : [];
    if (
      !linked ||
      !resolution.candidates.includes(linked.slug) ||
      !currentLinks.some(candidate => candidate.id === boundProjectRepositoryId)
    ) {
      return { status: 'unlinked', hint: 'The existing session repository is not linked to this Factory.' };
    }
    return { status: 'resolved', projectRepositoryId: boundProjectRepositoryId, slug: linked.slug, unnamed };
  }
  const primary = environment[0];
  if (!primary) {
    return { status: 'unlinked', hint: 'None of the repositories linked to this Factory is in its environment.' };
  }
  return { status: 'resolved', projectRepositoryId: primary.link.id, slug: primary.repository.slug, unnamed };
}

/** Card metadata recording the `repository` a run chose for a card that named none. */
export const REPOSITORY_CHOICE_KEY = 'repositoryChoice';

/**
 * Whether a run recorded `slug` as the card's repository. Every role session
 * on the card was filed before it named a repository, so under another one;
 * they may keep working on the card, in `slug`. A repository set any other
 * way (intake, a person) no longer matches the recorded choice and still
 * refuses a session filed elsewhere.
 */
export function repositoryChosenByRun(item: Pick<Card, 'metadata'>, slug: string): boolean {
  const choice = item.metadata?.[REPOSITORY_CHOICE_KEY];
  if (typeof choice !== 'object' || choice === null) return false;
  return item.metadata?.repository === slug && (choice as Record<string, unknown>).slug === slug;
}

const UNNAMED_REPOSITORY_INSTRUCTION = 'This card names no repository.';

/** The plugin instruction telling a run's agent which repository it works in. */
export function runRepositoryInstruction(
  repository: { slug: string; unnamed?: { repositories: string[] } },
  ownSlug: string,
): string {
  if (repository.unnamed) {
    return `${UNNAMED_REPOSITORY_INSTRUCTION} This session's sandbox holds ${repository.unnamed.repositories.join(', ')}. Before editing files, determine from the card which of them it belongs to and work in that repository's checkout; pass it as \`repository\` to the source_control_* tools (they default to ${ownSlug}). The first push or change request records it on the card. If the card belongs to none of them, stop and say so.`;
  }
  const elsewhere =
    repository.slug === ownSlug
      ? ''
      : ` This session is filed under ${ownSlug}, so pass \`repository: ${repository.slug}\` to the source_control_* tools.`;
  return `Target repository: ${repository.slug}. Before editing files or creating a pull request, verify this session's checkout matches the target repository.${elsewhere}`;
}

export function isRunRepositoryInstruction(instruction: string): boolean {
  return instruction.startsWith('Target repository: ') || instruction.startsWith(UNNAMED_REPOSITORY_INSTRUCTION);
}
