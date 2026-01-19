import { HTTPException } from '../http-exception';
import {
  inboxIdPathParams,
  taskIdPathParams,
  listTasksQuerySchema,
  createTaskBodySchema,
  createTasksBatchBodySchema,
  resumeTaskBodySchema,
  listInboxesResponseSchema,
  listTasksResponseSchema,
  getTaskResponseSchema,
  inboxStatsResponseSchema,
  createTaskResponseSchema,
  createTasksBatchResponseSchema,
  listWaitingTasksResponseSchema,
  taskOperationResponseSchema,
} from '../schemas/inbox';
import { createRoute } from '../server-adapter/routes/route-builder';

import { handleError } from './error';

// ============================================================================
// List Inboxes
// ============================================================================

export const LIST_INBOXES_ROUTE = createRoute({
  method: 'GET',
  path: '/api/inboxes',
  responseType: 'json',
  responseSchema: listInboxesResponseSchema,
  summary: 'List all inboxes',
  description: 'Returns a list of all registered inboxes',
  tags: ['Inbox'],
  handler: async ({ mastra }) => {
    try {
      const inboxesMap = mastra.listInboxes();
      const inboxes = Object.values(inboxesMap);
      return {
        inboxes: inboxes.map(inbox => ({
          id: inbox.id,
          name: inbox.id, // Inboxes don't have a separate name, use id
        })),
      };
    } catch (error) {
      return handleError(error, 'Error listing inboxes');
    }
  },
});

// ============================================================================
// Task Listing and Retrieval
// ============================================================================

export const LIST_TASKS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/inboxes/:inboxId/tasks',
  responseType: 'json',
  pathParamSchema: inboxIdPathParams,
  queryParamSchema: listTasksQuerySchema,
  responseSchema: listTasksResponseSchema,
  summary: 'List tasks in inbox',
  description: 'Returns a paginated list of tasks in the specified inbox with optional filtering',
  tags: ['Inbox'],
  handler: async ({ mastra, inboxId, status, type, targetAgentId, claimedBy, priority, page, perPage }) => {
    try {
      const inbox = mastra.getInbox(inboxId!);
      if (!inbox) {
        throw new HTTPException(404, { message: `Inbox '${inboxId}' not found` });
      }

      const filter: Record<string, any> = {};
      if (status) filter.status = status;
      if (type) filter.type = type;
      if (targetAgentId) filter.targetAgentId = targetAgentId;
      if (claimedBy) filter.claimedBy = claimedBy;
      if (priority !== undefined) filter.priority = priority;
      if (perPage) filter.limit = perPage;
      if (page && perPage) filter.offset = page * perPage;

      const tasks = await inbox.list(filter);

      return {
        tasks,
        pagination: {
          total: tasks.length, // Note: This is a simplification; real pagination would need total count from storage
          page: page ?? 0,
          perPage: perPage ?? 100,
          hasMore: tasks.length === (perPage ?? 100),
        },
      };
    } catch (error) {
      return handleError(error, 'Error listing tasks');
    }
  },
});

export const GET_TASK_ROUTE = createRoute({
  method: 'GET',
  path: '/api/inboxes/:inboxId/tasks/:taskId',
  responseType: 'json',
  pathParamSchema: taskIdPathParams,
  responseSchema: getTaskResponseSchema,
  summary: 'Get task by ID',
  description: 'Returns details for a specific task',
  tags: ['Inbox'],
  handler: async ({ mastra, inboxId, taskId }) => {
    try {
      const inbox = mastra.getInbox(inboxId!);
      if (!inbox) {
        throw new HTTPException(404, { message: `Inbox '${inboxId}' not found` });
      }

      const task = await inbox.get(taskId!);
      return task;
    } catch (error) {
      return handleError(error, 'Error getting task');
    }
  },
});

export const LIST_WAITING_TASKS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/inboxes/:inboxId/tasks/waiting',
  responseType: 'json',
  pathParamSchema: inboxIdPathParams,
  responseSchema: listWaitingTasksResponseSchema,
  summary: 'List waiting tasks',
  description: 'Returns tasks that are waiting for human input',
  tags: ['Inbox'],
  handler: async ({ mastra, inboxId }) => {
    try {
      const inbox = mastra.getInbox(inboxId!);
      if (!inbox) {
        throw new HTTPException(404, { message: `Inbox '${inboxId}' not found` });
      }

      const tasks = await inbox.listWaiting();
      return { tasks };
    } catch (error) {
      return handleError(error, 'Error listing waiting tasks');
    }
  },
});

// ============================================================================
// Inbox Statistics
// ============================================================================

export const GET_INBOX_STATS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/inboxes/:inboxId/stats',
  responseType: 'json',
  pathParamSchema: inboxIdPathParams,
  responseSchema: inboxStatsResponseSchema,
  summary: 'Get inbox statistics',
  description: 'Returns task counts by status for the inbox',
  tags: ['Inbox'],
  handler: async ({ mastra, inboxId }) => {
    try {
      const inbox = mastra.getInbox(inboxId!);
      if (!inbox) {
        throw new HTTPException(404, { message: `Inbox '${inboxId}' not found` });
      }

      const stats = await inbox.stats();
      return stats;
    } catch (error) {
      return handleError(error, 'Error getting inbox stats');
    }
  },
});

// ============================================================================
// Task Creation
// ============================================================================

export const CREATE_TASK_ROUTE = createRoute({
  method: 'POST',
  path: '/api/inboxes/:inboxId/tasks',
  responseType: 'json',
  pathParamSchema: inboxIdPathParams,
  bodySchema: createTaskBodySchema,
  responseSchema: createTaskResponseSchema,
  summary: 'Create a task',
  description: 'Creates a new task in the inbox',
  tags: ['Inbox'],
  handler: async ({
    mastra,
    inboxId,
    id,
    type,
    payload,
    priority,
    title,
    targetAgentId,
    sourceId,
    sourceUrl,
    maxAttempts,
    metadata,
  }) => {
    try {
      const inbox = mastra.getInbox(inboxId!);
      if (!inbox) {
        throw new HTTPException(404, { message: `Inbox '${inboxId}' not found` });
      }

      const taskInput = {
        id,
        type,
        payload,
        priority: priority as 0 | 1 | 2 | 3 | undefined,
        title,
        targetAgentId,
        sourceId,
        sourceUrl,
        maxAttempts,
        metadata,
      };
      const task = await inbox.add(taskInput);
      return task;
    } catch (error) {
      return handleError(error, 'Error creating task');
    }
  },
});

export const CREATE_TASKS_BATCH_ROUTE = createRoute({
  method: 'POST',
  path: '/api/inboxes/:inboxId/tasks/batch',
  responseType: 'json',
  pathParamSchema: inboxIdPathParams,
  bodySchema: createTasksBatchBodySchema,
  responseSchema: createTasksBatchResponseSchema,
  summary: 'Create multiple tasks',
  description: 'Creates multiple tasks in the inbox in a single batch operation',
  tags: ['Inbox'],
  handler: async ({ mastra, inboxId, tasks: taskInputs }) => {
    try {
      const inbox = mastra.getInbox(inboxId!);
      if (!inbox) {
        throw new HTTPException(404, { message: `Inbox '${inboxId}' not found` });
      }

      // Type assertion needed because Zod refine doesn't narrow the type for payload
      const tasks = await inbox.addBatch(
        taskInputs as Array<{ type: string; payload: unknown } & Record<string, unknown>>,
      );
      return { tasks };
    } catch (error) {
      return handleError(error, 'Error creating tasks batch');
    }
  },
});

// ============================================================================
// Task Operations
// ============================================================================

export const CANCEL_TASK_ROUTE = createRoute({
  method: 'POST',
  path: '/api/inboxes/:inboxId/tasks/:taskId/cancel',
  responseType: 'json',
  pathParamSchema: taskIdPathParams,
  responseSchema: taskOperationResponseSchema,
  summary: 'Cancel a task',
  description: 'Cancels a pending or in-progress task',
  tags: ['Inbox'],
  handler: async ({ mastra, inboxId, taskId }) => {
    try {
      const inbox = mastra.getInbox(inboxId!);
      if (!inbox) {
        throw new HTTPException(404, { message: `Inbox '${inboxId}' not found` });
      }

      await inbox.cancel(taskId!);
      return { success: true };
    } catch (error) {
      return handleError(error, 'Error cancelling task');
    }
  },
});

export const RELEASE_TASK_ROUTE = createRoute({
  method: 'POST',
  path: '/api/inboxes/:inboxId/tasks/:taskId/release',
  responseType: 'json',
  pathParamSchema: taskIdPathParams,
  responseSchema: taskOperationResponseSchema,
  summary: 'Release a task',
  description: 'Releases a claimed task back to pending status',
  tags: ['Inbox'],
  handler: async ({ mastra, inboxId, taskId }) => {
    try {
      const inbox = mastra.getInbox(inboxId!);
      if (!inbox) {
        throw new HTTPException(404, { message: `Inbox '${inboxId}' not found` });
      }

      await inbox.release(taskId!);
      return { success: true };
    } catch (error) {
      return handleError(error, 'Error releasing task');
    }
  },
});

export const RESUME_TASK_ROUTE = createRoute({
  method: 'POST',
  path: '/api/inboxes/:inboxId/tasks/:taskId/resume',
  responseType: 'json',
  pathParamSchema: taskIdPathParams,
  bodySchema: resumeTaskBodySchema,
  responseSchema: taskOperationResponseSchema,
  summary: 'Resume a suspended task',
  description: 'Resumes a task that is waiting for human input',
  tags: ['Inbox'],
  handler: async ({ mastra, inboxId, taskId, payload }) => {
    try {
      const inbox = mastra.getInbox(inboxId!);
      if (!inbox) {
        throw new HTTPException(404, { message: `Inbox '${inboxId}' not found` });
      }

      await inbox.resume(taskId!, { payload });
      return { success: true };
    } catch (error) {
      return handleError(error, 'Error resuming task');
    }
  },
});
