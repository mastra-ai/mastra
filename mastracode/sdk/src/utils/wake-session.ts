import type { AgentController, Session } from '@mastra/core/agent-controller';

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
 * contradicts, keeps going to the resource's session. A session that has the
 * thread open always owns it.
 */
export async function findWakeSession<TState>(
  controller: Pick<AgentController<TState>, 'getSessionByResource'>,
  liveSessions: Iterable<Session<TState>>,
  { resourceId, threadId }: { resourceId: string; threadId: string },
): Promise<WakeSession<TState> | typeof FOREIGN_THREAD | undefined> {
  const first = await controller.getSessionByResource(resourceId);
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
  const owner = candidates.find(session => session.thread.getId() === threadId) ?? candidates.find(matchesScope);
  if (!owner) return FOREIGN_THREAD;
  return { session: owner, scope: threadLeaseScope(owner, metadata) };
}

/**
 * The dispatch lease scopes a session needs: its own, plus the open thread's
 * when that thread was created in another project. A session with another
 * project's thread open runs its wakes (`findWakeSession`), so it competes for
 * that project's lease with the project's own processes, and only the holder
 * delivers.
 */
export async function sessionLeaseScopes<TState>(session: Session<TState>): Promise<Array<string | undefined>> {
  const own = threadScopeKey(session.getThreadScope());
  const threadId = session.thread.getId();
  if (!threadId) return [own];
  const thread = await session.thread.getById({ threadId });
  if (!thread || thread.resourceId !== session.identity.getResourceId()) return [own];
  const open = threadLeaseScope(session, thread.metadata as Record<string, unknown> | undefined);
  return open === undefined || open === own ? [own] : [own, open];
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
