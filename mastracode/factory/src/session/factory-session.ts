import type { MastraCodeState } from '@mastra/code-sdk/schema';
import type { AgentController } from '@mastra/core/agent-controller';

import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import {
  SourceControlConnectionNotFoundError,
  type SourceControlSession,
  type SourceControlStorageHandle,
} from '../storage/domains/source-control/base.js';
import { seedSessionOrg } from './org-seed.js';

type FactorySession = Awaited<ReturnType<AgentController<MastraCodeState>['createSession']>>;

export class FactorySourceControlConflictError extends Error {}

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

export interface SourceControlSessionLookup {
  getBySessionId(sessionId: string): Promise<SourceControlSession | null>;
  getSourceControlBySessionId(sessionId: string): Promise<SourceControlStorageHandle | null>;
  rename(args: { sessionId: string; title: string }): Promise<void>;
  markFirstMessage(args: { sessionId: string }): Promise<void>;
  markFirstMeaningfulExec(args: { sessionId: string }): Promise<void>;
}

/**
 * Read or update a session across every registered source-control partition.
 * Session ids are globally generated, so more than one match is invalid and
 * fails closed instead of mutating an arbitrary provider.
 */
export function createSourceControlSessionLookup(
  sourceControls: readonly SourceControlStorageHandle[],
): SourceControlSessionLookup {
  const resolve = async (
    sessionId: string,
  ): Promise<{ sourceControl: SourceControlStorageHandle; session: SourceControlSession } | null> => {
    const matches = (
      await Promise.all(
        sourceControls.map(async sourceControl => ({
          sourceControl,
          session: await sourceControl.sessions.getBySessionId(sessionId),
        })),
      )
    ).filter(
      (match): match is { sourceControl: SourceControlStorageHandle; session: SourceControlSession } =>
        match.session !== null,
    );
    if (matches.length > 1) throw new Error('Factory session exists in multiple source-control providers.');
    return matches[0] ?? null;
  };

  return {
    getBySessionId: async sessionId => (await resolve(sessionId))?.session ?? null,
    getSourceControlBySessionId: async sessionId => (await resolve(sessionId))?.sourceControl ?? null,
    rename: async args => (await resolve(args.sessionId))?.sourceControl.sessions.rename(args),
    markFirstMessage: async args => (await resolve(args.sessionId))?.sourceControl.sessions.markFirstMessage(args),
    markFirstMeaningfulExec: async args =>
      (await resolve(args.sessionId))?.sourceControl.sessions.markFirstMeaningfulExec(args),
  };
}

/**
 * Resolve the source-control provider from durable Factory repository links,
 * never from the issue tracker that happened to create the work item.
 */
export async function resolveFactorySourceControl(args: {
  sourceControls: readonly SourceControlStorageHandle[];
  orgId: string;
  factoryProjectId: string;
  sessionId?: string;
}): Promise<SourceControlStorageHandle | undefined> {
  if (args.sessionId) {
    const sessionMatches = (
      await Promise.all(
        args.sourceControls.map(async sourceControl => ({
          sourceControl,
          session: await sourceControl.sessions.getBySessionId(args.sessionId!),
        })),
      )
    ).filter(match => match.session !== null);
    if (sessionMatches.length > 1) throw new Error('Factory session exists in multiple source-control providers.');
    if (sessionMatches[0]) return sessionMatches[0].sourceControl;
  }

  const linked = [];
  for (const sourceControl of args.sourceControls) {
    const connections = await sourceControl.connections.list({
      orgId: args.orgId,
      factoryProjectId: args.factoryProjectId,
    });
    let hasLinkedRepository = false;
    for (const connection of connections) {
      try {
        if (
          (await sourceControl.projectRepositories.list({ orgId: args.orgId, connectionId: connection.id })).length > 0
        ) {
          hasLinkedRepository = true;
          break;
        }
      } catch (error) {
        if (!(error instanceof SourceControlConnectionNotFoundError)) throw error;
      }
    }
    if (hasLinkedRepository) linked.push(sourceControl);
  }
  if (linked.length > 1)
    throw new FactorySourceControlConflictError(
      'Factory project has repositories linked through multiple source-control providers.',
    );
  return linked[0];
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
  /**
   * The repository link the session is filed under: the one a work item
   * targets. Defaults to the factory's position-1 environment link (D1), for
   * callers where nothing names a repository (chat threads, user sessions).
   */
  projectRepositoryId?: string;
  /**
   * Attribute the run to this user instead of the repo connector. Set when the
   * run has an interactive user — e.g. the person who approved a proposed run.
   */
  attributeToUserId?: string;
}

export interface EnsuredFactorySourceSession {
  sessionId: string;
  userId: string;
  projectRepositoryId: string;
  branch: string;
  baseBranch: string;
}

export class FactorySourceSessionResolutionError extends Error {
  constructor(readonly reason: 'connection' | 'repository') {
    super(
      reason === 'connection'
        ? 'Factory source-control connection not found.'
        : 'Factory source-control repository not found.',
    );
    this.name = 'FactorySourceSessionResolutionError';
  }
}

export interface ResolvedFactorySourceRepository {
  projectRepositoryId: string;
  /** The repository's pinned branch, else its default branch. */
  baseBranch: string;
  /** Who connected the repository. The attribution for runs with no interactive user. */
  connectedByUserId: string;
}

/**
 * Outcome of {@link resolvePrimaryEnvironmentRepository}. A miss carries which
 * step failed: callers differ on whether that is an error (an autonomous run
 * cannot proceed) or a routine fallback (a chat integration drops to a
 * chat-only session), and the two steps fail for different reasons worth
 * reporting apart.
 */
export type FactorySourceRepositoryResult =
  | ({ found: true } & ResolvedFactorySourceRepository)
  | { found: false; reason: 'connection' | 'repository' };

/**
 * The repository link a new session is filed under. By default the position-1
 * `inEnvironment` link of the factory (decision D1); a work item that targets
 * a repository names its link through `projectRepositoryId`, which must be an
 * environment link of the same factory. Session start no longer picks a
 * repository to work in, the sandbox holds every environment repository; the
 * link keeps the PR tools, subscriptions, audit and the work item's
 * repository check on one repository until FACT-342 moves them to
 * `sessionRepositories`.
 *
 * The owner is whichever integration owns source control, matched by the
 * handle's own `integrationId` — nothing here is provider-specific.
 */
export async function resolvePrimaryEnvironmentRepository(args: {
  sourceControl: SourceControlStorageHandle;
  orgId: string;
  factoryProjectId: string;
  projectRepositoryId?: string;
}): Promise<FactorySourceRepositoryResult> {
  const { sourceControl, orgId, factoryProjectId, projectRepositoryId } = args;
  const connections = await sourceControl.connections.list({ orgId, factoryProjectId });
  const candidates = connections.filter(candidate => candidate.integrationId === sourceControl.integrationId);
  if (candidates.length === 0) return { found: false, reason: 'connection' };
  const connectionById = new Map(candidates.map(connection => [connection.id, connection]));

  const links = (await sourceControl.projectRepositories.listByProject({ orgId, factoryProjectId }))
    .filter(link => link.inEnvironment && connectionById.has(link.connectionId))
    .filter(link => projectRepositoryId === undefined || link.id === projectRepositoryId)
    .sort((a, b) => a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime());
  for (const link of links) {
    const repository = await sourceControl.repositories.get({ orgId, id: link.repositoryId });
    if (!repository) continue;
    return {
      found: true,
      projectRepositoryId: link.id,
      baseBranch: link.branch ?? repository.defaultBranch,
      connectedByUserId: connectionById.get(link.connectionId)!.createdByUserId,
    };
  }
  return { found: false, reason: 'repository' };
}

/**
 * Create the source-control session a repo-backed factory run needs.
 *
 * `FactoryStartCoordinator.prepare` requires this record to already exist —
 * `resolveSourceSession` throws `Factory session not found` otherwise — so every
 * autonomous entry point has to produce one before it can start a run. This is
 * that step, in one place: the owner's connection on the factory project, the
 * work item's repository link (else the position-1 environment link, D1) as
 * the session's link, and a session on the requested branch with that
 * repository's pinned or default branch as the base. The sandbox itself boots
 * every environment repository.
 *
 * The run is attributed to `attributeToUserId` when the caller has an
 * interactive user (e.g. the approver of a proposed run), and otherwise falls
 * back to whoever connected the repository (`connection.createdByUserId`),
 * because a genuinely autonomous run has no interactive user of its own.
 */
export async function ensureFactorySourceSession(
  args: EnsureFactorySourceSessionArgs,
): Promise<EnsuredFactorySourceSession> {
  const { sourceControl, orgId, factoryProjectId, branch, projectRepositoryId } = args;

  const resolved = await resolvePrimaryEnvironmentRepository({
    sourceControl,
    orgId,
    factoryProjectId,
    projectRepositoryId,
  });
  if (!resolved.found) throw new FactorySourceSessionResolutionError(resolved.reason);

  const userId = args.attributeToUserId ?? resolved.connectedByUserId;
  const session = await sourceControl.sessions.create({
    sessionId: globalThis.crypto.randomUUID(),
    projectRepositoryId: resolved.projectRepositoryId,
    factoryProjectId,
    orgId,
    userId,
    branch,
    baseBranch: resolved.baseBranch,
    visibility: 'org',
  });
  return {
    sessionId: session.sessionId,
    userId,
    projectRepositoryId: resolved.projectRepositoryId,
    branch: session.branch,
    baseBranch: resolved.baseBranch,
  };
}

export interface HydrateFactorySessionArgs {
  orgId: string;
  /** The factory project's default model. Without it the session keeps the SDK's built-in mode default. */
  defaultModelId?: string;
}

/**
 * Apply a factory project's main model to a session on every run.
 *
 * The model switch is best-effort. A retired model id must not sink a run that
 * is otherwise ready — the session simply keeps the default it was created with,
 * and the reason is logged. Observational-memory settings are resolved from the
 * authoritative row per invocation before memory processors run.
 */
export async function hydrateFactorySession(session: FactorySession, args: HydrateFactorySessionArgs): Promise<void> {
  // The org rung knowledge curation scopes on. Seeded first so it lands even if
  // a later best-effort step fails; an empty org marks the session unresolved.
  await seedSessionOrg(session, args.orgId);

  if (args.defaultModelId) {
    try {
      await session.model.switch(args.defaultModelId);
    } catch (error) {
      console.warn('[Factory Start] Failed to apply factory default model', {
        modelId: args.defaultModelId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    // Subagents otherwise keep the server-wide settings (or the SDK's built-in
    // default), which may name a provider this factory has no credentials for.
    // Each role is independent, so one failure doesn't strand the others.
    for (const agentType of ['explore', 'plan', 'execute']) {
      try {
        await session.subagents.model.set({ modelId: args.defaultModelId, agentType });
      } catch (error) {
        console.warn('[Factory Start] Failed to apply factory default subagent model', {
          agentType,
          modelId: args.defaultModelId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
