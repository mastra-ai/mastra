import { createHash } from 'node:crypto';
import type { ComputeStateSignalArgs, ComputeStateSignalResult, Processor } from '@mastra/core/processors';

import { getFactorySessionCoordinates } from '../rules/binding-context.js';

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
}

export interface SessionEnvironmentState {
  /** The workspace root, the session's working directory; repositories sit beneath it. */
  workingDirectory: string;
  repositories: SessionEnvironmentRepositoryState[];
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
    const address = getFactorySessionCoordinates(args.requestContext);
    if (!address) return;
    const state = environments.get(address.sessionId)?.state;
    if (!state) return;
    const cacheKey = environmentCacheKey(state);
    const hasBase = Boolean(args.lastSnapshot) && args.contextWindow.hasSnapshot;
    if (hasBase && (args.tracking?.currentCacheKey ?? args.lastSnapshot?.metadata?.state?.cacheKey) === cacheKey)
      return;
    const lines = state.repositories.map(
      repo =>
        `${repo.position}. ${escapeText(repo.slug)} at ${escapeText(repo.dir)} on ${escapeText(repo.branch ?? '(detached)')} (default ${escapeText(repo.defaultBranch)}, setup ${repo.setupStatus})`,
    );
    const contents =
      `Factory environment: ${state.repositories.length} repositories under ${escapeText(state.workingDirectory)}, your working directory.\n` +
      lines.join('\n') +
      '\nRun git and project commands inside the repository directory they belong to.';
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
