import { randomUUID } from 'node:crypto';

import type { MastraCodeState } from '@mastra/code-sdk/schema';
import type { AgentController } from '@mastra/core/agent-controller';

import type { MemorySettingsRecord, MemorySettingsStorage } from '../storage/domains/memory-settings/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';

type FactorySession = Awaited<ReturnType<AgentController<MastraCodeState>['createSession']>>;

/**
 * Read the factory project's default model. Best-effort: a missing project or an
 * uninitialized storage domain means "no default", never a failed run.
 */
export async function resolveFactoryDefaultModelId(
  projects: FactoryProjectsStorage | undefined,
  factoryProjectId: string | undefined,
): Promise<string | undefined> {
  if (!projects || !factoryProjectId) return undefined;
  try {
    const project = await projects.getById({ id: factoryProjectId });
    return project?.defaultModelId ?? undefined;
  } catch {
    return undefined;
  }
}

export interface EnsureFactorySourceSessionArgs {
  /**
   * Storage handle of the integration that owns source control. Nothing here is
   * provider-specific: the connection is matched by the handle's own
   * `integrationId`, so GitHub, Slack-on-behalf-of-GitHub, or any future owner
   * all resolve through the same traversal.
   */
  sourceControl: SourceControlStorageHandle;
  orgId: string;
  factoryProjectId: string;
  branch: string;
  /** Pick a specific linked repository by slug. Defaults to the first linked repository. */
  repositorySlug?: string;
}

export interface EnsuredFactorySourceSession {
  sessionId: string;
  userId: string;
  projectRepositoryId: string;
  branch: string;
  baseBranch: string;
}

export interface ResolvedFactorySourceRepository {
  projectRepositoryId: string;
  /** The repository's pinned branch, else its default branch. */
  baseBranch: string;
  /** Who connected the repository. The attribution for runs with no interactive user. */
  connectedByUserId: string;
}

/**
 * Outcome of {@link resolveFactorySourceRepository}. A miss carries which step
 * failed: callers differ on whether that is an error (an autonomous run cannot
 * proceed) or a routine fallback (a chat integration drops to a chat-only
 * session), and the two steps fail for different reasons worth reporting apart.
 */
export type FactorySourceRepositoryResult =
  | ({ found: true } & ResolvedFactorySourceRepository)
  | { found: false; reason: 'connection' | 'repository' };

/**
 * Resolve which repository a factory project's source-control runs act on: the
 * owner's connection on the project, then one of its linked repositories.
 *
 * The owner is whichever integration owns source control, matched by the
 * handle's own `integrationId` — nothing here is provider-specific.
 */
export async function resolveFactorySourceRepository(args: {
  sourceControl: SourceControlStorageHandle;
  orgId: string;
  factoryProjectId: string;
  /** Pick a specific linked repository by slug. Defaults to the first linked repository. */
  repositorySlug?: string;
}): Promise<FactorySourceRepositoryResult> {
  const { sourceControl, orgId, factoryProjectId, repositorySlug } = args;

  const connections = await sourceControl.connections.list({ orgId, factoryProjectId });
  const candidates = connections.filter(candidate => candidate.integrationId === sourceControl.integrationId);
  if (candidates.length === 0) return { found: false, reason: 'connection' };

  // A project can carry stale connections: a provider-app reinstall leaves the
  // old connection pointing at an installation that no longer exists, and that
  // row can sit ahead of the healthy one. Try every candidate and skip the ones
  // that no longer resolve rather than failing on the first.
  for (const connection of candidates) {
    let projectRepositories;
    try {
      projectRepositories = await sourceControl.projectRepositories.list({ orgId, connectionId: connection.id });
    } catch {
      // The connection no longer resolves (e.g. its installation was deleted).
      continue;
    }
    const resolvedRepositories = await Promise.all(
      projectRepositories.map(async projectRepository => ({
        projectRepository,
        repository: await sourceControl.repositories.get({ orgId, id: projectRepository.repositoryId }),
      })),
    );
    const resolved = resolvedRepositories.find(
      candidate => candidate.repository && (!repositorySlug || candidate.repository.slug === repositorySlug),
    );
    if (!resolved?.repository) continue;

    return {
      found: true,
      projectRepositoryId: resolved.projectRepository.id,
      baseBranch: resolved.projectRepository.branch ?? resolved.repository.defaultBranch,
      connectedByUserId: connection.createdByUserId,
    };
  }

  return { found: false, reason: 'repository' };
}

/**
 * Walk a Factory user-session id back to the project it belongs to.
 *
 * Repo-backed channel threads are keyed by their Factory session id, which is
 * the only handle a session-start hook gets. This turns that id back into the
 * project whose configuration the session should adopt. Durable by
 * construction — it reads the same rows the session was created from, so it
 * survives restarts without any in-memory mapping.
 */
export async function resolveFactoryProjectForSession(args: {
  sourceControl: SourceControlStorageHandle;
  sessionId: string;
}): Promise<{ factoryProjectId: string; orgId: string; userId: string } | null> {
  const { sourceControl, sessionId } = args;

  const session = await sourceControl.sessions.getBySessionId(sessionId);
  if (!session) return null;
  const projectRepository = await sourceControl.projectRepositories.get({
    orgId: session.orgId,
    id: session.projectRepositoryId,
  });
  if (!projectRepository) return null;
  const connection = await sourceControl.connections.get({ orgId: session.orgId, id: projectRepository.connectionId });
  if (!connection) return null;

  return { factoryProjectId: connection.factoryProjectId, orgId: session.orgId, userId: session.userId };
}

/**
 * Create the source-control session a repo-backed factory run needs.
 *
 * `FactoryStartCoordinator.prepare` requires this record to already exist —
 * `resolveSourceSession` throws `Factory session not found` otherwise — so every
 * autonomous entry point has to produce one before it can start a run. This is
 * that step, in one place: the owner's connection on the factory project, one of
 * its linked repositories, and a session on the requested branch with the
 * repository's pinned or default branch as the base.
 *
 * The run is attributed to whoever connected the repository
 * (`connection.createdByUserId`), because an autonomous run has no interactive
 * user of its own.
 */
export async function ensureFactorySourceSession(
  args: EnsureFactorySourceSessionArgs,
): Promise<EnsuredFactorySourceSession> {
  const { sourceControl, orgId, factoryProjectId, branch, repositorySlug } = args;

  const resolved = await resolveFactorySourceRepository({ sourceControl, orgId, factoryProjectId, repositorySlug });
  if (!resolved.found) {
    throw new Error(
      resolved.reason === 'connection'
        ? 'Factory source-control connection not found.'
        : 'Factory source-control repository not found.',
    );
  }

  const userId = resolved.connectedByUserId;
  const session = await sourceControl.sessions.create({
    sessionId: randomUUID(),
    projectRepositoryId: resolved.projectRepositoryId,
    orgId,
    userId,
    branch,
    baseBranch: resolved.baseBranch,
  });
  return {
    sessionId: session.sessionId,
    userId,
    projectRepositoryId: resolved.projectRepositoryId,
    branch: session.branch,
    baseBranch: resolved.baseBranch,
  };
}

async function applyMemorySettings(session: FactorySession, record: MemorySettingsRecord | null): Promise<void> {
  if (record?.observerModelId) await session.om.observer.switchModel({ modelId: record.observerModelId });
  if (record?.reflectorModelId) await session.om.reflector.switchModel({ modelId: record.reflectorModelId });

  const state = {
    ...(record?.observationThreshold != null ? { observationThreshold: record.observationThreshold } : {}),
    ...(record?.reflectionThreshold != null ? { reflectionThreshold: record.reflectionThreshold } : {}),
    ...(record?.observeAttachments != null ? { observeAttachments: record.observeAttachments } : {}),
  };
  if (Object.keys(state).length > 0) await session.state.set(state);
}

export interface HydrateFactorySessionArgs {
  orgId: string;
  userId: string;
  /** The factory project's default model. Without it the session keeps the SDK's built-in mode default. */
  defaultModelId?: string;
  /** Omitted when the storage domain is unavailable, in which case the session runs on memory defaults. */
  memorySettings?: MemorySettingsStorage;
}

/**
 * Apply a factory project's configuration to a freshly created session:
 * observational-memory settings, then the project's default model.
 *
 * Both steps are best-effort. A retired model id or an unreachable settings row
 * must not sink a run that is otherwise ready — the session simply keeps the
 * default it was created with, and the reason is logged.
 */
export async function hydrateFactorySession(session: FactorySession, args: HydrateFactorySessionArgs): Promise<void> {
  if (args.memorySettings) {
    try {
      const record = await args.memorySettings.get({ orgId: args.orgId, userId: args.userId });
      await applyMemorySettings(session, record);
    } catch (error) {
      console.warn('[Factory Start] Failed to apply observational-memory settings', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  if (args.defaultModelId) {
    try {
      await session.model.switch({ modelId: args.defaultModelId });
    } catch (error) {
      console.warn('[Factory Start] Failed to apply factory default model', {
        modelId: args.defaultModelId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
