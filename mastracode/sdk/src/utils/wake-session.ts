import type { AgentController, Session } from '@mastra/core/agent-controller';

/** A session here serves the thread's resource, but the thread belongs to another project. */
export const FOREIGN_THREAD = Symbol('foreign-thread');

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
 */
export async function findWakeSession<TState>(
  controller: Pick<AgentController<TState>, 'getSessionByResource'>,
  liveSessions: Iterable<Session<TState>>,
  { resourceId, threadId }: { resourceId: string; threadId: string },
): Promise<Session<TState> | typeof FOREIGN_THREAD | undefined> {
  const first = await controller.getSessionByResource(resourceId);
  if (!first) return undefined;
  const thread = await first.thread.getById({ threadId });
  if (!thread || thread.resourceId !== resourceId) return first;
  const metadata = (thread.metadata as Record<string, unknown> | undefined) ?? {};
  const owns = (session: Session<TState>) =>
    Object.entries(session.getThreadScope()).every(
      ([key, value]) => metadata[key] === undefined || metadata[key] === value,
    );
  if (owns(first)) return first;
  for (const session of liveSessions) {
    if (session !== first && session.identity.getResourceId() === resourceId && owns(session)) return session;
  }
  return FOREIGN_THREAD;
}
