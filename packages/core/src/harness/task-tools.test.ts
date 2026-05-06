import { describe, expect, it, vi } from 'vitest';
import z from 'zod';

import { Agent } from '../agent';
import { RequestContext } from '../request-context';
import { InMemoryStore } from '../storage/mock';

import { Harness } from './harness';
import { assignTaskIds, taskCheckTool, taskCompleteTool, taskUpdateTool, taskWriteTool } from './tools';
import type { TaskItem, TaskItemSnapshot } from './tools';
import type { HarnessEvent, HarnessRequestContext } from './types';

function createTaskContext(
  initialTasks: Array<{ id?: string; content: string; status: TaskItem['status']; activeForm: string }> = [],
) {
  const events: HarnessEvent[] = [];
  const state = { tasks: initialTasks };
  const setState = vi.fn(async updates => {
    Object.assign(state, updates);
  });
  const updateState = vi.fn(async updater => {
    const update = await updater(state);
    if (update.updates) {
      await setState(update.updates);
    }
    for (const event of update.events ?? []) {
      events.push(event);
    }
    return update.result;
  });

  const requestContext = new RequestContext();
  const harnessCtx: Partial<HarnessRequestContext<typeof state>> = {
    state,
    getState: () => state,
    setState,
    updateState,
    emitEvent: event => events.push(event),
  };
  requestContext.set('harness', harnessCtx);

  return {
    events,
    requestContext,
    setState,
    state,
    updateState,
  };
}

function createHarness() {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  return new Harness<Record<string, unknown>>({
    id: 'test-harness',
    storage: new InMemoryStore(),
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
  });
}

describe('assignTaskIds', () => {
  it('does not reuse existing ids when duplicate content makes matching ambiguous', () => {
    const tasks = assignTaskIds(
      [
        { content: 'Review diff', status: 'in_progress', activeForm: 'Reviewing diff' },
        { content: 'Review diff', status: 'pending', activeForm: 'Reviewing diff again' },
        { id: 'first', content: 'New duplicate id', status: 'pending', activeForm: 'Handling duplicate id' },
      ],
      [
        { id: 'first', content: 'Review diff', status: 'pending', activeForm: 'Reviewing diff' },
        { id: 'second', content: 'Review diff', status: 'pending', activeForm: 'Reviewing diff again' },
      ],
    );

    expect(tasks).toEqual([
      { id: 'task_review_diff', content: 'Review diff', status: 'in_progress', activeForm: 'Reviewing diff' },
      { id: 'task_review_diff_2', content: 'Review diff', status: 'pending', activeForm: 'Reviewing diff again' },
      {
        id: 'first',
        content: 'New duplicate id',
        status: 'pending',
        activeForm: 'Handling duplicate id',
      },
    ]);
  });

  it('reuses an existing id when an omitted task has one unambiguous content match', () => {
    const tasks = assignTaskIds(
      [{ content: 'Review diff', status: 'in_progress', activeForm: 'Reviewing diff' }],
      [{ id: 'review', content: 'Review diff', status: 'pending', activeForm: 'Reviewing diff' }],
    );

    expect(tasks).toEqual([
      { id: 'review', content: 'Review diff', status: 'in_progress', activeForm: 'Reviewing diff' },
    ]);
  });

  it('reuses an unambiguous remaining id when explicit ids disambiguate duplicate content', () => {
    const tasks = assignTaskIds(
      [
        { id: 'first', content: 'Review diff', status: 'completed', activeForm: 'Reviewing diff' },
        { content: 'Review diff', status: 'in_progress', activeForm: 'Reviewing diff again' },
      ],
      [
        { id: 'first', content: 'Review diff', status: 'pending', activeForm: 'Reviewing diff' },
        { id: 'second', content: 'Review diff', status: 'pending', activeForm: 'Reviewing diff again' },
      ],
    );

    expect(tasks).toEqual([
      { id: 'first', content: 'Review diff', status: 'completed', activeForm: 'Reviewing diff' },
      { id: 'second', content: 'Review diff', status: 'in_progress', activeForm: 'Reviewing diff again' },
    ]);
  });

  it('does not let omitted tasks consume ids requested explicitly later in the same write', () => {
    const tasks = assignTaskIds(
      [
        { content: 'Review diff', status: 'pending', activeForm: 'Reviewing diff' },
        { id: 'review', content: 'Write docs', status: 'in_progress', activeForm: 'Writing docs' },
      ],
      [{ id: 'review', content: 'Review diff', status: 'pending', activeForm: 'Reviewing diff' }],
    );

    expect(tasks).toEqual([
      { id: 'task_review_diff', content: 'Review diff', status: 'pending', activeForm: 'Reviewing diff' },
      { id: 'review', content: 'Write docs', status: 'in_progress', activeForm: 'Writing docs' },
    ]);
  });

  it('reserves later explicit ids before minting generated fallback ids', () => {
    const tasks = assignTaskIds([
      { content: 'Write tests', status: 'pending', activeForm: 'Writing tests' },
      { id: 'task_write_tests', content: 'Run checks', status: 'in_progress', activeForm: 'Running checks' },
    ]);

    expect(tasks).toEqual([
      { id: 'task_write_tests_2', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' },
      { id: 'task_write_tests', content: 'Run checks', status: 'in_progress', activeForm: 'Running checks' },
    ]);
  });

  it('reserves reusable previous ids before minting generated fallback ids', () => {
    const tasks = assignTaskIds(
      [
        { content: 'Review', status: 'pending', activeForm: 'Reviewing' },
        { content: 'Other', status: 'pending', activeForm: 'Doing other' },
        { id: 'task_review', content: 'New', status: 'in_progress', activeForm: 'Doing new' },
      ],
      [
        { id: 'task_review', content: 'Review', status: 'pending', activeForm: 'Reviewing' },
        { id: 'task_review_2', content: 'Other', status: 'pending', activeForm: 'Doing other' },
      ],
    );

    expect(tasks).toEqual([
      { id: 'task_review_3', content: 'Review', status: 'pending', activeForm: 'Reviewing' },
      { id: 'task_review_2', content: 'Other', status: 'pending', activeForm: 'Doing other' },
      { id: 'task_review', content: 'New', status: 'in_progress', activeForm: 'Doing new' },
    ]);
  });

  it('reuses remaining duplicate-content ids after later explicit ids are reserved', () => {
    const tasks = assignTaskIds(
      [
        { content: 'Review diff', status: 'in_progress', activeForm: 'Reviewing diff again' },
        { id: 'first', content: 'Review diff', status: 'completed', activeForm: 'Reviewing diff' },
      ],
      [
        { id: 'first', content: 'Review diff', status: 'pending', activeForm: 'Reviewing diff' },
        { id: 'second', content: 'Review diff', status: 'pending', activeForm: 'Reviewing diff again' },
      ],
    );

    expect(tasks).toEqual([
      { id: 'second', content: 'Review diff', status: 'in_progress', activeForm: 'Reviewing diff again' },
      { id: 'first', content: 'Review diff', status: 'completed', activeForm: 'Reviewing diff' },
    ]);
  });

  it('caps deterministic id slugs for long generated ids', () => {
    const [task] = assignTaskIds([
      { content: `${'a '.repeat(40)}tail`, status: 'pending', activeForm: 'Tracking long task' },
    ]);

    expect(task!.id.startsWith('task_')).toBe(true);
    expect(task!.id.length).toBeLessThanOrEqual('task_'.length + 48);
  });
});

describe('task state transactions', () => {
  it('serializes state updates against the latest task state', async () => {
    const harness = createHarness();
    await harness.setState({
      tasks: [{ id: 'tests', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' }],
    });

    let releaseFirst!: () => void;
    const firstUpdateGate = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });

    const firstUpdate = (harness as any).updateState(async (state: Record<string, unknown>) => {
      await firstUpdateGate;
      const tasks = state.tasks as TaskItemSnapshot[];
      const updatedTasks = tasks.map(task =>
        task.id === 'tests' ? { ...task, status: 'in_progress' as const } : task,
      );
      return { updates: { tasks: updatedTasks }, result: updatedTasks };
    });

    const secondUpdate = (harness as any).updateState((state: Record<string, unknown>) => {
      const tasks = state.tasks as TaskItemSnapshot[];
      expect(tasks[0]!.status).toBe('in_progress');
      const updatedTasks = tasks.map(task => (task.id === 'tests' ? { ...task, status: 'completed' as const } : task));
      return { updates: { tasks: updatedTasks }, result: updatedTasks };
    });

    releaseFirst();
    await Promise.all([firstUpdate, secondUpdate]);

    expect(harness.getState().tasks).toEqual([
      { id: 'tests', content: 'Write tests', status: 'completed', activeForm: 'Writing tests' },
    ]);
  });

  it('serializes direct setState calls with queued state transactions', async () => {
    let releaseValidation!: () => void;
    const validationGate = new Promise<void>(resolve => {
      releaseValidation = resolve;
    });
    let validationCount = 0;

    const harness = new Harness<Record<string, unknown>>({
      id: 'test-harness',
      storage: new InMemoryStore(),
      stateSchema: z
        .object({
          tasks: z.array(z.unknown()).optional(),
          marker: z.string().optional(),
        })
        .superRefine(async () => {
          validationCount++;
          if (validationCount === 1) {
            await validationGate;
          }
        }),
      modes: [
        {
          id: 'default',
          name: 'Default',
          default: true,
          agent: new Agent({
            name: 'test-agent',
            instructions: 'You are a test agent.',
            model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
          }),
        },
      ],
    });

    const setStatePromise = harness.setState({
      tasks: [{ id: 'tests', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' }],
    });
    const transactionPromise = (harness as any).updateState((state: Record<string, unknown>) => {
      expect(state.tasks).toEqual([
        { id: 'tests', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' },
      ]);
      return { updates: { marker: 'after-set-state' }, result: undefined };
    });

    releaseValidation();
    await Promise.all([setStatePromise, transactionPromise]);

    expect(harness.getState()).toMatchObject({
      tasks: [{ id: 'tests', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' }],
      marker: 'after-set-state',
    });
  });
});

describe('task tool permissions', () => {
  it('removes denied built-in and configured harness tools even when yolo is enabled', async () => {
    const harness = new Harness<Record<string, unknown>>({
      id: 'test-harness',
      storage: new InMemoryStore(),
      initialState: {
        yolo: true,
        permissionRules: {
          categories: {},
          tools: {
            task_write: 'deny',
            task_update: 'deny',
            custom_tool: 'deny',
          },
        },
      },
      tools: {
        custom_tool: {
          description: 'custom',
          execute: async () => ({ ok: true }),
        },
      },
      modes: [
        {
          id: 'default',
          name: 'Default',
          default: true,
          agent: new Agent({
            name: 'test-agent',
            instructions: 'You are a test agent.',
            model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
          }),
        },
      ],
    });

    const toolsets = await (harness as any).buildToolsets(new RequestContext());

    expect(toolsets.harnessBuiltIn.task_write).toBeUndefined();
    expect(toolsets.harnessBuiltIn.task_update).toBeUndefined();
    expect(toolsets.harnessBuiltIn.task_complete).toBeDefined();
    expect(toolsets.harness.custom_tool).toBeUndefined();
    expect((harness as any).resolveToolApproval('task_update')).toBe('deny');
    expect((harness as any).resolveToolApproval('task_complete')).toBe('allow');
  });
});

describe('taskWriteTool', () => {
  it('rejects writes without harness context', async () => {
    const result = await (taskWriteTool as any).execute(
      {
        tasks: [{ content: 'Write tests', status: 'pending', activeForm: 'Writing tests' }],
      },
      {},
    );

    expect(result).toEqual({
      content: 'Unable to update task list (no harness context)',
      tasks: [],
      isError: true,
    });
  });

  it('assigns ids to tasks that omit them', async () => {
    const ctx = createTaskContext();

    const result = await (taskWriteTool as any).execute(
      {
        tasks: [{ content: 'Write tests', status: 'pending', activeForm: 'Writing tests' }],
      },
      { requestContext: ctx.requestContext },
    );

    expect(result.isError).toBe(false);
    expect(ctx.state.tasks).toHaveLength(1);
    expect(ctx.state.tasks[0]!.id).toBe('task_write_tests');
    expect(ctx.events).toEqual([{ type: 'task_updated', tasks: ctx.state.tasks }]);
    expect(result.content).toContain(`${ctx.state.tasks[0]!.id}: Write tests`);
  });

  it('preserves provided ids', async () => {
    const ctx = createTaskContext();

    await (taskWriteTool as any).execute(
      {
        tasks: [{ id: 'tests', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' }],
      },
      { requestContext: ctx.requestContext },
    );

    expect(ctx.state.tasks).toEqual([
      { id: 'tests', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' },
    ]);
  });

  it('reuses existing ids when replacing a list with matching task content', async () => {
    const ctx = createTaskContext([
      { id: 'tests', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' },
    ]);

    await (taskWriteTool as any).execute(
      {
        tasks: [{ content: 'Write tests', status: 'in_progress', activeForm: 'Writing tests' }],
      },
      { requestContext: ctx.requestContext },
    );

    expect(ctx.state.tasks).toEqual([
      { id: 'tests', content: 'Write tests', status: 'in_progress', activeForm: 'Writing tests' },
    ]);
  });

  it('does not reuse existing ids by position when omitted during a content change', async () => {
    const ctx = createTaskContext([
      { id: 'investigate', content: 'Investigate issue', status: 'completed', activeForm: 'Investigating issue' },
      { id: 'tests', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' },
    ]);

    await (taskWriteTool as any).execute(
      {
        tasks: [
          { content: 'Investigate issue', status: 'completed', activeForm: 'Investigating issue' },
          { content: 'Add regression tests', status: 'in_progress', activeForm: 'Adding regression tests' },
        ],
      },
      { requestContext: ctx.requestContext },
    );

    expect(ctx.state.tasks).toEqual([
      { id: 'investigate', content: 'Investigate issue', status: 'completed', activeForm: 'Investigating issue' },
      {
        id: 'task_add_regression_tests',
        content: 'Add regression tests',
        status: 'in_progress',
        activeForm: 'Adding regression tests',
      },
    ]);
  });

  it('keeps matching ids stable when a new task is inserted before existing tasks', async () => {
    const ctx = createTaskContext([
      { id: 'a', content: 'Review code', status: 'pending', activeForm: 'Reviewing code' },
      { id: 'b', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' },
    ]);

    await (taskWriteTool as any).execute(
      {
        tasks: [
          { content: 'Update docs', status: 'pending', activeForm: 'Updating docs' },
          { content: 'Review code', status: 'pending', activeForm: 'Reviewing code' },
          { content: 'Write tests', status: 'pending', activeForm: 'Writing tests' },
        ],
      },
      { requestContext: ctx.requestContext },
    );

    expect(ctx.state.tasks).toEqual([
      { id: 'task_update_docs', content: 'Update docs', status: 'pending', activeForm: 'Updating docs' },
      { id: 'a', content: 'Review code', status: 'pending', activeForm: 'Reviewing code' },
      { id: 'b', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' },
    ]);
  });

  it('rejects task lists with multiple in-progress tasks', async () => {
    const initialTasks = [
      { id: 'existing', content: 'Existing task', status: 'pending' as const, activeForm: 'Tracking existing task' },
    ];
    const ctx = createTaskContext(initialTasks);

    const result = await (taskWriteTool as any).execute(
      {
        tasks: [
          { id: 'one', content: 'First task', status: 'in_progress', activeForm: 'Doing first task' },
          { id: 'two', content: 'Second task', status: 'in_progress', activeForm: 'Doing second task' },
        ],
      },
      { requestContext: ctx.requestContext },
    );

    expect(result).toEqual({
      content: 'Only one task can be in_progress at a time.',
      tasks: initialTasks,
      isError: true,
    });
    expect(ctx.state.tasks).toBe(initialTasks);
    expect(ctx.setState).not.toHaveBeenCalled();
    expect(ctx.events).toEqual([]);
  });

  it('returns deterministic omitted ids that still resolve if an older schema strips ids', async () => {
    const ctx = createTaskContext();
    ctx.setState.mockImplementation(async updates => {
      Object.assign(ctx.state, {
        tasks: updates.tasks.map(({ id: _id, ...task }: TaskItemSnapshot) => task),
      });
    });

    const writeResult = await (taskWriteTool as any).execute(
      {
        tasks: [{ content: 'Write tests', status: 'pending', activeForm: 'Writing tests' }],
      },
      { requestContext: ctx.requestContext },
    );

    expect(writeResult.isError).toBe(false);
    expect(writeResult.tasks[0]!.id).toBe('task_write_tests');
    expect(ctx.state.tasks).toEqual([{ content: 'Write tests', status: 'pending', activeForm: 'Writing tests' }]);

    const updateResult = await (taskUpdateTool as any).execute(
      {
        id: 'task_write_tests',
        status: 'in_progress',
      },
      { requestContext: ctx.requestContext },
    );

    expect(updateResult.isError).toBe(false);
    expect(updateResult.tasks[0]).toMatchObject({
      id: 'task_write_tests',
      content: 'Write tests',
      status: 'in_progress',
    });
  });
});

describe('taskUpdateTool', () => {
  it('patches one task by id and emits the full task list', async () => {
    const ctx = createTaskContext([
      { id: 'investigate', content: 'Investigate issue', status: 'completed', activeForm: 'Investigating issue' },
      { id: 'tests', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' },
    ]);

    const result = await (taskUpdateTool as any).execute(
      {
        id: 'tests',
        status: 'in_progress',
      },
      { requestContext: ctx.requestContext },
    );

    expect(result.isError).toBe(false);
    expect(ctx.state.tasks).toEqual([
      { id: 'investigate', content: 'Investigate issue', status: 'completed', activeForm: 'Investigating issue' },
      { id: 'tests', content: 'Write tests', status: 'in_progress', activeForm: 'Writing tests' },
    ]);
    expect(ctx.events).toEqual([{ type: 'task_updated', tasks: ctx.state.tasks }]);
  });

  it('rejects an unknown task id without changing state', async () => {
    const initialTasks = [
      { id: 'tests', content: 'Write tests', status: 'pending' as const, activeForm: 'Writing tests' },
    ];
    const ctx = createTaskContext(initialTasks);

    const result = await (taskUpdateTool as any).execute(
      {
        id: 'missing',
        status: 'completed',
      },
      { requestContext: ctx.requestContext },
    );

    expect(result).toMatchObject({
      content: expect.stringContaining('Task not found: missing'),
      tasks: initialTasks,
      isError: true,
    });
    expect(ctx.state.tasks).toBe(initialTasks);
    expect(ctx.setState).not.toHaveBeenCalled();
    expect(ctx.events).toEqual([]);
  });

  it('rejects updates that would create multiple in-progress tasks', async () => {
    const initialTasks = [
      {
        id: 'investigate',
        content: 'Investigate issue',
        status: 'in_progress' as const,
        activeForm: 'Investigating issue',
      },
      { id: 'tests', content: 'Write tests', status: 'pending' as const, activeForm: 'Writing tests' },
    ];
    const ctx = createTaskContext(initialTasks);

    const result = await (taskUpdateTool as any).execute(
      {
        id: 'tests',
        status: 'in_progress',
      },
      { requestContext: ctx.requestContext },
    );

    expect(result).toEqual({
      content: 'Only one task can be in_progress at a time.',
      tasks: initialTasks,
      isError: true,
    });
    expect(ctx.state.tasks).toBe(initialTasks);
    expect(ctx.setState).not.toHaveBeenCalled();
    expect(ctx.events).toEqual([]);
  });
});

describe('taskCompleteTool', () => {
  it('marks only the matching task completed and preserves order', async () => {
    const ctx = createTaskContext([
      { id: 'investigate', content: 'Investigate issue', status: 'in_progress', activeForm: 'Investigating issue' },
      { id: 'tests', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' },
    ]);

    const result = await (taskCompleteTool as any).execute(
      {
        id: 'investigate',
      },
      { requestContext: ctx.requestContext },
    );

    expect(result.isError).toBe(false);
    expect(ctx.state.tasks).toEqual([
      { id: 'investigate', content: 'Investigate issue', status: 'completed', activeForm: 'Investigating issue' },
      { id: 'tests', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' },
    ]);
  });
});

describe('taskCheckTool', () => {
  it('waits for queued task mutations before reading task state', async () => {
    const harness = createHarness();
    await harness.setState({
      tasks: [{ id: 'tests', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' }],
    });
    const requestContext = await (harness as any).buildRequestContext();

    let releaseFirst!: () => void;
    const firstUpdateGate = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });

    const firstUpdate = (harness as any).updateState(async (state: Record<string, unknown>) => {
      await firstUpdateGate;
      const tasks = state.tasks as TaskItemSnapshot[];
      const updatedTasks = tasks.map(task => (task.id === 'tests' ? { ...task, status: 'completed' as const } : task));
      return { updates: { tasks: updatedTasks }, result: updatedTasks };
    });

    const checkResultPromise = (taskCheckTool as any).execute({}, { requestContext });

    releaseFirst();
    await firstUpdate;
    const checkResult = await checkResultPromise;

    expect(checkResult.summary).toMatchObject({
      completed: 1,
      incomplete: 0,
      allCompleted: true,
    });
    expect(checkResult.tasks).toEqual([
      { id: 'tests', content: 'Write tests', status: 'completed', activeForm: 'Writing tests' },
    ]);
  });

  it('returns structured summary fields and incomplete task ids', async () => {
    const ctx = createTaskContext([
      { id: 'investigate', content: 'Investigate issue', status: 'in_progress', activeForm: 'Investigating issue' },
      { id: 'tests', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' },
    ]);

    const result = await (taskCheckTool as any).execute({}, { requestContext: ctx.requestContext });

    expect(result).toMatchObject({
      content: expect.stringContaining('investigate: Investigate issue'),
      tasks: ctx.state.tasks,
      summary: {
        total: 2,
        completed: 0,
        inProgress: 1,
        pending: 1,
        incomplete: 2,
        hasTasks: true,
        allCompleted: false,
      },
      incompleteTasks: ctx.state.tasks,
      isError: false,
    });
    expect(result.content).toContain('All tasks completed: NO');
    expect(result.content).toContain('tests: Write tests');
  });

  it('returns an empty structured summary when no tasks are tracked', async () => {
    const ctx = createTaskContext();

    const result = await (taskCheckTool as any).execute({}, { requestContext: ctx.requestContext });

    expect(result).toMatchObject({
      content: expect.stringContaining('No tasks found'),
      tasks: [],
      summary: {
        total: 0,
        completed: 0,
        inProgress: 0,
        pending: 0,
        incomplete: 0,
        hasTasks: false,
        allCompleted: false,
      },
      incompleteTasks: [],
      isError: false,
    });
  });

  it('returns allCompleted only when tracked tasks are completed', async () => {
    const ctx = createTaskContext([
      { id: 'investigate', content: 'Investigate issue', status: 'completed', activeForm: 'Investigating issue' },
      { id: 'tests', content: 'Write tests', status: 'completed', activeForm: 'Writing tests' },
    ]);

    const result = await (taskCheckTool as any).execute({}, { requestContext: ctx.requestContext });

    expect(result).toMatchObject({
      content: expect.stringContaining('All tasks completed: YES'),
      tasks: ctx.state.tasks,
      summary: {
        total: 2,
        completed: 2,
        inProgress: 0,
        pending: 0,
        incomplete: 0,
        hasTasks: true,
        allCompleted: true,
      },
      incompleteTasks: [],
      isError: false,
    });
  });

  it('returns structured error fields when harness context is missing', async () => {
    const result = await (taskCheckTool as any).execute({}, {});

    expect(result).toEqual({
      content: 'Unable to access task list (no harness context)',
      tasks: [],
      summary: {
        total: 0,
        completed: 0,
        inProgress: 0,
        pending: 0,
        incomplete: 0,
        hasTasks: false,
        allCompleted: false,
      },
      incompleteTasks: [],
      isError: true,
    });
  });

  it('returns unique deterministic ids for legacy tasks with colliding slugs', async () => {
    const ctx = createTaskContext([
      { content: '!!!', status: 'pending', activeForm: 'Tracking first task' },
      { content: '???', status: 'pending', activeForm: 'Tracking second task' },
    ]);

    const result = await (taskCheckTool as any).execute({}, { requestContext: ctx.requestContext });

    expect(result.tasks.map((task: TaskItemSnapshot) => task.id)).toEqual(['task_item', 'task_item_2']);
  });
});
