import type { BackgroundTask } from '@mastra/core/background-tasks';
import { TABLE_BACKGROUND_TASKS } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { ConvexAdminClient } from '../../client';
import type { StorageRequest } from '../../types';
import { BackgroundTasksConvex } from './index';

function createClient({ callStorage = vi.fn() }: { callStorage?: ReturnType<typeof vi.fn> } = {}) {
  const client = new ConvexAdminClient({
    deploymentUrl: 'https://test.convex.cloud',
    adminAuthToken: 'test-token',
  });

  (client as unknown as { callStorage: typeof callStorage }).callStorage = callStorage;

  return { client, callStorage };
}

function createTask(overrides: Partial<BackgroundTask> = {}): BackgroundTask {
  return {
    id: 'task-1',
    status: 'pending',
    toolName: 'sendEmail',
    toolCallId: 'call-1',
    args: { to: 'dev@example.com' },
    agentId: 'agent-1',
    threadId: 'thread-1',
    resourceId: 'resource-1',
    runId: 'run-1',
    retryCount: 0,
    maxRetries: 2,
    timeoutMs: 30_000,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createStoredTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    status: 'pending',
    tool_name: 'sendEmail',
    tool_call_id: 'call-1',
    args: JSON.stringify({ to: 'dev@example.com' }),
    agent_id: 'agent-1',
    thread_id: 'thread-1',
    resource_id: 'resource-1',
    run_id: 'run-1',
    result: null,
    error: null,
    suspend_payload: null,
    retry_count: 0,
    max_retries: 2,
    timeout_ms: 30_000,
    createdAt: '2026-01-01T00:00:00.000Z',
    startedAt: null,
    suspendedAt: null,
    completedAt: null,
    ...overrides,
  };
}

describe('BackgroundTasksConvex', () => {
  it('stores background tasks in the typed Convex column shape', async () => {
    const { client, callStorage } = createClient({
      callStorage: vi.fn(async () => undefined),
    });
    const storage = new BackgroundTasksConvex({ client });

    await storage.createTask(createTask({ result: { ok: true }, threadId: undefined }));

    expect(callStorage).toHaveBeenCalledWith({
      op: 'insert',
      tableName: TABLE_BACKGROUND_TASKS,
      record: {
        id: 'task-1',
        status: 'pending',
        tool_call_id: 'call-1',
        tool_name: 'sendEmail',
        agent_id: 'agent-1',
        run_id: 'run-1',
        thread_id: null,
        resource_id: 'resource-1',
        args: JSON.stringify({ to: 'dev@example.com' }),
        result: JSON.stringify({ ok: true }),
        error: null,
        suspend_payload: null,
        retry_count: 0,
        max_retries: 2,
        timeout_ms: 30_000,
        createdAt: '2026-01-01T00:00:00.000Z',
        startedAt: null,
        suspendedAt: null,
        completedAt: null,
      },
    });
  });

  it('patches task updates without deleting and reinserting the task row', async () => {
    const { client, callStorage } = createClient({
      callStorage: vi.fn(async () => true),
    });
    const storage = new BackgroundTasksConvex({ client });

    await storage.updateTask('task-1', {
      status: 'running',
      startedAt: new Date('2026-01-01T00:01:00.000Z'),
      suspendPayload: undefined,
      suspendedAt: undefined,
    });

    expect(callStorage).toHaveBeenCalledTimes(1);
    expect(callStorage).toHaveBeenCalledWith({
      op: 'patch',
      tableName: TABLE_BACKGROUND_TASKS,
      id: 'task-1',
      record: {
        status: 'running',
        startedAt: '2026-01-01T00:01:00.000Z',
        suspend_payload: null,
        suspendedAt: null,
      },
    });
  });

  it('clears nullable JSON fields while omitting undefined non-null fields from task patches', async () => {
    const { client, callStorage } = createClient({
      callStorage: vi.fn(async () => true),
    });
    const storage = new BackgroundTasksConvex({ client });

    await storage.updateTask('task-1', {
      status: undefined,
      result: null,
      error: { message: 'failed once' },
      retryCount: undefined,
      completedAt: new Date('2026-01-01T00:03:00.000Z'),
    });

    expect(callStorage).toHaveBeenCalledWith({
      op: 'patch',
      tableName: TABLE_BACKGROUND_TASKS,
      id: 'task-1',
      record: {
        result: null,
        error: JSON.stringify({ message: 'failed once' }),
        completedAt: '2026-01-01T00:03:00.000Z',
      },
    });
  });

  it('skips empty task patches', async () => {
    const { client, callStorage } = createClient({
      callStorage: vi.fn(async () => true),
    });
    const storage = new BackgroundTasksConvex({ client });

    await storage.updateTask('task-1', {});

    expect(callStorage).not.toHaveBeenCalled();
  });

  it('queries indexed filters including resourceId and maps stored rows back to BackgroundTask', async () => {
    const storedTask = createStoredTask({
      status: 'running',
      startedAt: '2026-01-01T00:01:00.000Z',
      result: JSON.stringify({ ok: true }),
    });
    const { client, callStorage } = createClient({
      callStorage: vi.fn(async (request: StorageRequest) => {
        if (request.op === 'queryTable') return [storedTask];
        return undefined;
      }),
    });
    const storage = new BackgroundTasksConvex({ client });

    const result = await storage.listTasks({
      status: 'running',
      agentId: 'agent-1',
      resourceId: 'resource-1',
      perPage: 10,
    });

    expect(callStorage).toHaveBeenCalledWith({
      op: 'queryTable',
      tableName: TABLE_BACKGROUND_TASKS,
      filters: [
        { field: 'status', value: 'running' },
        { field: 'agent_id', value: 'agent-1' },
        { field: 'resource_id', value: 'resource-1' },
      ],
      indexHint: undefined,
    });
    expect(result.total).toBe(1);
    expect(result.tasks[0]).toEqual(
      expect.objectContaining({
        id: 'task-1',
        status: 'running',
        toolName: 'sendEmail',
        toolCallId: 'call-1',
        agentId: 'agent-1',
        resourceId: 'resource-1',
        runId: 'run-1',
        result: { ok: true },
        startedAt: new Date('2026-01-01T00:01:00.000Z'),
      }),
    );
  });

  it('uses the status index for single-value status arrays', async () => {
    const storedTask = createStoredTask({ status: 'running' });
    const { client, callStorage } = createClient({
      callStorage: vi.fn(async (request: StorageRequest) => {
        if (request.op === 'queryTable') return [storedTask];
        return undefined;
      }),
    });
    const storage = new BackgroundTasksConvex({ client });

    await storage.listTasks({ status: ['running'] });

    expect(callStorage).toHaveBeenCalledWith({
      op: 'queryTable',
      tableName: TABLE_BACKGROUND_TASKS,
      filters: [{ field: 'status', value: 'running' }],
      indexHint: undefined,
    });
  });

  it('maps legacy fallback rows written before the typed background task table', async () => {
    const legacyTask = {
      id: 'task-1',
      status: 'suspended',
      toolName: 'sendEmail',
      toolCallId: 'call-1',
      args: JSON.stringify({ to: 'dev@example.com' }),
      agentId: 'agent-1',
      threadId: 'thread-1',
      resourceId: 'resource-1',
      runId: 'run-1',
      result: undefined,
      error: undefined,
      suspendPayload: JSON.stringify({ reason: 'approval' }),
      retryCount: 0,
      maxRetries: 2,
      timeoutMs: 30_000,
      createdAt: '2026-01-01T00:00:00.000Z',
      startedAt: '2026-01-01T00:01:00.000Z',
      suspendedAt: '2026-01-01T00:02:00.000Z',
      completedAt: undefined,
    };
    const { client, callStorage } = createClient({
      callStorage: vi.fn(async (request: StorageRequest) => {
        if (request.op === 'queryTable') return [legacyTask];
        return undefined;
      }),
    });
    const storage = new BackgroundTasksConvex({ client });

    const result = await storage.listTasks({ status: 'suspended', resourceId: 'resource-1' });

    expect(result.total).toBe(1);
    expect(result.tasks[0]).toEqual(
      expect.objectContaining({
        id: 'task-1',
        status: 'suspended',
        toolName: 'sendEmail',
        toolCallId: 'call-1',
        agentId: 'agent-1',
        threadId: 'thread-1',
        resourceId: 'resource-1',
        runId: 'run-1',
        suspendPayload: { reason: 'approval' },
        retryCount: 0,
        maxRetries: 2,
        timeoutMs: 30_000,
        startedAt: new Date('2026-01-01T00:01:00.000Z'),
        suspendedAt: new Date('2026-01-01T00:02:00.000Z'),
      }),
    );
    expect(callStorage).toHaveBeenCalledWith({
      op: 'queryTable',
      tableName: TABLE_BACKGROUND_TASKS,
      filters: [
        { field: 'status', value: 'suspended' },
        { field: 'resource_id', value: 'resource-1' },
      ],
      indexHint: undefined,
    });
  });

  it('does not delete every task when deleteTasks receives no filter conditions', async () => {
    const { client, callStorage } = createClient({
      callStorage: vi.fn(async () => [createStoredTask()]),
    });
    const storage = new BackgroundTasksConvex({ client });

    await storage.deleteTasks({});

    expect(callStorage).not.toHaveBeenCalled();
  });

  it('does not delete every task when deleteTasks receives an empty status list', async () => {
    const { client, callStorage } = createClient({
      callStorage: vi.fn(async () => [createStoredTask()]),
    });
    const storage = new BackgroundTasksConvex({ client });

    await storage.deleteTasks({ status: [] });

    expect(callStorage).not.toHaveBeenCalled();
  });
});
