import { createHash } from 'node:crypto';
import type { ComputeStateSignalArgs, ComputeStateSignalResult, Processor } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';

const STATE_ID = 'factory-environment';

export type EnvironmentRepositorySetupStatus = 'ok' | 'failed' | 'skipped';

/** One repository of the booted environment as the agent is told about it: never a token or a clone URL. */
export interface SessionEnvironmentRepositoryState {
  slug: string;
  /** Absolute directory of the checkout under the workspace root. */
  dir: string;
  /** The branch the checkout ended on after boot; `null` when it stays detached. */
  branch: string | null;
  defaultBranch: string;
  position: number;
  /** `ok` ran or was already set up, `failed` exited non-zero, `skipped` has no setup command. */
  setupStatus: EnvironmentRepositorySetupStatus;
  /** The change request this session opened in the repository, once it has. */
  changeRequestUrl?: string;
}

export interface SessionEnvironmentState {
  /** The workspace root, the session's working directory; repositories sit beneath it. */
  workingDirectory: string;
  repositories: SessionEnvironmentRepositoryState[];
  /** One free-form line the boot wants the agent to know (never a credential), rendered last. */
  note?: string;
}

// The boot records what it materialized, keyed by the factory session id (the
// agent's resource id); the processor reads it on the next model step. Boot
// runs on every sandbox start, so a replacement process re-learns the state
// the first time the session's sandbox starts again.
const environments = new Map<string, { state: SessionEnvironmentState; teardown: SessionEnvironmentTeardown[] }>();

/** A repository's teardown command and the directory it runs in; kept beside the state, never rendered. */
export interface SessionEnvironmentTeardown {
  slug: string;
  dir: string;
  command: string;
}

export function recordSessionEnvironment(
  sessionId: string,
  state: SessionEnvironmentState,
  teardown: SessionEnvironmentTeardown[] = [],
): void {
  environments.set(sessionId, { state, teardown });
}

/**
 * Record what a source-control tool did in one environment repository (the
 * branch it pushed, the change request it opened) so the next signal snapshot
 * tells the agent. A no-op when the session's environment is not recorded in
 * this process or the slug is not part of it.
 */
export function updateSessionEnvironmentRepository(
  sessionId: string,
  slug: string,
  patch: { branch?: string; changeRequestUrl?: string },
): void {
  const entry = environments.get(sessionId);
  if (!entry) return;
  const wanted = slug.toLowerCase();
  const repositories = entry.state.repositories.map(repo => {
    if (repo.slug.toLowerCase() !== wanted) return repo;
    return {
      ...repo,
      ...(patch.branch !== undefined ? { branch: patch.branch } : {}),
      ...(patch.changeRequestUrl !== undefined ? { changeRequestUrl: patch.changeRequestUrl } : {}),
    };
  });
  entry.state = { ...entry.state, repositories };
}

/** Set or clear the environment's note; a no-op when the session's environment is not recorded here. */
export function setSessionEnvironmentNote(sessionId: string, note: string | null): void {
  const entry = environments.get(sessionId);
  if (!entry) return;
  const { note: _previous, ...rest } = entry.state;
  entry.state = note ? { ...rest, note } : rest;
}

export function clearSessionEnvironment(sessionId: string): void {
  environments.delete(sessionId);
}

export function peekSessionEnvironment(sessionId: string): SessionEnvironmentState | undefined {
  return environments.get(sessionId)?.state;
}

/** Teardown commands of the booted environment, in position order. */
export function peekSessionEnvironmentTeardown(sessionId: string): SessionEnvironmentTeardown[] {
  return environments.get(sessionId)?.teardown ?? [];
}

export function __clearSessionEnvironmentsForTests(): void {
  environments.clear();
}

function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

// The session id is the controller's resource id. Unlike factory runs, a user
// session carries no `factoryProjectId` in its controller state, and the
// environment is recorded for both, so only the resource id is required.
function sessionIdFromContext(requestContext: RequestContext | undefined): string | null {
  if (!requestContext || typeof requestContext.get !== 'function') return null;
  const controller = requestContext.get('controller') as { resourceId?: unknown } | undefined;
  return typeof controller?.resourceId === 'string' && controller.resourceId ? controller.resourceId : null;
}

function environmentCacheKey(state: SessionEnvironmentState): string {
  return `environment:${createHash('sha256').update(JSON.stringify(state)).digest('hex').slice(0, 16)}`;
}

/**
 * Tells the agent which repositories its sandbox holds and where: the
 * workspace root is the session's working directory and every environment
 * repository is a directory beneath it. Snapshot mode only; a new snapshot
 * is emitted when the booted set changes (a start after an environment edit).
 */
export class FactoryEnvironmentStateProcessor implements Processor<'factory-environment'> {
  readonly id = STATE_ID;
  readonly stateId = STATE_ID;

  async computeStateSignal(args: ComputeStateSignalArgs): Promise<ComputeStateSignalResult> {
    const sessionId = sessionIdFromContext(args.requestContext);
    if (!sessionId) return;
    const state = environments.get(sessionId)?.state;
    if (!state) return;
    const cacheKey = environmentCacheKey(state);
    const hasBase = Boolean(args.lastSnapshot) && args.contextWindow.hasSnapshot;
    if (hasBase && (args.tracking?.currentCacheKey ?? args.lastSnapshot?.metadata?.state?.cacheKey) === cacheKey)
      return;
    const lines = state.repositories.map(
      repo =>
        `${repo.position}. ${escapeText(repo.slug)} at ${escapeText(repo.dir)} on ${escapeText(repo.branch ?? '(detached)')} (default ${escapeText(repo.defaultBranch)}, setup ${repo.setupStatus})` +
        (repo.changeRequestUrl ? `, change request ${escapeText(repo.changeRequestUrl)}` : ''),
    );
    const contents =
      `Factory environment: ${state.repositories.length} repositories under ${escapeText(state.workingDirectory)}, your working directory.\n` +
      lines.join('\n') +
      '\nRun git and project commands inside the repository directory they belong to.' +
      (state.note ? `\n${escapeText(state.note)}` : '');
    return {
      id: STATE_ID,
      cacheKey,
      mode: 'snapshot',
      tagName: 'factory-environment',
      contents,
      value: { environment: state },
      attributes: { workingDirectory: state.workingDirectory, repositories: state.repositories.length },
      metadata: { value: { environment: state } },
    };
  }
}
