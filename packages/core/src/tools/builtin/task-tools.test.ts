import { describe, expect, it, vi } from 'vitest';

import { RequestContext } from '../../request-context';
import { InMemoryThreadStateStorage } from '../../storage/domains/thread-state/inmemory';

import {
  assignTaskIds,
  TASK_STATE_TYPE,
  taskCheckTool,
  taskCompleteTool,
  taskUpdateTool,
  taskWriteTool,
} from './task-tools';
import type { TaskItem, TaskItemSnapshot } from './task-tools';

type TaskInput = { id?: string; content: string; status: TaskItem['status']; activeForm: string };

const THREAD_ID = 'thread-1';

/**
 * Build a tool execution context for the agnostic task tools.
 *
 * The tools are memory-gated on `agent.threadId`/`agent.resourceId` and read/
 * write the task list through the thread-scoped thread-state store, resolved via
 * `context.mastra.getStorage().getStore('threadState')`. By default the context
 * is memory-backed; pass `{ memory: false }` to exercise the no-op path.
 */
function createToolContext(
  initialTasks: TaskInput[] = [],
  options: { memory?: boolean; onEvent?: (event: { type: 'task_updated'; tasks: TaskItemSnapshot[] }) => void } = {},
) {
  const memory = options.memory ?? true;
  const requestContext = new RequestContext();
  const store = new InMemoryThreadStateStorage();
  if (initialTasks.length > 0) {
    void store.setState({ threadId: THREAD_ID, type: TASK_STATE_TYPE, value: assignTaskIds(initialTasks) });
  }
  if (options.onEvent) {
    requestContext.set('controller', { emitEvent: options.onEvent });
  }

  const mastra = {
    getStorage: () => ({
      getStore: (name: string) => (name === 'threadState' ? store : undefined),
    }),
  };

  return {
    requestContext,
    agent: memory ? { threadId: THREAD_ID, resourceId: 'resource-1' } : {},
    mastra,
    getTasks: () =>
      store.getState<TaskItemSnapshot[]>({ threadId: THREAD_ID, type: TASK_STATE_TYPE }).then(t => t ?? []),
  };
}

describe('task tools require memory', () => {
  it('task_write no-ops without a memory-backed thread', async () => {
    const ctx = createToolContext([], { memory: false });
    const result = await (taskWriteTool as any).execute(
      { tasks: [{ content: 'Write tests', status: 'pending', activeForm: 'Writing tests' }] },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.content).toContain('require agent memory');
    expect(result.tasks).toEqual([]);
    expect(await ctx.getTasks()).toEqual([]);
  });

  it('task_check no-ops without a memory-backed thread', async () => {
    const ctx = createToolContext([], { memory: false });
    const result = await (taskCheckTool as any).execute({}, ctx);

    expect(result.isError).toBe(true);
    expect(result.content).toContain('require agent memory');
    expect(result.summary).toMatchObject({ total: 0, hasTasks: false, allCompleted: false });
    expect(result.incompleteTasks).toEqual([]);
  });
});

describe('taskWriteTool', () => {
  it('assigns ids to tasks that omit them and persists the list to the store', async () => {
    const ctx = createToolContext();
    const result = await (taskWriteTool as any).execute(
      { tasks: [{ content: 'Write tests', status: 'pending', activeForm: 'Writing tests' }] },
      ctx,
    );

    expect(result.isError).toBe(false);
    expect(result.tasks).toEqual([
      { id: 'task_write_tests', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' },
    ]);
    expect(await ctx.getTasks()).toEqual(result.tasks);
    expect(result.content).toContain('task_write_tests: Write tests');
  });

  it('preserves provided ids', async () => {
    const ctx = createToolContext();
    await (taskWriteTool as any).execute(
      { tasks: [{ id: 'custom', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' }] },
      ctx,
    );

    expect((await ctx.getTasks())[0]!.id).toBe('custom');
  });

  it('reuses existing ids when replacing a list with matching task content', async () => {
    const ctx = createToolContext([
      { id: 'tests', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' },
    ]);
    await (taskWriteTool as any).execute(
      { tasks: [{ content: 'Write tests', status: 'in_progress', activeForm: 'Writing tests' }] },
      ctx,
    );

    expect(await ctx.getTasks()).toEqual([
      { id: 'tests', content: 'Write tests', status: 'in_progress', activeForm: 'Writing tests' },
    ]);
  });

  it('rejects task lists with multiple in-progress tasks without changing the store', async () => {
    const ctx = createToolContext([
      { id: 'tests', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' },
    ]);
    const result = await (taskWriteTool as any).execute(
      {
        tasks: [
          { content: 'First', status: 'in_progress', activeForm: 'Doing first' },
          { content: 'Second', status: 'in_progress', activeForm: 'Doing second' },
        ],
      },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.content).toContain('Only one task can be in_progress');
    expect(await ctx.getTasks()).toEqual([
      { id: 'tests', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' },
    ]);
  });

  it('emits a task_updated event to the controller display bridge when present', async () => {
    const onEvent = vi.fn();
    const ctx = createToolContext([], { onEvent });
    await (taskWriteTool as any).execute(
      { tasks: [{ content: 'Write tests', status: 'pending', activeForm: 'Writing tests' }] },
      ctx,
    );

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent.mock.calls[0]![0]).toEqual({
      type: 'task_updated',
      tasks: [{ id: 'task_write_tests', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' }],
    });
  });

  it('surfaces the new list on the RequestContext for the state processor', async () => {
    const ctx = createToolContext();
    const result = await (taskWriteTool as any).execute(
      { tasks: [{ content: 'Write tests', status: 'pending', activeForm: 'Writing tests' }] },
      ctx,
    );

    expect(ctx.requestContext.get('mastra:tasks')).toEqual(result.tasks);
  });

  it('does not emit a task_updated event for an errored write', async () => {
    const onEvent = vi.fn();
    const ctx = createToolContext([], { onEvent });
    await (taskWriteTool as any).execute(
      {
        tasks: [
          { content: 'First', status: 'in_progress', activeForm: 'Doing first' },
          { content: 'Second', status: 'in_progress', activeForm: 'Doing second' },
        ],
      },
      ctx,
    );

    expect(onEvent).not.toHaveBeenCalled();
  });
});

describe('taskUpdateTool', () => {
  it('patches one task by id and persists the full list', async () => {
    const ctx = createToolContext([
      { id: 'tests', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' },
    ]);
    const result = await (taskUpdateTool as any).execute({ id: 'tests', status: 'in_progress' }, ctx);

    expect(result.isError).toBe(false);
    expect(await ctx.getTasks()).toEqual([
      { id: 'tests', content: 'Write tests', status: 'in_progress', activeForm: 'Writing tests' },
    ]);
  });

  it('rejects an unknown task id without changing the store', async () => {
    const ctx = createToolContext([
      { id: 'tests', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' },
    ]);
    const result = await (taskUpdateTool as any).execute({ id: 'missing', status: 'completed' }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content).toContain('Task not found: missing');
    expect(await ctx.getTasks()).toEqual([
      { id: 'tests', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' },
    ]);
  });

  it('auto-demotes the previous in-progress task when promoting another', async () => {
    const ctx = createToolContext([
      { id: 'a', content: 'Task A', status: 'in_progress', activeForm: 'Doing A' },
      { id: 'b', content: 'Task B', status: 'pending', activeForm: 'Doing B' },
    ]);
    await (taskUpdateTool as any).execute({ id: 'b', status: 'in_progress' }, ctx);

    expect(await ctx.getTasks()).toEqual([
      { id: 'a', content: 'Task A', status: 'pending', activeForm: 'Doing A' },
      { id: 'b', content: 'Task B', status: 'in_progress', activeForm: 'Doing B' },
    ]);
  });
});

describe('taskCompleteTool', () => {
  it('marks only the matching task completed and preserves order', async () => {
    const ctx = createToolContext([
      { id: 'a', content: 'Task A', status: 'in_progress', activeForm: 'Doing A' },
      { id: 'b', content: 'Task B', status: 'pending', activeForm: 'Doing B' },
    ]);
    await (taskCompleteTool as any).execute({ id: 'a' }, ctx);

    expect(await ctx.getTasks()).toEqual([
      { id: 'a', content: 'Task A', status: 'completed', activeForm: 'Doing A' },
      { id: 'b', content: 'Task B', status: 'pending', activeForm: 'Doing B' },
    ]);
  });
});

describe('taskCheckTool', () => {
  it('returns structured summary fields and incomplete task ids', async () => {
    const ctx = createToolContext([
      { id: 'investigate', content: 'Investigate issue', status: 'in_progress', activeForm: 'Investigating issue' },
      { id: 'tests', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' },
    ]);
    const result = await (taskCheckTool as any).execute({}, ctx);

    expect(result).toMatchObject({
      summary: {
        total: 2,
        completed: 0,
        inProgress: 1,
        pending: 1,
        incomplete: 2,
        hasTasks: true,
        allCompleted: false,
      },
      isError: false,
    });
    expect(result.content).toContain('All tasks completed: NO');
    expect(result.content).toContain('tests: Write tests');
  });

  it('returns an empty structured summary when no tasks are tracked', async () => {
    const ctx = createToolContext();
    const result = await (taskCheckTool as any).execute({}, ctx);

    expect(result).toMatchObject({
      content: expect.stringContaining('No tasks found'),
      tasks: [],
      summary: { total: 0, hasTasks: false, allCompleted: false },
      incompleteTasks: [],
      isError: false,
    });
  });

  it('reports allCompleted only when tracked tasks are all completed', async () => {
    const ctx = createToolContext([
      { id: 'a', content: 'Task A', status: 'completed', activeForm: 'Doing A' },
      { id: 'b', content: 'Task B', status: 'completed', activeForm: 'Doing B' },
    ]);
    const result = await (taskCheckTool as any).execute({}, ctx);

    expect(result.content).toContain('All tasks completed: YES');
    expect(result.summary.allCompleted).toBe(true);
  });
});

describe('cross-turn task continuity via the TaskStore', () => {
  it('reads the prior task list from the store on a fresh turn (empty RequestContext)', async () => {
    // The store already holds tasks from a previous turn; a new turn starts with
    // a clean RequestContext but the store is the source of truth.
    const ctx = createToolContext([
      { id: 'tests', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' },
    ]);

    const result = await (taskUpdateTool as any).execute({ id: 'tests', status: 'in_progress' }, ctx);

    expect(result.isError).toBe(false);
    expect(result.tasks).toEqual([
      { id: 'tests', content: 'Write tests', status: 'in_progress', activeForm: 'Writing tests' },
    ]);
    expect(await ctx.getTasks()).toEqual(result.tasks);
  });

  it('within a turn, task_update observes the tasks a prior task_write wrote', async () => {
    const ctx = createToolContext();

    await (taskWriteTool as any).execute(
      {
        tasks: [
          { id: 'alpha', content: 'Alpha', status: 'pending', activeForm: 'Doing Alpha' },
          { id: 'beta', content: 'Beta', status: 'pending', activeForm: 'Doing Beta' },
        ],
      },
      ctx,
    );

    const result = await (taskUpdateTool as any).execute({ id: 'alpha', status: 'in_progress' }, ctx);

    expect(result.isError).toBe(false);
    expect(await ctx.getTasks()).toEqual([
      { id: 'alpha', content: 'Alpha', status: 'in_progress', activeForm: 'Doing Alpha' },
      { id: 'beta', content: 'Beta', status: 'pending', activeForm: 'Doing Beta' },
    ]);
  });
});
