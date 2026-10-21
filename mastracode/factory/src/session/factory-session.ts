import type { MastraCodeState } from '@mastra/code-sdk/schema';
import type { AgentController } from '@mastra/core/agent-controller';

import { resolveTenantProviderDefaultModel } from '../routes/tenant-credentials.js';
import type { ModelDefaultsStorage } from '../storage/domains/model-defaults/base.js';
import { effectiveModelScope } from '../storage/domains/projects/base.js';
import type { EffectiveModelScope, FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import { SourceControlConnectionNotFoundError } from '../storage/domains/source-control/base.js';
import type {
  SourceControlSession,
  SourceControlSessionVisibility,
  SourceControlStorageHandle,
} from '../storage/domains/source-control/base.js';
import { resolveEnvironmentRepositories } from './environment-repositories.js';
import { seedSessionOrg } from './org-seed.js';

type FactorySession = Awaited<ReturnType<AgentController<MastraCodeState>['createSession']>>;

export class FactorySourceControlConflictError extends Error {}

/** Resolve the model and exclusive credential scope for a Factory session. */
export async function resolveFactorySessionModel(args: {
  projects: FactoryProjectsStorage | undefined;
  modelDefaults: ModelDefaultsStorage | undefined;
  factoryProjectId: string | undefined;
  orgId: string;
  ownerUserId: string;
  /** A work-item run or an interactive session; a hybrid Factory resolves a different scope for each. */
  context: 'run' | 'session';
}): Promise<{ modelScope: EffectiveModelScope; modelId?: string }> {
  if (!args.projects || !args.factoryProjectId) throw new Error('Factory model policy is unavailable.');

  const project = await args.projects.getById({ id: args.factoryProjectId });
  if (!project || project.orgId !== args.orgId) throw new Error('Factory model policy is unavailable.');
  if (effectiveModelScope(project.modelScope, args.context) === 'factory') {
    return { modelScope: 'factory', ...(project.defaultModelId ? { modelId: project.defaultModelId } : {}) };
  }

  try {
    const userDefault = await args.modelDefaults?.get({ orgId: args.orgId, userId: args.ownerUserId });
    return { modelScope: 'user', ...(userDefault?.modelId ? { modelId: userDefault.modelId } : {}) };
  } catch (error) {
    console.warn('[Factory] Owner default model lookup failed; using the mode default model', {
      orgId: args.orgId,
      ownerUserId: args.ownerUserId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { modelScope: 'user' };
  }
}

export interface SourceControlSessionLookup {
  getBySessionId(sessionId: string): Promise<SourceControlSession | null>;
  getSourceControlBySessionId(sessionId: string): Promise<SourceControlStorageHandle | null>;
  /** Side sessions started by `originSessionId`, across every provider. */
  listByOrigin(args: { orgId: string; originSessionId: string }): Promise<SourceControlSession[]>;
  rename(args: { sessionId: string; title: string }): Promise<void>;
  setOriginMuted(args: { sessionId: string; muted: boolean }): Promise<void>;
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
    listByOrigin: async args =>
      (await Promise.all(sourceControls.map(sourceControl => sourceControl.sessions.listByOrigin(args)))).flat(),
    rename: async args => (await resolve(args.sessionId))?.sourceControl.sessions.rename(args),
    setOriginMuted: async args => (await resolve(args.sessionId))?.sourceControl.sessions.setOriginMuted(args),
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
  /** A pre-generated session id, so a caller can name the branch after it. Defaults to a fresh UUID. */
  sessionId?: string;
  /** Defaults to 'org'. A side session copies its parent's visibility. */
  visibility?: SourceControlSessionVisibility;
  /** The session and thread that started this one as a side session. */
  origin?: { sessionId: string; threadId: string };
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
 * repository to work in, the sandbox holds every environment repository. The
 * PR tools default to this link, and subscriptions, audit and the work item's
 * repository check still read it; moving them to the per-repository
 * `sessionRepositories` rows is a follow-up.
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
  if (!connections.some(candidate => candidate.integrationId === sourceControl.integrationId)) {
    return { found: false, reason: 'connection' };
  }
  const repositories = await resolveEnvironmentRepositories({ sourceControl, orgId, factoryProjectId });
  const primary = repositories.find(
    candidate => projectRepositoryId === undefined || candidate.link.id === projectRepositoryId,
  );
  if (!primary) return { found: false, reason: 'repository' };
  return {
    found: true,
    projectRepositoryId: primary.link.id,
    baseBranch: primary.link.branch ?? primary.repository.defaultBranch,
    connectedByUserId: primary.connection.createdByUserId,
  };
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
    sessionId: args.sessionId ?? globalThis.crypto.randomUUID(),
    projectRepositoryId: resolved.projectRepositoryId,
    factoryProjectId,
    orgId,
    userId,
    branch,
    baseBranch: resolved.baseBranch,
    visibility: args.visibility ?? 'org',
    ...(args.origin ? { origin: args.origin } : {}),
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
  modelScope: EffectiveModelScope;
  ownerUserId: string;
  /**
   * The model selected by the Factory scope. Without it the provider default of a connected
   * provider is applied when the SDK mode default has no credential, else the mode default.
   */
  defaultModelId?: string;
}

/**
 * Apply a factory project's main model to a session on every run.
 *
 * The model switch is best-effort. A retired model id must not sink a run that
 * is otherwise ready, and the reason is logged. Observational-memory settings are resolved from the
 * authoritative row per invocation before memory processors run.
 */
export async function hydrateFactorySession(
  session: FactorySession,
  args: HydrateFactorySessionArgs,
): Promise<string | undefined> {
  // The org rung knowledge curation scopes on. Seeded first so it lands even if
  // a later best-effort step fails; an empty org marks the session unresolved.
  await seedSessionOrg(session, args.orgId);
  await session.state.set({
    factoryModelScope: args.modelScope,
    factoryOwnerUserId: args.ownerUserId,
  });

  let selectedModelId = args.defaultModelId;
  if (!selectedModelId) {
    const modeModelId = session.mode.resolve().defaultModelId;
    const providerModelId = await resolveTenantProviderDefaultModel(
      { orgId: args.orgId, userId: args.ownerUserId, credentialScope: args.modelScope },
      modeModelId,
    ).catch(error => {
      console.warn('[Factory Start] Failed to resolve a provider default model', {
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    });
    selectedModelId = providerModelId ?? modeModelId;
  }
  if (!selectedModelId) return undefined;

  let switched = true;
  try {
    await session.model.switch(selectedModelId);
  } catch (error) {
    switched = false;
    console.warn('[Factory Start] Failed to apply scoped default model', {
      modelId: selectedModelId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  // Subagents otherwise keep the server-wide settings (or the SDK's built-in
  // default), which may name a provider this factory has no credentials for.
  // Each role is independent, so one failure doesn't strand the others.
  for (const agentType of ['explore', 'plan', 'execute']) {
    try {
      await session.subagents.model.set({ modelId: selectedModelId, agentType });
    } catch (error) {
      console.warn('[Factory Start] Failed to apply scoped default subagent model', {
        agentType,
        modelId: selectedModelId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  // Callers pin this id to the thread, so only report a model the session actually runs on.
  return switched ? selectedModelId : undefined;
}
