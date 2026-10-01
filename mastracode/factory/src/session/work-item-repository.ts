import type { JiraRepositoryRoutes } from '../storage/domains/intake/base.js';
import {
  SourceControlConnectionNotFoundError,
  type SourceControlStorageHandle,
} from '../storage/domains/source-control/base.js';
import type { WorkItemRow } from '../storage/domains/work-items/base.js';

export type WorkItemRepositoryResolution =
  | { status: 'resolved'; projectRepositoryId: string; slug: string }
  | { status: 'unlinked'; hint: string }
  | { status: 'ambiguous'; candidates: string[] };

interface LinkedRepository {
  projectRepositoryId: string;
  externalId: string;
  slug: string;
}

/** Case-insensitive, like labels: Jira preserves component casing but users rarely type it the same way twice. */
function normalizeComponentName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Repository a Jira card is routed to by Settings › Intake: the first of the
 * card's components with a route under its source wins, then the source's
 * project default. `undefined` when the card is not a routed Jira card.
 */
export function resolveJiraMappedRepository(
  metadata: Record<string, unknown>,
  routes: JiraRepositoryRoutes | undefined,
): string | undefined {
  const sourceId = typeof metadata.jiraSourceId === 'string' ? metadata.jiraSourceId : undefined;
  if (!sourceId || !routes) return undefined;
  const componentRoutes = routes.byComponent?.[sourceId];
  const components = Array.isArray(metadata.components)
    ? metadata.components.filter((component): component is string => typeof component === 'string')
    : [];
  if (componentRoutes && components.length > 0) {
    const byName = new Map(Object.entries(componentRoutes).map(([name, slug]) => [normalizeComponentName(name), slug]));
    for (const component of components) {
      const slug = byName.get(normalizeComponentName(component));
      if (slug) return slug;
    }
  }
  return routes.byProject?.[sourceId];
}

export async function resolveWorkItemRepository(args: {
  sourceControl: SourceControlStorageHandle;
  orgId: string;
  factoryProjectId: string;
  item: Pick<WorkItemRow, 'metadata'>;
  linearRepositoryMap?: Record<string, string>;
  jiraRepositoryRoutes?: JiraRepositoryRoutes;
}): Promise<WorkItemRepositoryResolution> {
  const { sourceControl, orgId, factoryProjectId, item, linearRepositoryMap, jiraRepositoryRoutes } = args;
  const metadata = item.metadata ?? {};
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
          });
        }
      }
    } catch (error) {
      if (!(error instanceof SourceControlConnectionNotFoundError)) throw error;
      // A stale provider connection must not hide healthy linked repositories.
    }
  }

  const repositorySignal = typeof metadata.repository === 'string' ? metadata.repository : undefined;
  const externalRepositoryId = metadata.githubRepositoryId ?? metadata.gitlabProjectId;
  const externalRepositorySignal = externalRepositoryId == null ? undefined : String(externalRepositoryId);
  const linearProjectId = typeof metadata.linearProjectId === 'string' ? metadata.linearProjectId : undefined;
  const mappedRepository =
    resolveJiraMappedRepository(metadata, jiraRepositoryRoutes) ??
    (linearProjectId ? linearRepositoryMap?.[linearProjectId] : undefined);

  if (repositorySignal) {
    const match = linked.find(repository => repository.slug === repositorySignal);
    return match
      ? { status: 'resolved', projectRepositoryId: match.projectRepositoryId, slug: match.slug }
      : { status: 'unlinked', hint: `Repository ${repositorySignal} is not linked to this Factory.` };
  }

  if (externalRepositorySignal !== undefined) {
    const matches = linked.filter(repository => repository.externalId === externalRepositorySignal);
    if (matches.length === 1) {
      return { status: 'resolved', projectRepositoryId: matches[0]!.projectRepositoryId, slug: matches[0]!.slug };
    }
    return {
      status: 'unlinked',
      hint: `Source-control repository ${externalRepositorySignal} is not linked to this Factory.`,
    };
  }

  if (mappedRepository) {
    const match = linked.find(repository => repository.slug === mappedRepository);
    return match
      ? { status: 'resolved', projectRepositoryId: match.projectRepositoryId, slug: match.slug }
      : { status: 'unlinked', hint: `Mapped repository ${mappedRepository} is not linked to this Factory.` };
  }

  const candidates = [...new Set(linked.map(repository => repository.slug))].sort();
  if (candidates.length === 0) {
    return { status: 'unlinked', hint: 'This Factory has no linked source-control repositories.' };
  }
  if (candidates.length === 1) {
    const match = linked.find(repository => repository.slug === candidates[0])!;
    return { status: 'resolved', projectRepositoryId: match.projectRepositoryId, slug: match.slug };
  }
  return { status: 'ambiguous', candidates };
}
