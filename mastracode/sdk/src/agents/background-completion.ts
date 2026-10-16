import type { Session } from '@mastra/core/agent-controller';
import type { BackgroundTask, BackgroundTaskManagerConfig } from '@mastra/core/background-tasks';
import type { BackgroundCompletionEvents } from './background-completion-events.js';

interface BackgroundCompletionRouter {
  getSession(sessionId: string): Promise<Session<unknown> | undefined>;
}

/**
 * Find the live session a thread runs in. Factory sessions are addressed by
 * their thread id; Mastra Code sessions by their resource id. Only a session
 * working on the same resource qualifies, so a thread is never run by a
 * session of another resource.
 */
export async function findSessionForThread(
  controller: BackgroundCompletionRouter,
  { resourceId, threadId }: { resourceId: string; threadId: string },
): Promise<Session<unknown> | undefined> {
  for (const sessionId of new Set([threadId, resourceId])) {
    const session = await controller.getSession(sessionId);
    if (session?.identity.getResourceId() === resourceId) return session;
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
