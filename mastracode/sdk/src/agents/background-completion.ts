import type { Session } from '@mastra/core/agent-controller';
import type { BackgroundTask, BackgroundTaskManagerConfig } from '@mastra/core/background-tasks';
import type { BackgroundCompletionEvents } from './background-completion-events.js';

interface BackgroundCompletionRouter {
  getSessionByResource(resourceId: string): Promise<Session<unknown> | undefined>;
}

async function persistBackgroundCompletion(
  controller: BackgroundCompletionRouter,
  task: BackgroundTask,
  status: 'completed' | 'failed' | 'cancelled',
): Promise<void> {
  if (!task.resourceId || !task.threadId) return;

  const session = await controller.getSessionByResource(task.resourceId);
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
    await persistBackgroundCompletion(getController(), task, status);
    if (!task.resourceId || !task.threadId) return;
    events?.publish({
      id: `background-task:${task.id}:${status}`,
      taskId: task.id,
      originRunId: task.runId,
      originToolCallId: task.toolCallId,
      resourceId: task.resourceId,
      threadId: task.threadId,
      toolName: task.toolName,
      status,
    });
  };

  return {
    onTaskComplete: task => deliver(task, 'completed'),
    onTaskFailed: task => deliver(task, 'failed'),
    onTaskCancelled: task => deliver(task, 'cancelled'),
  };
}
