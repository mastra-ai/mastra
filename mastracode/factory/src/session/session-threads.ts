import type { AgentController, AgentControllerThread } from '@mastra/core/agent-controller';

import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';

/** The Factory session row fields that say which memory resource it uses. */
export interface FactorySessionOwnership {
  sessionId: string;
  userId: string;
  orgId?: string;
  factoryProjectId?: string | null;
  branch?: string;
  visibility?: string;
  originSessionId?: string | null;
}

/** Run bindings: the server-side record that a session runs work for its Factory. */
export type SessionRunBindings = Pick<WorkItemsStorage, 'hasRunBindingForSession'>;

type ThreadLookup = Pick<AgentController<any>, 'queryThreadById'>;

/**
 * The one memory resource a Factory session runs under. A Slack session uses
 * its Factory's, or its sender's for a DM; a side session uses its Factory's,
 * or its owner's when private; any other session uses its owner's. A session's own thread can say otherwise
 * only within what the server recorded for it: its own id (created before
 * resources were shared, or a run kept on its own resource), and the Factory's
 * only for a session with a run binding. A client can create a thread under the
 * session's id, so the thread alone never makes a session the Factory's.
 */
export async function sessionMemoryResourceId(
  controller: ThreadLookup | undefined,
  session: FactorySessionOwnership,
  runs: SessionRunBindings | undefined,
): Promise<string> {
  const [own, runBound] = await Promise.all([
    controller?.queryThreadById({ threadId: session.sessionId }),
    isRunBound(session, runs),
  ]);
  return memoryResourceOf(session, own, runBound);
}

export async function isRunBound(session: FactorySessionOwnership, runs: SessionRunBindings | undefined) {
  if (!runs || !session.orgId || !session.factoryProjectId) return false;
  return runs.hasRunBindingForSession({
    orgId: session.orgId,
    factoryProjectId: session.factoryProjectId,
    sessionId: session.sessionId,
  });
}

/** {@link sessionMemoryResourceId} for a caller that already loaded the session's own thread. */
export function memoryResourceOf(
  session: FactorySessionOwnership,
  own: { resourceId?: string | null } | null | undefined,
  runBound: boolean,
) {
  const factoryProjectId = session.factoryProjectId ?? undefined;
  const slack = session.branch?.startsWith('slack/') ?? false;
  // A private Slack DM or side session stays with its owner.
  const shared =
    slack || session.originSessionId
      ? session.visibility === 'private'
        ? session.userId
        : factoryProjectId
      : undefined;
  if (shared) {
    if (own?.resourceId && [session.sessionId, shared].includes(own.resourceId)) return own.resourceId;
    return shared;
  }
  // A session a person started runs on their resource while private and its
  // Factory's once its owner shares it, which moves its threads there. Its own
  // thread says where it is; a client cannot make a private session the
  // Factory's by writing that thread, since the Factory is only allowed for a
  // shared or run-bound session.
  const allowed = [
    session.sessionId,
    session.userId,
    ...((runBound || session.visibility === 'org') && factoryProjectId ? [factoryProjectId] : []),
  ];
  if (own?.resourceId && allowed.includes(own.resourceId)) return own.resourceId;
  return session.userId;
}

/** The resource a person's session belongs on for a visibility: its Factory's once shared, its owner's while private. */
export function userSessionResourceFor(
  session: Pick<FactorySessionOwnership, 'userId' | 'factoryProjectId'>,
  visibility: 'org' | 'private',
): string {
  return visibility === 'org' && session.factoryProjectId ? session.factoryProjectId : session.userId;
}

/**
 * The threads to move when a person's session changes visibility and so moves
 * onto `resourceId`: its own thread and the threads stamped with its id that
 * sit on its owner's or Factory's resource. Threads under the session's own id
 * (from before resources were shared) stay where they are.
 */
export async function sessionThreadsToMove(
  controller: Pick<AgentController<any>, 'queryThreads' | 'queryThreadById'>,
  session: FactorySessionOwnership,
  resourceId: string,
): Promise<string[]> {
  const movable = new Set([session.userId, ...(session.factoryProjectId ? [session.factoryProjectId] : [])]);
  const [own, stamped] = await Promise.all([
    controller.queryThreadById({ threadId: session.sessionId }),
    controller.queryThreads({ metadata: { factorySessionId: session.sessionId } }),
  ]);
  const threads = [...(own ? [own] : []), ...stamped].filter(
    thread => thread.resourceId !== resourceId && movable.has(thread.resourceId),
  );
  return [...new Set(threads.map(thread => thread.id))];
}

/**
 * Whether a `factorySessionId` stamp naming this session counts on a thread
 * under `resourceId`. Any org member can write a stamped thread under the
 * Factory's resource, so a private session's stamp never counts there: only
 * its own thread (`thread.id === sessionId`) does.
 */
export function sessionStampCounts(session: FactorySessionOwnership, resourceId: string | null | undefined): boolean {
  return !(session.visibility === 'private' && !!session.factoryProjectId && resourceId === session.factoryProjectId);
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
  runs: SessionRunBindings | undefined,
): Promise<AgentControllerThread[]> {
  const { sessionId } = session;
  const [own, runBound, stamped, legacy] = await Promise.all([
    controller.queryThreadById({ threadId: sessionId }),
    isRunBound(session, runs),
    controller.queryThreads({ metadata: { factorySessionId: sessionId } }),
    controller.queryThreads({ resourceId: sessionId }),
  ]);
  const resourceId = memoryResourceOf(session, own, runBound);
  const threads = new Map<string, AgentControllerThread>();
  const owned = [
    ...(own?.resourceId === resourceId ? [own] : []),
    ...(sessionStampCounts(session, resourceId) ? stamped.filter(thread => thread.resourceId === resourceId) : []),
  ];
  for (const thread of [...owned, ...legacy]) threads.set(thread.id, thread);
  return [...threads.values()];
}
