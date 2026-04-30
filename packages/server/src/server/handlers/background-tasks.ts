import { HTTPException } from '../http-exception';
import {
  backgroundTaskResponseSchema,
  backgroundTaskStreamQuerySchema,
  backgroundTaskStreamResponseSchema,
  listBackgroundTaskResponseSchema,
  listBackgroundTasksQuerySchema,
  backgroundTaskIdPathParams,
} from '../schemas/background-tasks';
import { createRoute } from '../server-adapter/routes/route-builder';

export const BACKGROUND_TASK_STREAM_ROUTE = createRoute({
  method: 'GET',
  path: '/background-tasks/stream',
  responseType: 'stream' as const,
  streamFormat: 'sse' as const,
  queryParamSchema: backgroundTaskStreamQuerySchema,
  responseSchema: backgroundTaskStreamResponseSchema,
  summary: 'Stream background task events via SSE',
  description: 'Real-time Server-Sent Events stream of background task completion/failure events.',
  tags: ['Background Tasks'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, runId, threadId, resourceId, taskId, abortSignal }) => {
    const bgManager = mastra.backgroundTaskManager;
    if (!bgManager) {
      // Background tasks are not enabled — return an empty stream that stays
      // open until the client disconnects. This avoids spamming the logs with
      // false-positive errors when clients (e.g. the studio UI) optimistically
      // subscribe to the stream.
      return new ReadableStream({
        start(controller) {
          abortSignal?.addEventListener('abort', () => {
            try {
              controller.close();
            } catch {
              // Already closed
            }
          });
        },
      });
    }

    return bgManager.stream({ agentId, runId, threadId, resourceId, taskId, abortSignal });
  },
});

export const LIST_BACKGROUND_TASKS_ROUTE = createRoute({
  method: 'GET',
  path: '/background-tasks',
  responseType: 'json' as const,
  queryParamSchema: listBackgroundTasksQuerySchema,
  responseSchema: listBackgroundTaskResponseSchema,
  summary: 'List background tasks',
  description: 'Returns background tasks filtered by status, agent, run, etc.',
  tags: ['Background Tasks'],
  requiresAuth: true,
  handler: async ({ mastra, ...params }) => {
    const bgManager = mastra.backgroundTaskManager;
    if (!bgManager) {
      // Background tasks not enabled — there are no tasks to return.
      return { tasks: [], total: 0 };
    }

    return bgManager.listTasks(params);
  },
});

export const GET_BACKGROUND_TASK_ROUTE = createRoute({
  method: 'GET',
  path: '/background-tasks/:backgroundTaskId',
  responseType: 'json' as const,
  pathParamSchema: backgroundTaskIdPathParams,
  responseSchema: backgroundTaskResponseSchema,
  summary: 'Get a background task by ID',
  description: 'Returns a background task by ID.',
  tags: ['Background Tasks'],
  requiresAuth: true,
  handler: async ({ mastra, backgroundTaskId }) => {
    const bgManager = mastra.backgroundTaskManager;
    if (!bgManager) {
      // Background tasks not enabled — the task can't exist.
      throw new HTTPException(404, { message: 'Background task not found' });
    }

    const task = await bgManager.getTask(backgroundTaskId);
    if (!task) {
      throw new HTTPException(404, { message: 'Background task not found' });
    }
    return task;
  },
});
