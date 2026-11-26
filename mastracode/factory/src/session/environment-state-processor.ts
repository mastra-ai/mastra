import { createHash } from 'node:crypto';
import type { ComputeStateSignalArgs, ComputeStateSignalResult, Processor } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';

import { describeSetupInProgress, runningSetup } from '../sandbox/setup-progress.js';
import type { SourceControlSession } from '../storage/domains/source-control/base.js';

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

// Unlike factory runs, a user session carries no `factoryProjectId` in its
// controller state, and the environment is recorded for both, so only the
// session id is required.
function sessionIdFromContext(requestContext: RequestContext | undefined): string | null {
  if (!requestContext || typeof requestContext.get !== 'function') return null;
  const controller = requestContext.get('controller') as { sessionId?: unknown } | undefined;
  return typeof controller?.sessionId === 'string' && controller.sessionId ? controller.sessionId : null;
}

// An untrusted checkout (a pull request under review) can carry attacker-written
// AGENTS.md files, which the SDK deliberately never loads from the working tree.
function isUntrustedCheckout(requestContext: RequestContext | undefined): boolean {
  const controller = requestContext?.get('controller') as
    | { getState?: () => { untrustedCheckout?: unknown } }
    | undefined;
  return controller?.getState?.().untrustedCheckout === true;
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
export interface FactoryEnvironmentStateProcessorOptions {
  /** Reads the session row, which marks a setup command while the sandbox runs it. */
  getSession?: (sessionId: string) => Promise<Pick<SourceControlSession, 'setupInProgress'> | null>;
}

export class FactoryEnvironmentStateProcessor implements Processor<'factory-environment'> {
  readonly id = STATE_ID;
  readonly stateId = STATE_ID;

  constructor(private readonly options: FactoryEnvironmentStateProcessorOptions = {}) {}

  async computeStateSignal(args: ComputeStateSignalArgs): Promise<ComputeStateSignalResult> {
    const sessionId = sessionIdFromContext(args.requestContext);
    if (!sessionId) return;
    const state = environments.get(sessionId)?.state;
    let session: Pick<SourceControlSession, 'setupInProgress'> | null | undefined;
    try {
      session = await this.options.getSession?.(sessionId);
    } catch (error) {
      // The signal is optional: a failed read keeps the snapshot already in
      // the window rather than failing the step or declaring setup ended.
      console.warn('[Mastra Factory] Could not read the session for its environment signal', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    const setup = runningSetup(session);
    const untrusted = isUntrustedCheckout(args.requestContext);
    const cacheKey =
      (state ? environmentCacheKey(state) : 'environment:none') +
      (setup ? `:setup:${setup.target}:${setup.startedAt.getTime()}` : '') +
      (untrusted ? ':untrusted' : '');
    const hasBase = Boolean(args.lastSnapshot) && args.contextWindow.hasSnapshot;
    const previousKey = hasBase
      ? (args.tracking?.currentCacheKey ?? args.lastSnapshot?.metadata?.state?.cacheKey)
      : undefined;
    if (previousKey === cacheKey) return;
    // Nothing to describe, unless the snapshot in the window still says setup
    // is running: a setup that failed before the boot recorded anything must
    // not leave the agent waiting on it.
    if (!state && !setup && !(typeof previousKey === 'string' && previousKey.includes(':setup:'))) return;
    const setupLine = setup ? escapeText(describeSetupInProgress(setup)) : '';
    if (!state) {
      return {
        id: STATE_ID,
        cacheKey,
        mode: 'snapshot',
        tagName: 'factory-environment',
        contents: setupLine || 'No setup command is running in the sandbox now.',
        value: { environment: null },
        attributes: {},
        metadata: { value: { environment: null } },
      };
    }
    const lines = state.repositories.map(
      (repo, index) =>
        `${index + 1}. ${escapeText(repo.slug)} at ${escapeText(repo.dir)} on ${escapeText(repo.branch ?? '(detached)')} (default ${escapeText(repo.defaultBranch)}, setup ${repo.setupStatus})` +
        (repo.changeRequestUrl ? `, change request ${escapeText(repo.changeRequestUrl)}` : ''),
    );
    const only = state.repositories.length === 1 ? state.repositories[0] : undefined;
    const contents =
      (only
        ? `Factory environment: 1 repository, ${escapeText(only.slug)} at ${escapeText(only.dir)}, your working directory.\n`
        : `Factory environment: ${state.repositories.length} repositories under ${escapeText(state.workingDirectory)}, your working directory.\n`) +
      lines.join('\n') +
      (only ? '' : '\nRun git and project commands inside the repository directory they belong to.') +
      (untrusted
        ? ''
        : "\nA directory's AGENTS.md loads after you open a file there with view or an edit tool, not through execute_command. Before your first change in a directory, read any AGENTS.md in it or its parent directories you have not seen yet.") +
      (state.note ? `\n${escapeText(state.note)}` : '') +
      (setupLine ? `\n${setupLine}` : '');
    return {
      id: STATE_ID,
      cacheKey,
      mode: 'snapshot',
      tagName: 'factory-environment',
      contents,
      value: { environment: state },
      attributes: { workingDirectory: only?.dir ?? state.workingDirectory, repositories: state.repositories.length },
      metadata: { value: { environment: state } },
    };
  }
}
