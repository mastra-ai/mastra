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
