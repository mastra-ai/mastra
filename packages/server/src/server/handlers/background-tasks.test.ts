import type { BackgroundTaskManager, TaskContext } from '@mastra/core/background-tasks';
import { EventEmitterPubSub } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import { MockStore } from '@mastra/core/storage';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HTTPException } from '../http-exception';
import {
  BACKGROUND_TASK_STREAM_ROUTE,
  LIST_BACKGROUND_TASKS_ROUTE,
  GET_BACKGROUND_TASK_ROUTE,
} from './background-tasks';

function ctx(executeFn: (args: any, opts?: any) => Promise<any>): TaskContext {
  return { executor: { execute: executeFn } };
}

const tick = (ms = 50) => new Promise(resolve => setTimeout(resolve, ms));

describe('Background Tasks handlers', () => {
  let mastra: Mastra;
  let pubsub: EventEmitterPubSub;
  let bgManager: BackgroundTaskManager;
  const storage = new MockStore();

  beforeEach(async () => {
    pubsub = new EventEmitterPubSub();
    mastra = new Mastra({
      logger: false,
      storage,
      backgroundTasks: {
        enabled: true,
        globalConcurrency: 5,
        perAgentConcurrency: 3,
      },
    });

    bgManager = mastra.backgroundTaskManager!;
    // The Mastra constructor fires init() in the background — wait for it
    await tick(100);
  });

  afterEach(async () => {
    await bgManager.shutdown();
    await pubsub.close();
    const bgStore = await storage.getStore('backgroundTasks');
    await bgStore?.dangerouslyClearAll();
  });

  describe('LIST_BACKGROUND_TASKS_ROUTE', () => {
    it('returns empty list when no tasks exist', async () => {
      const result = await LIST_BACKGROUND_TASKS_ROUTE.handler({
        mastra,
        requestContext: {} as any,
        abortSignal: new AbortController().signal,
      } as any);

      expect(result).toEqual({ tasks: [], total: 0 });
    });

    it('returns tasks after enqueue', async () => {
      await bgManager.enqueue(
        { toolName: 'tool-1', toolCallId: 'c1', args: {}, agentId: 'a1', runId: 'run-1' },
        ctx(vi.fn().mockResolvedValue('ok')),
      );
      await tick();

      const result = await LIST_BACKGROUND_TASKS_ROUTE.handler({
        mastra,
        requestContext: {} as any,
        abortSignal: new AbortController().signal,
      } as any);

      expect(result.total).toBe(1);
      expect(result.tasks.length).toBe(1);
      expect(result.tasks[0].toolName).toBe('tool-1');
      expect(result.tasks[0].status).toBe('completed');
    });

    it('filters by agentId', async () => {
      await bgManager.enqueue(
        { toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a1', runId: 'run-1' },
        ctx(vi.fn().mockResolvedValue('ok')),
      );
      await bgManager.enqueue(
        { toolName: 'tool', toolCallId: 'c2', args: {}, agentId: 'a2', runId: 'run-2' },
        ctx(vi.fn().mockResolvedValue('ok')),
      );
      await tick();

      const result = await LIST_BACKGROUND_TASKS_ROUTE.handler({
        mastra,
        agentId: 'a1',
        requestContext: {} as any,
        abortSignal: new AbortController().signal,
      } as any);

      expect(result.total).toBe(1);
      expect(result.tasks[0].agentId).toBe('a1');
    });

    it('filters by status', async () => {
      await bgManager.enqueue(
        { toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a1', runId: 'run-1' },
        ctx(vi.fn().mockResolvedValue('ok')),
      );
      await bgManager.enqueue(
        { toolName: 'tool', toolCallId: 'c2', args: {}, agentId: 'a1', runId: 'run-2' },
        ctx(vi.fn().mockRejectedValue(new Error('fail'))),
      );
      await tick();

      const result = await LIST_BACKGROUND_TASKS_ROUTE.handler({
        mastra,
        status: 'failed',
        requestContext: {} as any,
        abortSignal: new AbortController().signal,
      } as any);

      expect(result.total).toBe(1);
      expect(result.tasks[0].status).toBe('failed');
    });

    it('paginates with page and perPage', async () => {
      for (let i = 0; i < 5; i++) {
        await bgManager.enqueue(
          { toolName: 'tool', toolCallId: `c${i}`, args: {}, agentId: 'a1', runId: `run-${i}` },
          ctx(vi.fn().mockResolvedValue('ok')),
        );
      }
      await tick();

      const result = await LIST_BACKGROUND_TASKS_ROUTE.handler({
        mastra,
        page: 0,
        perPage: 2,
        requestContext: {} as any,
        abortSignal: new AbortController().signal,
      } as any);

      expect(result.tasks.length).toBe(2);
      expect(result.total).toBe(5);
    });

    it('returns an empty list when background task manager is not available', async () => {
      const noTasksMastra = new Mastra({ logger: false, storage, backgroundTasks: { enabled: false } });

      const result = await LIST_BACKGROUND_TASKS_ROUTE.handler({
        mastra: noTasksMastra,
        requestContext: {} as any,
        abortSignal: new AbortController().signal,
      } as any);

      expect(result).toEqual({ tasks: [], total: 0 });
    });
  });

  describe('GET_BACKGROUND_TASK_ROUTE', () => {
    it('returns a task by ID', async () => {
      const { task } = await bgManager.enqueue(
        { toolName: 'my-tool', toolCallId: 'c1', args: { q: 'test' }, agentId: 'a1', runId: 'run-1' },
        ctx(vi.fn().mockResolvedValue('result')),
      );
      await tick();

      const result = await GET_BACKGROUND_TASK_ROUTE.handler({
        mastra,
        backgroundTaskId: task.id,
        requestContext: {} as any,
        abortSignal: new AbortController().signal,
      } as any);

      expect(result.id).toBe(task.id);
      expect(result.toolName).toBe('my-tool');
      expect(result.status).toBe('completed');
    });

    it('throws 404 when task not found', async () => {
      await expect(
        GET_BACKGROUND_TASK_ROUTE.handler({
          mastra,
          backgroundTaskId: 'nonexistent',
          requestContext: {} as any,
          abortSignal: new AbortController().signal,
        } as any),
      ).rejects.toThrow(HTTPException);
    });

    it('throws 404 when background task manager is not available', async () => {
      const noTasksMastra = new Mastra({ logger: false, storage, backgroundTasks: { enabled: false } });

      await expect(
        GET_BACKGROUND_TASK_ROUTE.handler({
          mastra: noTasksMastra,
          backgroundTaskId: 'any',
          requestContext: {} as any,
          abortSignal: new AbortController().signal,
        } as any),
      ).rejects.toThrow(HTTPException);
    });
  });

  describe('BACKGROUND_TASK_STREAM_ROUTE', () => {
    it('returns a ReadableStream', async () => {
      const abortController = new AbortController();

      const result = await BACKGROUND_TASK_STREAM_ROUTE.handler({
        mastra,
        abortSignal: abortController.signal,
        requestContext: {} as any,
      } as any);

      expect(result).toBeInstanceOf(ReadableStream);
      abortController.abort();
    });

    it('streams completed task events', async () => {
      const abortController = new AbortController();

      const stream = (await BACKGROUND_TASK_STREAM_ROUTE.handler({
        mastra,
        abortSignal: abortController.signal,
        requestContext: {} as any,
      } as any)) as ReadableStream;

      const reader = stream.getReader();

      await bgManager.enqueue(
        { toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a1', runId: 'run-1' },
        ctx(vi.fn().mockResolvedValue('stream-result')),
      );
      await tick();

      // Stream emits running lifecycle event first, then the completed event.
      const first = await reader.read();
      expect(first.done).toBe(false);
      expect(first.value).toMatchObject({ type: 'background-task-running', payload: { toolName: 'tool' } });

      const second = await reader.read();
      expect(second.value).toMatchObject({
        type: 'background-task-completed',
        payload: { toolName: 'tool', result: 'stream-result' },
      });

      abortController.abort();
    });

    it('streams failed task events', async () => {
      const abortController = new AbortController();

      const stream = (await BACKGROUND_TASK_STREAM_ROUTE.handler({
        mastra,
        abortSignal: abortController.signal,
        requestContext: {} as any,
      } as any)) as ReadableStream;

      const reader = stream.getReader();

      await bgManager.enqueue(
        { toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'a1', runId: 'run-1' },
        ctx(vi.fn().mockRejectedValue(new Error('oops'))),
      );
      await tick();

      // Skip running event
      await reader.read();

      const { value } = await reader.read();
      expect(value).toMatchObject({
        type: 'background-task-failed',
        payload: { toolName: 'tool', error: { message: 'oops' } },
      });

      abortController.abort();
    });

    it('filters stream events by agentId', async () => {
      const abortController = new AbortController();

      const stream = (await BACKGROUND_TASK_STREAM_ROUTE.handler({
        mastra,
        agentId: 'target-agent',
        abortSignal: abortController.signal,
        requestContext: {} as any,
      } as any)) as ReadableStream;

      const reader = stream.getReader();

      // This task should NOT appear on the filtered stream
      await bgManager.enqueue(
        { toolName: 'tool', toolCallId: 'c1', args: {}, agentId: 'other-agent', runId: 'run-1' },
        ctx(vi.fn().mockResolvedValue('other')),
      );
      // This one should appear
      await bgManager.enqueue(
        { toolName: 'tool', toolCallId: 'c2', args: {}, agentId: 'target-agent', runId: 'run-2' },
        ctx(vi.fn().mockResolvedValue('target')),
      );
      await tick();

      // Running event for target-agent first, then completed.
      const running = await reader.read();
      expect(running.value).toMatchObject({ type: 'background-task-running', payload: { agentId: 'target-agent' } });

      const { value } = await reader.read();
      expect(value).toMatchObject({
        type: 'background-task-completed',
        payload: { agentId: 'target-agent', result: 'target' },
      });

      abortController.abort();
    });

    it('returns an empty stream that closes on abort when background task manager is not available', async () => {
      const noTasksMastra = new Mastra({ logger: false, storage, backgroundTasks: { enabled: false } });
      const abortController = new AbortController();

      const result = await BACKGROUND_TASK_STREAM_ROUTE.handler({
        mastra: noTasksMastra,
        abortSignal: abortController.signal,
        requestContext: {} as any,
      } as any);

      expect(result).toBeInstanceOf(ReadableStream);

      const reader = (result as ReadableStream).getReader();
      abortController.abort();
      const { done } = await reader.read();
      expect(done).toBe(true);
    });
  });
});
