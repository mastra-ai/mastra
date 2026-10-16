import type { AgentController, AgentControllerThread } from '@mastra/core/agent-controller';

/**
 * The threads of one Factory session. Sessions share their Factory's or user's
 * resource, so listing by resource would return every session's threads. A
 * session's own thread carries its id, threads it opens are stamped with
 * `factorySessionId`, and a session created before resources were shared keeps
 * its threads under its own id as the resource.
 */
export async function listFactorySessionThreads(
  controller: Pick<AgentController<any>, 'queryThreads' | 'queryThreadById'>,
  sessionId: string,
): Promise<AgentControllerThread[]> {
  const [own, stamped, legacy] = await Promise.all([
    controller.queryThreadById({ threadId: sessionId }),
    controller.queryThreads({ metadata: { factorySessionId: sessionId } }),
    controller.queryThreads({ resourceId: sessionId }),
  ]);
  const threads = new Map<string, AgentControllerThread>();
  for (const thread of [...(own ? [own] : []), ...stamped, ...legacy]) threads.set(thread.id, thread);
  return [...threads.values()];
}

/**
 * The memory resource a Factory session runs under. Its thread already records
 * it (the Factory for runs and Slack sessions, the owner for user sessions, the
 * session's own id for sessions not yet migrated). A session with no thread
 * yet is a new user session, which starts under its owner.
 */
export async function factorySessionResourceId(
  controller: Pick<AgentController<any>, 'queryThreadById'> | undefined,
  session: { sessionId: string; userId: string },
): Promise<string> {
  const thread = await controller?.queryThreadById({ threadId: session.sessionId });
  return thread?.resourceId || session.userId;
}
