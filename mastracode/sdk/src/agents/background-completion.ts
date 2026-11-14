import type { Session } from '@mastra/core/agent-controller';
import type { BackgroundTask, BackgroundTaskManagerConfig } from '@mastra/core/background-tasks';
import type { BackgroundCompletionEvents } from './background-completion-events.js';

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

export interface BackgroundNoticeDeliveryOptions {
  /** False to only persist the notice to its thread, never starting a new turn. Default: true. */
  wake?: boolean;
}

export interface BackgroundNoticeDelivery {
  /**
   * Wakes the agent when the notice's thread is the session's current thread,
   * and persists it to the thread otherwise. Holds it while no session runs
   * the thread's resource yet.
   */
  deliver(
    target: BackgroundNoticeTarget,
    signal: BackgroundNoticeSignal,
    options?: BackgroundNoticeDeliveryOptions,
  ): Promise<void>;
  /** Retries the held notices. Call when a session is created. */
  flush(): Promise<void>;
}

type HeldNotice = { target: BackgroundNoticeTarget; signal: BackgroundNoticeSignal; wake: boolean };

export function createBackgroundNoticeDelivery(getRouter: () => BackgroundCompletionRouter): BackgroundNoticeDelivery {
  const held: HeldNotice[] = [];
  const hold = (notice: HeldNotice) => {
    held.push(notice);
    if (held.length > MAX_HELD_NOTICES) held.shift();
  };

  const send = async ({ target, signal, wake }: HeldNotice): Promise<boolean> => {
    const session = await findSessionForThread(getRouter(), target);
    if (!session) return false;
    if (wake && session.thread.getId() === target.threadId) {
      const woken = await session
        .sendSignal(signal, { ifIdle: { behavior: 'wake' }, requireDelivery: true })
        .accepted.catch(() => undefined);
      // A wake that could not start or that the thread refused never reached the
      // thread. Save the notice instead; it has the event's id, so it is saved once.
      if (woken && woken.action !== 'blocked' && woken.action !== 'discard') return true;
    }
    await session.sendSignalToThread(signal, target).accepted;
    return true;
  };

  return {
    async deliver(target, signal, options) {
      const notice = { target, signal, wake: options?.wake ?? true };
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
    const event = {
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
