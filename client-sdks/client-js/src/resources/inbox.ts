import type { RequestContext } from '@mastra/core/request-context';
import type { Task, TaskStatus, TaskPriority, ListFilter, InboxStats, CreateTaskInput } from '@mastra/core/inbox';
import type { ClientOptions } from '../types';

import { parseClientRequestContext, requestContextQueryString } from '../utils';
import { BaseResource } from './base';

/**
 * Parameters for listing tasks.
 */
export interface ListTasksParams extends ListFilter {
  requestContext?: RequestContext | Record<string, any>;
}

/**
 * Response for listing tasks.
 */
export interface ListTasksResponse {
  tasks: Task[];
  pagination: {
    total: number;
    page: number;
    perPage: number;
    hasMore: boolean;
  };
}

/**
 * Parameters for adding a task.
 */
export interface AddTaskParams extends CreateTaskInput {
  requestContext?: RequestContext | Record<string, any>;
}

/**
 * Parameters for resuming a task.
 */
export interface ResumeTaskParams {
  payload: unknown;
  requestContext?: RequestContext | Record<string, any>;
}

/**
 * Inbox resource for interacting with inbox tasks.
 */
export class Inbox extends BaseResource {
  constructor(
    options: ClientOptions,
    private inboxId: string,
  ) {
    super(options);
  }

  /**
   * Lists tasks in this inbox with optional filtering.
   * @param params - Optional filter and pagination parameters
   * @returns Promise containing tasks and pagination info
   */
  listTasks(params?: ListTasksParams): Promise<ListTasksResponse> {
    const searchParams = new URLSearchParams();

    if (params?.status) {
      if (Array.isArray(params.status)) {
        params.status.forEach(s => searchParams.append('status', s));
      } else {
        searchParams.set('status', params.status);
      }
    }
    if (params?.type) {
      if (Array.isArray(params.type)) {
        params.type.forEach(t => searchParams.append('type', t));
      } else {
        searchParams.set('type', params.type);
      }
    }
    if (params?.targetAgentId) {
      searchParams.set('targetAgentId', params.targetAgentId);
    }
    if (params?.claimedBy) {
      searchParams.set('claimedBy', params.claimedBy);
    }
    if (params?.priority !== undefined) {
      searchParams.set('priority', String(params.priority));
    }
    if (params?.limit !== undefined) {
      searchParams.set('limit', String(params.limit));
    }
    if (params?.offset !== undefined) {
      searchParams.set('offset', String(params.offset));
    }

    const queryString = searchParams.toString();
    const contextString = requestContextQueryString(params?.requestContext, queryString ? '&' : '?');

    return this.request(`/api/inboxes/${this.inboxId}/tasks${queryString ? `?${queryString}` : ''}${contextString}`);
  }

  /**
   * Gets a specific task by ID.
   * @param taskId - ID of the task to retrieve
   * @param requestContext - Optional request context
   * @returns Promise containing the task
   */
  getTask(taskId: string, requestContext?: RequestContext | Record<string, any>): Promise<Task | null> {
    return this.request(`/api/inboxes/${this.inboxId}/tasks/${taskId}${requestContextQueryString(requestContext)}`);
  }

  /**
   * Gets statistics for this inbox.
   * @param requestContext - Optional request context
   * @returns Promise containing inbox statistics
   */
  getStats(requestContext?: RequestContext | Record<string, any>): Promise<InboxStats> {
    return this.request(`/api/inboxes/${this.inboxId}/stats${requestContextQueryString(requestContext)}`);
  }

  /**
   * Adds a new task to this inbox.
   * @param params - Task creation parameters
   * @returns Promise containing the created task
   */
  addTask(params: AddTaskParams): Promise<Task> {
    const { requestContext, ...taskInput } = params;
    return this.request(`/api/inboxes/${this.inboxId}/tasks${requestContextQueryString(requestContext)}`, {
      method: 'POST',
      body: taskInput,
    });
  }

  /**
   * Adds multiple tasks to this inbox.
   * @param tasks - Array of task creation parameters
   * @param requestContext - Optional request context
   * @returns Promise containing the created tasks
   */
  addTasks(
    tasks: CreateTaskInput[],
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<{ tasks: Task[] }> {
    return this.request(`/api/inboxes/${this.inboxId}/tasks/batch${requestContextQueryString(requestContext)}`, {
      method: 'POST',
      body: { tasks },
    });
  }

  /**
   * Cancels a task.
   * @param taskId - ID of the task to cancel
   * @param requestContext - Optional request context
   * @returns Promise that resolves when the task is cancelled
   */
  cancelTask(taskId: string, requestContext?: RequestContext | Record<string, any>): Promise<{ success: boolean }> {
    return this.request(
      `/api/inboxes/${this.inboxId}/tasks/${taskId}/cancel${requestContextQueryString(requestContext)}`,
      {
        method: 'POST',
      },
    );
  }

  /**
   * Releases a claimed task back to pending status.
   * @param taskId - ID of the task to release
   * @param requestContext - Optional request context
   * @returns Promise that resolves when the task is released
   */
  releaseTask(taskId: string, requestContext?: RequestContext | Record<string, any>): Promise<{ success: boolean }> {
    return this.request(
      `/api/inboxes/${this.inboxId}/tasks/${taskId}/release${requestContextQueryString(requestContext)}`,
      {
        method: 'POST',
      },
    );
  }

  /**
   * Resumes a suspended task with provided input.
   * @param taskId - ID of the task to resume
   * @param params - Resume parameters including payload
   * @returns Promise that resolves when the task is resumed
   */
  resumeTask(taskId: string, params: ResumeTaskParams): Promise<{ success: boolean }> {
    const { requestContext, payload } = params;
    return this.request(
      `/api/inboxes/${this.inboxId}/tasks/${taskId}/resume${requestContextQueryString(requestContext)}`,
      {
        method: 'POST',
        body: { payload },
      },
    );
  }

  /**
   * Lists tasks that are waiting for input.
   * @param requestContext - Optional request context
   * @returns Promise containing waiting tasks
   */
  listWaitingTasks(requestContext?: RequestContext | Record<string, any>): Promise<{ tasks: Task[] }> {
    return this.request(`/api/inboxes/${this.inboxId}/tasks/waiting${requestContextQueryString(requestContext)}`);
  }
}
