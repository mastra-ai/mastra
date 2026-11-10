import type { BackgroundTaskResponse } from '@mastra/client-js';

export const BACKGROUND_TASK_ID = 'bg-05a4940e';

/** A deferred `reports_slow_report` call's background task, as `GET /api/background-tasks/:taskId` returns it. */
export const backgroundTask = (status: BackgroundTaskResponse['status']): BackgroundTaskResponse => ({
  id: BACKGROUND_TASK_ID,
  status,
  toolName: 'reports_slow_report',
  toolCallId: 'call-1',
  args: { topic: 'q3' },
  agentId: 'tasks-agent',
  runId: 'run-1',
  createdAt: '2026-10-27T12:00:00.000Z',
  completedAt: status === 'completed' ? '2026-10-27T12:00:42.000Z' : undefined,
  retryCount: 0,
  maxRetries: 0,
  timeoutMs: 60_000,
});
