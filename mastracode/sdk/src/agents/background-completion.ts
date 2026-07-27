import type { Session } from '@mastra/core/agent-controller';
import type { BackgroundTask, BackgroundTaskManagerConfig } from '@mastra/core/background-tasks';

interface BackgroundCompletionRouter {
  getSessionByResource(resourceId: string): Promise<Session<unknown> | undefined>;
}

async function persistBackgroundCompletion(
  controller: BackgroundCompletionRouter,
  task: BackgroundTask,
  status: 'completed' | 'failed',
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
): Pick<BackgroundTaskManagerConfig, 'onTaskComplete' | 'onTaskFailed'> {
  return {
    onTaskComplete: task => persistBackgroundCompletion(getController(), task, 'completed'),
    onTaskFailed: task => persistBackgroundCompletion(getController(), task, 'failed'),
  };
}
