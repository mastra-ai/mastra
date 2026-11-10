import type {
  ProjectRepository,
  ProjectSourceControlConnection,
  SourceControlRepository,
  SourceControlSession,
  SourceControlStorageHandle,
} from '../storage/domains/source-control/base.js';

/** One repository of a factory environment, fully resolved: the link, its repository row and its connection. */
export interface EnvironmentRepository {
  link: ProjectRepository;
  repository: SourceControlRepository;
  connection: ProjectSourceControlConnection;
}

/**
 * The `inEnvironment` links of a factory in position order, resolved to their
 * repository and connection rows, for the integration the handle belongs to.
 * A link whose connection or repository row is missing (an uninstalled app,
 * a link left behind by a reinstall) is skipped with one warning, ids only.
 */
export async function resolveEnvironmentRepositories(args: {
  sourceControl: SourceControlStorageHandle;
  orgId: string;
  factoryProjectId: string;
}): Promise<EnvironmentRepository[]> {
  const { sourceControl, orgId, factoryProjectId } = args;
  const connections = await sourceControl.connections.list({ orgId, factoryProjectId });
  const connectionById = new Map(
    connections
      .filter(connection => connection.integrationId === sourceControl.integrationId)
      .map(connection => [connection.id, connection] as const),
  );
  const links = (await sourceControl.projectRepositories.listByProject({ orgId, factoryProjectId }))
    .filter(link => link.inEnvironment)
    .sort((a, b) => a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime());
  const resolved: EnvironmentRepository[] = [];
  for (const link of links) {
    const connection = connectionById.get(link.connectionId);
    const repository = connection ? await sourceControl.repositories.get({ orgId, id: link.repositoryId }) : null;
    if (!connection || !repository) {
      console.warn('[Mastra Factory] Environment repository link cannot be resolved; skipping it', {
        orgId,
        factoryProjectId,
        projectRepositoryId: link.id,
        reason: connection ? 'repository' : 'connection',
      });
      continue;
    }
    resolved.push({ link, repository, connection });
  }
  return resolved;
}

/**
 * The repositories a session may target: the environment list plus, when the
 * session is filed under a link that is no longer in the environment (a work
 * item's repository toggled out after dispatch), that own link appended last.
 * A session can always target the repository it was filed under.
 */
export async function resolveSessionRepositories(args: {
  sourceControl: SourceControlStorageHandle;
  session: Pick<SourceControlSession, 'orgId' | 'factoryProjectId' | 'projectRepositoryId'>;
}): Promise<EnvironmentRepository[]> {
  const { sourceControl, session } = args;
  const orgId = session.orgId;
  const repositories = session.factoryProjectId
    ? await resolveEnvironmentRepositories({ sourceControl, orgId, factoryProjectId: session.factoryProjectId })
    : [];
  const ownId = session.projectRepositoryId;
  if (!ownId || repositories.some(candidate => candidate.link.id === ownId)) return repositories;
  const link = await sourceControl.projectRepositories.get({ orgId, id: ownId });
  if (!link) return repositories;
  const connection = await sourceControl.connections.get({ orgId, id: link.connectionId });
  const repository = connection ? await sourceControl.repositories.get({ orgId, id: link.repositoryId }) : null;
  if (!connection || !repository) return repositories;
  return [...repositories, { link, repository, connection }];
}

export function findEnvironmentRepository(
  repositories: EnvironmentRepository[],
  slug: string,
): EnvironmentRepository | undefined {
  const wanted = slug.trim().toLowerCase();
  return repositories.find(candidate => candidate.repository.slug.toLowerCase() === wanted);
}

export function environmentSlugs(repositories: EnvironmentRepository[]): string[] {
  return repositories.map(candidate => candidate.repository.slug);
}
