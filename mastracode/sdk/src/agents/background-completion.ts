import type { Session } from '@mastra/core/agent-controller';
import type { BackgroundTask, BackgroundTaskManagerConfig } from '@mastra/core/background-tasks';
import type { BackgroundCompletionEvents } from './background-completion-events.js';

interface BackgroundCompletionRouter<TState = unknown> {
  getSession(sessionId: string): Promise<Session<TState> | undefined>;
  /** Live sessions to search when no session is addressed by the thread or resource id. */
  listLiveSessions?(): Iterable<Session<TState>>;
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
