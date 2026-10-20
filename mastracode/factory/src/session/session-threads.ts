import type { AgentController, AgentControllerThread } from '@mastra/core/agent-controller';

/** The Factory session row fields that say which memory resource it uses. */
export interface FactorySessionOwnership {
  sessionId: string;
  userId: string;
  factoryProjectId?: string | null;
  branch?: string;
  visibility?: string;
  originSessionId?: string | null;
}

type ThreadLookup = Pick<AgentController<any>, 'queryThreadById'>;

/**
 * The one memory resource a Factory session runs under. A Slack session uses
 * its Factory's, or its sender's for a DM; a side session uses its Factory's;
 * any other session uses its owner's. A session created before resources were
 * shared, or a run kept on its own resource, uses its own id, which its own
 * thread records. A thread a client created under the session's id elsewhere
 * doesn't change that.
 */
export async function sessionMemoryResourceId(controller: ThreadLookup | undefined, session: FactorySessionOwnership) {
  return memoryResourceOf(session, await controller?.queryThreadById({ threadId: session.sessionId }));
}

function memoryResourceOf(session: FactorySessionOwnership, own: { resourceId?: string | null } | null | undefined) {
  const factoryProjectId = session.factoryProjectId ?? undefined;
  const slack = session.branch?.startsWith('slack/') ?? false;
  const shared = slack
    ? session.visibility === 'private'
      ? session.userId
      : factoryProjectId
    : session.originSessionId
      ? factoryProjectId
      : undefined;
  const allowed = shared
    ? [session.sessionId, shared]
    : [session.sessionId, session.userId, ...(factoryProjectId ? [factoryProjectId] : [])];
  if (own?.resourceId && allowed.includes(own.resourceId)) return own.resourceId;
  return shared ?? session.userId;
}

/**
 * The threads of one Factory session. Sessions share their Factory's or user's
 * resource, so listing by resource would return every session's threads. A
 * session's own thread carries its id, threads it opens are stamped with
 * `factorySessionId`, and a session created before resources were shared keeps
 * its threads under its own id as the resource. Thread ids and stamps are
 * client-writable, so the own and stamped threads only count under the
 * session's memory resource.
 */
export async function listFactorySessionThreads(
  controller: Pick<AgentController<any>, 'queryThreads' | 'queryThreadById'>,
  session: FactorySessionOwnership,
): Promise<AgentControllerThread[]> {
  const { sessionId } = session;
  const [own, stamped, legacy] = await Promise.all([
    controller.queryThreadById({ threadId: sessionId }),
    controller.queryThreads({ metadata: { factorySessionId: sessionId } }),
    controller.queryThreads({ resourceId: sessionId }),
  ]);
  const resourceId = memoryResourceOf(session, own);
  const threads = new Map<string, AgentControllerThread>();
  const owned = [...(own ? [own] : []), ...stamped].filter(thread => thread.resourceId === resourceId);
  for (const thread of [...owned, ...legacy]) threads.set(thread.id, thread);
  return [...threads.values()];
}
