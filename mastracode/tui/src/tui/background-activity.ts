import type { BackgroundCompletionEvent } from '@mastra/code-sdk/agents/background-completion-events';

export type BackgroundActivityStatus = 'accepted' | 'completed' | 'failed';

export interface BackgroundActivity {
  id: string;
  taskId: string;
  toolCallId: string;
  toolName: string;
  resourceId: string;
  threadId: string;
  status: BackgroundActivityStatus;
  createdAt: number;
  completedAt?: number;
  errorSummary?: string;
}

export interface BackgroundToolContext {
  toolName: string;
  resourceId: string;
  threadId: string;
  createdAt: number;
}

export function acceptBackgroundActivity(
  activities: Map<string, BackgroundActivity>,
  taskId: string,
  toolCallId: string,
  context: BackgroundToolContext,
): void {
  activities.set(taskId, {
    id: `background-task:${taskId}`,
    taskId,
    toolCallId,
    toolName: context.toolName,
    resourceId: context.resourceId,
    threadId: context.threadId,
    status: 'accepted',
    createdAt: context.createdAt,
  });
}

export function completeBackgroundActivity(
  activities: Map<string, BackgroundActivity>,
  event: BackgroundCompletionEvent,
): void {
  const existing = activities.get(event.taskId);
  activities.set(event.taskId, {
    id: existing?.id ?? `background-task:${event.taskId}`,
    taskId: event.taskId,
    toolCallId: event.originToolCallId,
    toolName: event.toolName,
    resourceId: event.resourceId,
    threadId: event.threadId,
    status: event.status,
    createdAt: existing?.createdAt ?? Date.now(),
    completedAt: Date.now(),
    errorSummary: event.errorSummary,
  });
}

export function compareBackgroundActivities(a: BackgroundActivity, b: BackgroundActivity): number {
  if (a.status === 'accepted' && b.status !== 'accepted') return -1;
  if (a.status !== 'accepted' && b.status === 'accepted') return 1;
  return b.createdAt - a.createdAt;
}

export function clearCompletedBackgroundActivities(activities: Map<string, BackgroundActivity>): void {
  for (const [taskId, activity] of activities) {
    if (activity.status !== 'accepted') activities.delete(taskId);
  }
}
