import type { AgentController, Session } from '@mastra/core/agent-controller';
import type { LeaseProvider } from '@mastra/core/events';

import { notificationDispatchLeaseKey } from './signals-pubsub.js';

/** A session here serves the thread's resource, but the thread belongs to another project. */
export const FOREIGN_THREAD = Symbol('foreign-thread');

/** The session a wake runs as, and the dispatch lease that covers the thread. */
export type WakeSession<TState> = {
  session: Session<TState>;
  /**
   * The thread's scope (`threadScopeKey`) when it carries the session's whole
   * scope: only the process holding that scope's dispatch lease delivers it.
   * Unset for a thread with no scope, which the resource's lease covers.
   */
  scope?: string;
};

/** A stable key for a session's thread scope, or `undefined` when it has none. */
export function threadScopeKey(scope: Record<string, string>): string | undefined {
  const entries = Object.entries(scope).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return entries.length > 0 ? JSON.stringify(entries) : undefined;
}

/**
 * The session a wake for `threadId` should run as, or `FOREIGN_THREAD` when
 * this process serves the resource but not the thread.
 *
 * A resource is not a project: processes in different directories can share
 * one resource id (to share recall, say), and each then has a live session for
 * it. Picking by resource alone runs the thread in whichever process asked,
 * with that process's workspace, tools and cwd. The thread's scope tags (the
 * ones `thread.create()` stamps, such as `projectPath`) say which session it
 * belongs to. A thread with no scope tags, or with tags no session here
 * contradicts, keeps going to the resource's session.
 *
 * A session that has the thread open always owns it. When the thread belongs to
 * another project, that session delivers it under a lease for this one thread
 * (`openThreadScope`), and the thread's own project yields it while another
 * process holds that lease (`leases`), so only one process runs it and the
 * project's other threads stay with the project.
 */
export async function findWakeSession<TState>(
  controller: Pick<AgentController<TState>, 'getSession'>,
  liveSessions: Iterable<Session<TState>>,
  { resourceId, threadId }: { resourceId: string; threadId: string },
  leases?: Pick<LeaseProvider, 'getLeaseOwner'>,
): Promise<WakeSession<TState> | typeof FOREIGN_THREAD | undefined> {
  // Factory sessions are addressed by their thread id, Mastra Code sessions by their resource id.
  let first: Session<TState> | undefined;
  for (const sessionId of new Set([threadId, resourceId])) {
    const session = await controller.getSession(sessionId);
    if (session?.identity.getResourceId() === resourceId) {
      first = session;
      break;
    }
  }
  if (!first) return undefined;
  const thread = await first.thread.getById({ threadId });
  if (!thread || thread.resourceId !== resourceId) return { session: first };
  const metadata = (thread.metadata as Record<string, unknown> | undefined) ?? {};
  const candidates = [
    first,
    ...[...liveSessions].filter(session => session !== first && session.identity.getResourceId() === resourceId),
  ];
  const matchesScope = (session: Session<TState>) =>
    Object.entries(session.getThreadScope()).every(
      ([key, value]) => metadata[key] === undefined || metadata[key] === value,
    );
  const open = candidates.find(session => session.thread.getId() === threadId);
  if (open) {
    return { session: open, scope: matchesScope(open) ? threadLeaseScope(open, metadata) : openThreadScope(threadId) };
  }
  const owner = candidates.find(matchesScope);
  if (!owner) return FOREIGN_THREAD;
  const scope = threadLeaseScope(owner, metadata);
  if (
    scope !== undefined &&
    (await leases?.getLeaseOwner(notificationDispatchLeaseKey(resourceId, openThreadScope(threadId))))
  ) {
    return FOREIGN_THREAD;
  }
  return { session: owner, scope };
}

/**
 * The dispatch lease scopes a session needs: its own, plus a lease for its open
 * thread alone when that thread belongs to another project (`findWakeSession`).
 */
export async function sessionLeaseScopes<TState>(session: Session<TState>): Promise<Array<string | undefined>> {
  const own = threadScopeKey(session.getThreadScope());
  const threadId = session.thread.getId();
  if (!threadId) return [own];
  const thread = await session.thread.getById({ threadId });
  if (!thread || thread.resourceId !== session.identity.getResourceId()) return [own];
  const metadata = (thread.metadata as Record<string, unknown> | undefined) ?? {};
  const foreign = Object.entries(session.getThreadScope()).some(
    ([key, value]) => metadata[key] !== undefined && metadata[key] !== value,
  );
  return foreign ? [own, openThreadScope(threadId)] : [own];
}

/** The lease scope for one thread a session has open from another project. */
function openThreadScope(threadId: string): string {
  return threadScopeKey({ openThread: threadId })!;
}

/**
 * The lease scope covering a thread for `session`: the thread's own values for
 * the session's scope keys, or unset when the thread lacks any of them.
 */
function threadLeaseScope<TState>(
  session: Session<TState>,
  metadata: Record<string, unknown> = {},
): string | undefined {
  const keys = Object.keys(session.getThreadScope());
  if (!keys.every(key => metadata[key] !== undefined)) return undefined;
  return threadScopeKey(Object.fromEntries(keys.map(key => [key, String(metadata[key])])));
}
