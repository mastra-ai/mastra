import type { MemoryStorage } from '@mastra/core/storage';

import type { SourceControlSession } from '../storage/domains/source-control/base.js';

/** Slack-started sessions live on a `slack/<thread>` branch (see `threadBranch` in the Slack integration). */
const SLACK_SESSION_BRANCH_PREFIX = 'slack/';

export interface SessionResourceMigrationDeps {
  sessions: { listAllSessions(): Promise<SourceControlSession[]> };
  workItems: {
    listRunBoundSessionIds(): Promise<Set<string>>;
    moveRunBindingsToResource(input: { sessionId: string; resourceId: string }): Promise<number>;
  };
  /** Absent when the integrations domain is not ready; subscriptions then stay where they are. */
  integrations?: {
    moveSubscriptionsToResource(input: { fromResourceId: string; toResourceId: string }): Promise<number>;
  };
  memory: Pick<MemoryStorage, 'listThreads' | 'patchThread' | 'updateThreadResourceId'>;
}

export interface SessionResourceMigrationReport {
  sessions: number;
  factorySessions: number;
  userSessions: number;
  /** Factory-owned sessions with no Factory to move them onto; left untouched. */
  skipped: string[];
  /** Sessions whose move threw; the next startup retries them. */
  failed: string[];
  threads: number;
  runBindings: number;
  subscriptions: number;
}

/**
 * The memory resource a session belongs to: its Factory for runs, side
 * sessions and Slack sessions, its owner for sessions a person opened. `null` when a
 * Factory-owned session has no Factory recorded — guessing would merge it
 * into the wrong resource.
 */
export function sessionMemoryResource(
  session: SourceControlSession,
  runBound: boolean,
): { owner: 'factory' | 'user'; resourceId: string | null } {
  const factoryOwned =
    runBound || session.originSessionId !== null || session.branch.startsWith(SLACK_SESSION_BRANCH_PREFIX);
  return factoryOwned
    ? { owner: 'factory', resourceId: session.factoryProjectId }
    : { owner: 'user', resourceId: session.userId };
}

/**
 * Move sessions stored under the legacy `resourceId = sessionId` onto their
 * Factory or user resource. Threads keep their id (`threadId === sessionId`)
 * and get `factorySessionId` so per-session listings still find them.
 *
 * Every write only touches values still equal to the session id, so a rerun
 * is a no-op and a crash leaves a state the next run resumes from. Nothing
 * is deleted. Records keyed by the old resource are left in place: thread-
 * scoped observational memory is keyed by thread id and moves with the
 * thread; resource-scoped records written under `resource:<sessionId>`
 * stay under that key and are no longer read.
 */
export async function migrateSessionResources(
  deps: SessionResourceMigrationDeps,
): Promise<SessionResourceMigrationReport> {
  const report: SessionResourceMigrationReport = {
    sessions: 0,
    factorySessions: 0,
    userSessions: 0,
    skipped: [],
    failed: [],
    threads: 0,
    runBindings: 0,
    subscriptions: 0,
  };
  const [sessions, runBound] = await Promise.all([
    deps.sessions.listAllSessions(),
    deps.workItems.listRunBoundSessionIds(),
  ]);

  for (const session of sessions) {
    report.sessions += 1;
    const { sessionId } = session;
    const { owner, resourceId } = sessionMemoryResource(session, runBound.has(sessionId));
    if (!resourceId) {
      report.skipped.push(sessionId);
      continue;
    }
    if (owner === 'factory') report.factorySessions += 1;
    else report.userSessions += 1;
    if (resourceId === sessionId) continue;

    try {
      const { threads } = await deps.memory.listThreads({ filter: { resourceId: sessionId }, perPage: false });
      for (const thread of threads) {
        // Tag before moving: once moved, the thread is no longer found under the session id.
        if (thread.metadata?.factorySessionId !== sessionId) {
          await deps.memory.patchThread({
            id: thread.id,
            metadata: { ...thread.metadata, factorySessionId: sessionId },
          });
        }
        await deps.memory.updateThreadResourceId({ threadId: thread.id, resourceId });
        report.threads += 1;
      }
      report.runBindings += await deps.workItems.moveRunBindingsToResource({ sessionId, resourceId });
      if (deps.integrations) {
        report.subscriptions += await deps.integrations.moveSubscriptionsToResource({
          fromResourceId: sessionId,
          toResourceId: resourceId,
        });
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
