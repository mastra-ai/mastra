import type { StorageThreadType } from '@mastra/core/memory';
import type { MemoryStorage } from '@mastra/core/storage';

import { externallyAuthoredWorkItem } from '../rules/types.js';
import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import type { WorkItemRow } from '../storage/domains/work-items/base.js';

/** Slack-started sessions live on a `slack/<thread>` branch (see `threadBranch` in the Slack integration). */
const SLACK_SESSION_BRANCH_PREFIX = 'slack/';

/**
 * Set on a thread while it moves and turned off once the move, vectors included, is done. A
 * crash in between leaves the thread moved in storage but no longer listed under its
 * session id, so the next start finds it by this flag and finishes the move.
 */
const MOVE_PENDING_KEY = 'factoryResourceMovePending';

export interface SessionResourceMigrationDeps {
  sessions: { listAllSessions(): Promise<SourceControlSession[]> };
  workItems: {
    listRunBoundSessions(): Promise<Map<string, Pick<WorkItemRow, 'externalSource' | 'metadata'>[]>>;
    moveRunBindingsToResource(input: { sessionId: string; resourceId: string }): Promise<number>;
  };
  /** Absent when the integrations domain is not ready; subscriptions then stay where they are. */
  integrations?: {
    moveSubscriptionsToResource(input: { fromResourceId: string; toResourceId: string }): Promise<number>;
  };
  memory: Pick<MemoryStorage, 'listThreads' | 'patchThread' | 'getObservationalMemory' | 'supportsObservationalMemory'>;
  /**
   * Moves a thread with everything keyed by its resource, such as observation vectors. Pass the
   * sessions' `Memory`; the bare memory store only moves the thread and its messages.
   */
  threads: { updateThreadResourceId(input: { threadId: string; resourceId: string }): Promise<StorageThreadType> };
}

export interface SessionResourceMigrationReport {
  sessions: number;
  factorySessions: number;
  userSessions: number;
  /** Runs on untrusted content; they keep their own resource. */
  isolatedSessions: number;
  /** Factory-owned sessions with no Factory to move them onto; left untouched. */
  skipped: string[];
  /** Sessions whose move threw; the next startup retries them. */
  failed: string[];
  threads: number;
  runBindings: number;
  subscriptions: number;
  /** Moved sessions whose resource-scoped observational memory stays under their old resource. */
  resourceObservationsLeft: string[];
}

/**
 * The memory resource a session belongs to: its Factory for runs, side
 * sessions and Slack channel threads, its owner for sessions a person opened
 * and for Slack DMs. A run on untrusted content (a pull request, or a card
 * written outside the write-access circle) keeps its own resource, like a new
 * run would. `null` when a Factory-owned session has no Factory recorded —
 * guessing would merge it into the wrong resource.
 */
export function sessionMemoryResource(
  session: SourceControlSession,
  boundItems: Pick<WorkItemRow, 'externalSource' | 'metadata'>[] | undefined,
): { owner: 'factory' | 'user' | 'isolated'; resourceId: string | null } {
  if (boundItems?.some(untrustedWorkItem)) return { owner: 'isolated', resourceId: session.sessionId };
  // A Slack DM is private to its sender, so it belongs with their own sessions.
  const slackChannelThread = session.branch.startsWith(SLACK_SESSION_BRANCH_PREFIX) && session.visibility !== 'private';
  const factoryOwned = boundItems !== undefined || session.originSessionId !== null || slackChannelThread;
  return factoryOwned
    ? { owner: 'factory', resourceId: session.factoryProjectId }
    : { owner: 'user', resourceId: session.userId };
}

function untrustedWorkItem(item: Pick<WorkItemRow, 'externalSource' | 'metadata'>): boolean {
  return item.externalSource?.type === 'pull-request' || externallyAuthoredWorkItem(item);
}

/**
 * Move sessions stored under the legacy `resourceId = sessionId` onto their
 * Factory or user resource. Threads keep their id (`threadId === sessionId`)
 * and get `factorySessionId` so per-session listings still find them.
 *
 * Threads move through the sessions' `Memory`, so their observation vectors
 * follow them and recall search finds their past observations under the new
 * resource. Every write only touches values still equal to the session id, so
 * a rerun is a no-op and a crash leaves a state the next run resumes from.
 * Nothing is deleted. Thread-scoped observational memory is keyed by thread id
 * and keeps working. Resource-scoped observational memory written under
 * `resource:<sessionId>` stays under that key and is no longer read: several
 * sessions merge into one resource, and their records cannot be merged.
 */
export async function migrateSessionResources(
  deps: SessionResourceMigrationDeps,
): Promise<SessionResourceMigrationReport> {
  const report: SessionResourceMigrationReport = {
    sessions: 0,
    factorySessions: 0,
    userSessions: 0,
    isolatedSessions: 0,
    skipped: [],
    failed: [],
    threads: 0,
    runBindings: 0,
    subscriptions: 0,
    resourceObservationsLeft: [],
  };
  // Finish moves a crash interrupted after storage moved the thread.
  const { threads: interrupted } = await deps.memory.listThreads({
    filter: { metadata: { [MOVE_PENDING_KEY]: true } },
    perPage: false,
  });
  for (const thread of interrupted) {
    if (thread.resourceId === thread.metadata?.factorySessionId) continue; // the session loop below moves it
    try {
      await moveThread(deps, thread, thread.resourceId);
      report.threads += 1;
    } catch (error) {
      report.failed.push(String(thread.metadata?.factorySessionId ?? thread.id));
      console.warn(
        `[factory] session resource migration: thread ${thread.id} not finished: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  const [sessions, runBound] = await Promise.all([
    deps.sessions.listAllSessions(),
    deps.workItems.listRunBoundSessions(),
  ]);

  for (const session of sessions) {
    report.sessions += 1;
    const { sessionId } = session;
    const { owner, resourceId } = sessionMemoryResource(session, runBound.get(sessionId));
    if (!resourceId) {
      report.skipped.push(sessionId);
      continue;
    }
    if (owner === 'factory') report.factorySessions += 1;
    else if (owner === 'isolated') report.isolatedSessions += 1;
    else report.userSessions += 1;
    if (resourceId === sessionId) continue;

    try {
      const { threads } = await deps.memory.listThreads({ filter: { resourceId: sessionId }, perPage: false });
      for (const thread of threads) {
        // Tag before moving: once moved, the thread is no longer found under the session id.
        const metadata = { ...thread.metadata, factorySessionId: sessionId, [MOVE_PENDING_KEY]: true };
        await deps.memory.patchThread({ id: thread.id, metadata });
        await moveThread(deps, { ...thread, metadata }, resourceId);
        report.threads += 1;
      }
      report.runBindings += await deps.workItems.moveRunBindingsToResource({ sessionId, resourceId });
      if (deps.integrations) {
        report.subscriptions += await deps.integrations.moveSubscriptionsToResource({
          fromResourceId: sessionId,
          toResourceId: resourceId,
        });
      }
      // Reported once, on the run that moves the session's threads.
      if (
        threads.length > 0 &&
        deps.memory.supportsObservationalMemory &&
        (await deps.memory.getObservationalMemory(null, sessionId))
      ) {
        report.resourceObservationsLeft.push(sessionId);
        console.warn(
          `[factory] session resource migration: session ${sessionId} has resource-scoped observational memory; ` +
            `it stays under resource ${sessionId} and is not carried into ${resourceId}`,
        );
      }
    } catch (error) {
      report.failed.push(sessionId);
      console.warn(
        `[factory] session resource migration: session ${sessionId} not moved: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  if (report.threads + report.runBindings + report.subscriptions + report.skipped.length + report.failed.length > 0) {
    console.info(
      `[factory] session resource migration: ${report.threads} threads, ${report.runBindings} run bindings, ` +
        `${report.subscriptions} subscriptions moved; ${report.skipped.length} Factory sessions without a Factory skipped; ` +
        `${report.failed.length} sessions failed`,
    );
  }
  return report;
}

async function moveThread(
  deps: SessionResourceMigrationDeps,
  thread: StorageThreadType,
  resourceId: string,
): Promise<void> {
  await deps.threads.updateThreadResourceId({ threadId: thread.id, resourceId });
  // Stores merge thread metadata, so the flag is switched off rather than removed.
  await deps.memory.patchThread({ id: thread.id, metadata: { ...thread.metadata, [MOVE_PENDING_KEY]: false } });
}
