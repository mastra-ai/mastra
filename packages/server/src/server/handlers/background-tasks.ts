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
import { getContextResourceId } from './utils';

/**
 * Resolves the resource filter for a background-task request. A resource-scoped caller
 * is pinned to its own resource and may not request another one; a privileged caller
 * (no resource in the request context) keeps the client-provided filter.
 */
function resolveResourceScope(
  requestContext: Parameters<typeof getContextResourceId>[0],
  clientResourceId: string | undefined,
): { resourceId: string | undefined; scoped: boolean } {
  const contextResourceId = getContextResourceId(requestContext);
  if (contextResourceId === undefined) return { resourceId: clientResourceId, scoped: false };
  // An empty resource id must not be mistaken for a privileged (unscoped) caller, and
  // storage filters ignore empty strings, so it cannot be scoped safely either.
  if (contextResourceId === '') {
    throw new HTTPException(403, { message: 'Access denied: authenticated resourceId is empty' });
  }
  if (clientResourceId !== undefined && clientResourceId !== contextResourceId) {
    throw new HTTPException(403, { message: 'Access denied: resourceId does not match the authenticated resource' });
  }
  return { resourceId: contextResourceId, scoped: true };
}

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
  handler: async ({
    mastra,
    agentId,
    runId,
    threadId,
    resourceId: clientResourceId,
    taskId,
    abortSignal,
    requestContext,
  }) => {
    const { resourceId, scoped } = resolveResourceScope(requestContext, clientResourceId);
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

    return bgManager.stream({ agentId, runId, threadId, resourceId, taskId, abortSignal, allResources: !scoped });
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
  handler: async ({ mastra, requestContext, ...params }) => {
    const { resourceId } = resolveResourceScope(requestContext, params.resourceId);
    const bgManager = mastra.backgroundTaskManager;
    if (!bgManager) {
      // Background tasks not enabled — there are no tasks to return.
      return { tasks: [], total: 0 };
    }

    return bgManager.listTasks({ ...params, resourceId });
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
  handler: async ({ mastra, backgroundTaskId, requestContext }) => {
    const { resourceId, scoped } = resolveResourceScope(requestContext, undefined);
    const bgManager = mastra.backgroundTaskManager;
    if (!bgManager) {
      // Background tasks not enabled — the task can't exist.
      throw new HTTPException(404, { message: 'Background task not found' });
    }

    const task = await bgManager.getTask(backgroundTaskId);
    // Report another resource's task as missing so its existence is not disclosed.
    if (!task || (scoped && task.resourceId !== resourceId)) {
      throw new HTTPException(404, { message: 'Background task not found' });
    }
    return task;
  },
});
