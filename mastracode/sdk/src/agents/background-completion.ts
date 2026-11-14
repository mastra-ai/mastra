import type { Session } from '@mastra/core/agent-controller';
import type { BackgroundTask, BackgroundTaskManagerConfig } from '@mastra/core/background-tasks';
import type { RequestContext } from '@mastra/core/request-context';
import type { BackgroundCompletionEvents, BackgroundTaskCompletionEvent } from './background-completion-events.js';

interface BackgroundCompletionRouter<TState = unknown> {
  getSession(sessionId: string): Promise<Session<TState> | undefined>;
  /** Live sessions to search when no session is addressed by the thread or resource id. */
  listLiveSessions?(): Iterable<Session<TState>>;
}

export type BackgroundNoticeSignal = Parameters<Session['sendSignalToThread']>[0];

export interface BackgroundNoticeTarget {
  resourceId: string;
  threadId: string;
}

/**
 * Find the live session a thread runs in. Factory sessions are addressed by
 * their thread id; Mastra Code sessions by their resource id, or, after
 * switching resources, by being the live session on that thread. Only a
 * session working on the same resource qualifies, so a thread is never run by
 * a session of another resource.
 */
export async function findSessionForThread<TState>(
  controller: BackgroundCompletionRouter<TState>,
  { resourceId, threadId }: { resourceId: string; threadId: string },
): Promise<Session<TState> | undefined> {
  for (const sessionId of new Set([threadId, resourceId])) {
    const session = await controller.getSession(sessionId);
    if (session?.identity.getResourceId() === resourceId) return session;
  }
  // A session that switched resources stays registered under its original id;
  // only one working on the task's own thread qualifies, never a neighbour on a
  // shared resource.
  for (const session of controller.listLiveSessions?.() ?? []) {
    if (session.identity.getResourceId() === resourceId && session.thread.getId() === threadId) return session;
  }
  return undefined;
}

// Shells can exit while no session runs their thread's resource (a host that
// opens sessions on demand); past this many held notices, the oldest are dropped.
const MAX_HELD_NOTICES = 100;

export interface BackgroundNoticeDelivery {
  /**
   * Wakes the agent when the notice's thread is the session's current thread,
   * and persists it to the thread otherwise. Holds it while no session runs
   * the thread's resource yet.
   */
  deliver(target: BackgroundNoticeTarget, signal: BackgroundNoticeSignal): Promise<void>;
  /** Retries the held notices. Call when a session is created. */
  flush(): Promise<void>;
}

type HeldNotice = { target: BackgroundNoticeTarget; signal: BackgroundNoticeSignal };

export interface BackgroundNoticeDeliveryHooks {
  /**
   * Where the notice goes now, read on every attempt, a held notice's replay included: for hosts that move threads
   * between resources after the work started. Default: the target the notice was delivered with.
   */
  resolveTarget?(target: BackgroundNoticeTarget): Promise<BackgroundNoticeTarget>;
  /**
   * Finds the live session that runs the notice's thread. Default: {@link findSessionForThread}. Undefined holds
   * the notice until a session runs the thread; null drops it, for a thread no session will ever run.
   */
  resolveSession?(target: BackgroundNoticeTarget): Promise<Session | null | undefined>;
  /**
   * The request context a woken run uses, for hosts whose runs need an identity the session doesn't carry.
   * Undefined saves the notice to the thread instead of waking it.
   */
  wakeRequestContext?(session: Session, target: BackgroundNoticeTarget): Promise<RequestContext | undefined>;
}

export function createBackgroundNoticeDelivery(
  getRouter: () => BackgroundCompletionRouter,
  hooks: BackgroundNoticeDeliveryHooks = {},
): BackgroundNoticeDelivery {
  const held: HeldNotice[] = [];
  const hold = (notice: HeldNotice) => {
    held.push(notice);
    if (held.length > MAX_HELD_NOTICES) held.shift();
  };

  const send = async (notice: HeldNotice): Promise<boolean> => {
    const { signal } = notice;
    const target = hooks.resolveTarget ? await hooks.resolveTarget(notice.target) : notice.target;
    const session = hooks.resolveSession
      ? await hooks.resolveSession(target)
      : await findSessionForThread(getRouter(), target);
    // Dropped: nothing will ever take it, so holding it would only push out notices that can be delivered.
    if (session === null) return true;
    if (!session) return false;
    if (session.thread.getId() === target.threadId) {
      const requestContext = hooks.wakeRequestContext ? await hooks.wakeRequestContext(session, target) : undefined;
      // `sendSignal` goes to whatever thread the session is on, which can change while the hook runs.
      const stillOnThread = session.thread.getId() === target.threadId;
      const woken =
        (hooks.wakeRequestContext && !requestContext) || !stillOnThread
          ? undefined
          : await session
              .sendSignal(signal, { ifIdle: { behavior: 'wake' }, requireDelivery: true, requestContext })
              .accepted.catch(() => undefined);
      // A wake that could not start or that the thread refused never reached the
      // thread. Save the notice instead; it has the event's id, so it is saved once.
      if (woken && woken.action !== 'blocked' && woken.action !== 'discard') return true;
    }
    await session.sendSignalToThread(signal, target).accepted;
    return true;
  };

  return {
    async deliver(target, signal) {
      const notice = { target, signal };
      let sent: boolean;
      try {
        sent = await send(notice);
      } catch (error) {
        // A later session retries it, as `flush` does for notices held earlier.
        hold(notice);
        throw error;
      }
      if (!sent) hold(notice);
    },
    async flush() {
      for (const notice of held.splice(0)) {
        // A failed send (for example storage not ready yet) is retried on the
        // next session, within the cap.
        const sent = await send(notice).catch(() => false);
        if (!sent) hold(notice);
      }
    },
  };
}

async function persistBackgroundCompletion(
  controller: BackgroundCompletionRouter,
  task: BackgroundTask,
  status: 'completed' | 'failed' | 'cancelled',
): Promise<void> {
  if (!task.resourceId || !task.threadId) return;

  const session = await findSessionForThread(controller, { resourceId: task.resourceId, threadId: task.threadId });
  if (!session) return;

  const eventId = `background-task:${task.id}:${status}`;
  await session.sendSignalToThread(
    {
      id: eventId,
      type: 'notification',
      tagName: 'notification',
      contents: `${task.toolName} ${status} in background`,
      attributes: {
        source: 'background-work',
        kind: `background-task-${status}`,
        priority: status === 'failed' ? 'high' : 'low',
        status,
      },
      metadata: {
        backgroundCompletion: {
          eventId,
          taskId: task.id,
          originRunId: task.runId,
          originToolCallId: task.toolCallId,
          toolName: task.toolName,
          status,
        },
      },
    },
    { resourceId: task.resourceId, threadId: task.threadId },
  ).accepted;
}

export function createBackgroundCompletionCallbacks(
  getController: () => BackgroundCompletionRouter,
  events?: BackgroundCompletionEvents,
): Pick<BackgroundTaskManagerConfig, 'onTaskComplete' | 'onTaskFailed' | 'onTaskCancelled'> {
  const deliver = async (task: BackgroundTask, status: 'completed' | 'failed' | 'cancelled') => {
    if (!task.resourceId || !task.threadId) return;
    const event: BackgroundTaskCompletionEvent = {
      kind: 'task',
      id: `background-task:${task.id}:${status}`,
      taskId: task.id,
      originRunId: task.runId,
      originToolCallId: task.toolCallId,
      resourceId: task.resourceId,
      threadId: task.threadId,
      toolName: task.toolName,
      status,
    };
    try {
      await persistBackgroundCompletion(getController(), task, status);
    } finally {
      events?.publish(event);
    }
  };

  return {
    onTaskComplete: task => deliver(task, 'completed'),
    onTaskFailed: task => deliver(task, 'failed'),
    onTaskCancelled: task => deliver(task, 'cancelled'),
  };
}
