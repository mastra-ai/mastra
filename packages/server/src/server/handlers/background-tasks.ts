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
  handler: async ({ mastra, agentId, runId, threadId, resourceId, abortSignal }) => {
    const bgManager = mastra.backgroundTaskManager;
    if (!bgManager) {
      throw new HTTPException(400, { message: 'Background task manager not available' });
    }

    return bgManager.stream({ agentId, runId, threadId, resourceId, abortSignal });
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
  handler: async ({ mastra, ...params }) => {
    const bgManager = mastra.backgroundTaskManager;
    if (!bgManager) {
      throw new HTTPException(400, { message: 'Background task manager not available' });
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
  handler: async ({ mastra, backgroundTaskId }) => {
    const bgManager = mastra.backgroundTaskManager;
    if (!bgManager) {
      throw new HTTPException(400, { message: 'Background task manager not available' });
    }

    const task = await bgManager.getTask(backgroundTaskId);
    if (!task) {
      throw new HTTPException(404, { message: 'Background task not found' });
    }
    return task;
  },
});
