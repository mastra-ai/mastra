import type { StorageThreadType } from '@mastra/core/memory';
import type { MemoryStorage } from '@mastra/core/storage';

import { externallyAuthoredWorkItem } from '../rules/types.js';
import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import type { WorkItemRow } from '../storage/domains/work-items/base.js';
import { sessionStampCounts } from './session-threads.js';

/** Slack-started sessions live on a `slack/<thread>` branch (see `threadBranch` in the Slack integration). */
const SLACK_SESSION_BRANCH_PREFIX = 'slack/';

/**
 * Set on a thread while it moves and turned off once the move, vectors included, is done. A
 * crash in between leaves the thread moved in storage but no longer listed under its
 * session id, so the next start finds it by this flag and its session stamp and finishes the move.
 */
const MOVE_PENDING_KEY = 'factoryResourceMovePending';
/** How often a long resource migration reports how far it got. */
const PROGRESS_LOG_INTERVAL_MS = 10_000;

export interface SessionResourceMigrationDeps {
  sessions: {
    listSessionsAwaitingResourceMigration(): Promise<SourceControlSession[]>;
    markResourcesMigrated(sessionId: string): Promise<void>;
  };
  workItems: {
    listRunBoundItems(sessionId: string): Promise<(Pick<WorkItemRow, 'externalSource' | 'metadata'> | null)[]>;
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
  /**
   * Moved sessions whose subscriptions couldn't move because the integrations
   * domain wasn't ready; left unmarked so a later startup moves them.
   */
  subscriptionsPending: string[];
  threads: number;
  runBindings: number;
  subscriptions: number;
  /** Moved sessions whose resource-scoped observational memory stays under their old resource. */
  resourceObservationsLeft: string[];
}

/**
 * The memory resource a session belongs to: its Factory for runs, side
 * sessions and Slack channel threads, its owner for sessions a person opened,
 * private side sessions and Slack DMs. A run on untrusted content (a pull request, or a card
 * written outside the write-access circle) keeps its own resource, like a new
 * run would; so does a run whose work item no longer loads, since nothing then
 * shows its content was trusted. `null` when a Factory-owned session has no
 * Factory recorded — guessing would merge it into the wrong resource.
 */
export function sessionMemoryResource(
  session: SourceControlSession,
  boundItems: (Pick<WorkItemRow, 'externalSource' | 'metadata'> | null)[],
): { owner: 'factory' | 'user' | 'isolated'; resourceId: string | null } {
  if (boundItems.some(item => item === null || untrustedWorkItem(item))) {
    return { owner: 'isolated', resourceId: session.sessionId };
  }
  // A Slack DM or private side session is its owner's, so it belongs with their own sessions.
  const sharedWithOrg =
    session.visibility !== 'private' &&
    (session.originSessionId !== null || session.branch.startsWith(SLACK_SESSION_BRANCH_PREFIX));
  const factoryOwned = boundItems.length > 0 || sharedWithOrg;
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
 * a rerun is a no-op and a crash leaves a state the next run resumes from. A
 * session is marked once moved, so later starts only read sessions that are not
 * (new sessions are created marked).
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
    subscriptionsPending: [],
    threads: 0,
    runBindings: 0,
    subscriptions: 0,
    resourceObservationsLeft: [],
  };
  const sessions = await deps.sessions.listSessionsAwaitingResourceMigration();
  // This pass can take minutes against a remote database, so say what it is doing and
  // how far it got.
  if (sessions.length > 0) {
    console.info(`[factory] session resource migration: moving ${sessions.length} sessions in the background`);
  }
  let lastProgressAt = Date.now();

  for (const session of sessions) {
    report.sessions += 1;
    const { sessionId } = session;
    try {
      const { owner, resourceId } = sessionMemoryResource(session, await deps.workItems.listRunBoundItems(sessionId));
      if (!resourceId) {
        report.skipped.push(sessionId);
        continue;
      }
      if (owner === 'factory') report.factorySessions += 1;
      else if (owner === 'isolated') report.isolatedSessions += 1;
      else report.userSessions += 1;
      if (resourceId === sessionId) {
        await deps.sessions.markResourcesMigrated(sessionId);
        continue;
      }

      // Finish moves a crash interrupted after storage moved the thread.
      const { threads: interrupted } = await deps.memory.listThreads({
        filter: { resourceId, metadata: { factorySessionId: sessionId, [MOVE_PENDING_KEY]: true } },
        perPage: false,
      });
      for (const thread of interrupted) {
        if (thread.resourceId === sessionId) continue; // listed under the session id below
        await moveThread(deps, thread, thread.resourceId);
        report.threads += 1;
      }
      const { threads } = await deps.memory.listThreads({ filter: { resourceId: sessionId }, perPage: false });
      // A private session's stamps don't count under its Factory, so only its own
      // thread moves there; its other threads stay listed under its id.
      const stampsCount = sessionStampCounts(session, resourceId);
      for (const thread of threads) {
        if (!stampsCount && thread.id !== sessionId) continue;
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
      if (!deps.integrations) {
        report.subscriptionsPending.push(sessionId);
        continue;
      }
      await deps.sessions.markResourcesMigrated(sessionId);
    } catch (error) {
      report.failed.push(sessionId);
      console.warn(
        `[factory] session resource migration: session ${sessionId} not moved: ${error instanceof Error ? error.message : error}`,
      );
    } finally {
      if (report.sessions < sessions.length && Date.now() - lastProgressAt >= PROGRESS_LOG_INTERVAL_MS) {
        lastProgressAt = Date.now();
        console.info(
          `[factory] session resource migration: ${report.sessions}/${sessions.length} sessions checked, ` +
            `${report.threads} threads moved`,
        );
      }
    }
  }

  if (
    report.threads +
      report.runBindings +
      report.subscriptions +
      report.skipped.length +
      report.failed.length +
      report.subscriptionsPending.length >
    0
  ) {
    console.info(
      `[factory] session resource migration: ${report.threads} threads, ${report.runBindings} run bindings, ` +
        `${report.subscriptions} subscriptions moved; ${report.skipped.length} Factory sessions without a Factory skipped; ` +
        `${report.failed.length} sessions failed; ${report.subscriptionsPending.length} sessions wait for integrations ` +
        `to move their subscriptions`,
    );
  }
  return report;
}

export interface SessionVisibilityBackfillDeps {
  sessions: {
    listSessionsAwaitingVisibilityCheck(): Promise<SourceControlSession[]>;
    markVisibilityChecked(sessionId: string, options: { makePrivate: boolean }): Promise<void>;
  };
  workItems: Pick<SessionResourceMigrationDeps['workItems'], 'listRunBoundItems'>;
  memory: Pick<MemoryStorage, 'getThreadById'>;
}

/**
 * Mark shared user sessions private when their conversation lives on their owner's resource.
 * The resource already keeps teammates out of such a session; this makes lists agree, so they
 * stop seeing a session they can't open. Sessions shared onto their Factory, runs, Slack threads
 * and side sessions are left alone. Each session is checked once: new sessions start checked,
 * and a session that throws stays unchecked so the next start retries it.
 */
export async function privatizeOwnerResourceSessions(deps: SessionVisibilityBackfillDeps): Promise<number> {
  let privatized = 0;
  for (const session of await deps.sessions.listSessionsAwaitingVisibilityCheck()) {
    try {
      let makePrivate = false;
      if (session.visibility !== 'private') {
        const { owner } = sessionMemoryResource(session, await deps.workItems.listRunBoundItems(session.sessionId));
        const thread = owner === 'user' ? await deps.memory.getThreadById({ threadId: session.sessionId }) : null;
        makePrivate = thread?.resourceId === session.userId;
      }
      await deps.sessions.markVisibilityChecked(session.sessionId, { makePrivate });
      if (makePrivate) privatized += 1;
    } catch (error) {
      console.warn(
        `[factory] session visibility check: session ${session.sessionId} not checked: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
  if (privatized > 0) {
    console.info(`[factory] session visibility check: ${privatized} sessions on their owner's memory made private`);
  }
  return privatized;
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
