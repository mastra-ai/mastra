import type { Task } from '@mastra/core/a2a';
import { describe, expect, it } from 'vitest';
import { InMemoryTaskStore } from './store';

function createTask(overrides: Partial<Task> & Pick<Task, 'id'> = { id: 'task-1' }): Task {
  return {
    id: overrides.id,
    contextId: overrides.contextId ?? 'context-1',
    status: overrides.status ?? {
      state: 'working',
      timestamp: '2025-05-08T11:47:38.458Z',
    },
    artifacts: overrides.artifacts ?? [],
    metadata: overrides.metadata,
    kind: 'task',
  };
}

describe('InMemoryTaskStore', () => {
  it('returns a task and version atomically via loadWithVersion', async () => {
    const store = new InMemoryTaskStore();
    const task = createTask();

    await store.save({ agentId: 'agent-1', data: task });

    expect(store.loadWithVersion({ agentId: 'agent-1', taskId: 'task-1' })).toEqual({
      task,
      version: 1,
    });
  });

  it('waitForNextUpdate resolves immediately when a newer version already exists', async () => {
    const store = new InMemoryTaskStore();
    const task = createTask();

    await store.save({ agentId: 'agent-1', data: task });
    await store.save({
      agentId: 'agent-1',
      data: createTask({
        id: 'task-1',
        status: {
          state: 'completed',
          timestamp: '2025-05-08T11:48:38.458Z',
        },
      }),
    });

    await expect(
      store.waitForNextUpdate({
        agentId: 'agent-1',
        taskId: 'task-1',
        afterVersion: 1,
      }),
    ).resolves.toEqual({
      task: createTask({
        id: 'task-1',
        status: {
          state: 'completed',
          timestamp: '2025-05-08T11:48:38.458Z',
        },
      }),
      version: 2,
    });
  });

  it('waitForNextUpdate removes listeners and rejects on abort', async () => {
    const store = new InMemoryTaskStore();
    const task = createTask();

    await store.save({ agentId: 'agent-1', data: task });

    const controller = new AbortController();
    const wait = store.waitForNextUpdate({
      agentId: 'agent-1',
      taskId: 'task-1',
      afterVersion: 1,
      signal: controller.signal,
    });

    expect(((store as any).listeners.get('agent-1-task-1') as Set<unknown> | undefined)?.size).toBe(1);

    controller.abort();

    await expect(wait).rejects.toMatchObject({ name: 'AbortError' });
    expect((store as any).listeners.has('agent-1-task-1')).toBe(false);
  });
});
