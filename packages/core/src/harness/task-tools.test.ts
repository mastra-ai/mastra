import { describe, expect, it } from 'vitest';
import z from 'zod';

import { Agent } from '../agent';
import { RequestContext } from '../request-context';
import { InMemoryStore } from '../storage/mock';

import { Harness } from './harness';
import { assignTaskIds, taskWriteTool } from './tools';
import type { HarnessEvent } from './types';

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

// Generic harness state serialization. Tasks are no longer a harness session
// state source of truth (they live on the agent state-signal lane), so these
// tests exercise `updateState`/`setState` ordering with neutral state keys.
describe('harness state transactions', () => {
  it('serializes state updates against the latest committed state', async () => {
    const harness = createHarness();
    await harness.setState({ counter: 0 });

    let releaseFirst!: () => void;
    const firstUpdateGate = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });

    const firstUpdate = (harness as any).updateState(async (state: Record<string, unknown>) => {
      await firstUpdateGate;
      const next = (state.counter as number) + 1;
      return { updates: { counter: next }, result: next };
    });

    const secondUpdate = (harness as any).updateState((state: Record<string, unknown>) => {
      expect(state.counter).toBe(1);
      const next = (state.counter as number) + 1;
      return { updates: { counter: next }, result: next };
    });

    releaseFirst();
    await Promise.all([firstUpdate, secondUpdate]);

    expect(harness.getState().counter).toBe(2);
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
          seed: z.string().optional(),
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

    const setStatePromise = harness.setState({ seed: 'initial' });
    const transactionPromise = (harness as any).updateState((state: Record<string, unknown>) => {
      expect(state.seed).toBe('initial');
      return { updates: { marker: 'after-set-state' }, result: undefined };
    });

    releaseValidation();
    await Promise.all([setStatePromise, transactionPromise]);

    expect(harness.getState()).toMatchObject({
      seed: 'initial',
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

describe('task tool display bridge', () => {
  it('emits task_updated and updates the display snapshot when a task tool runs with a harness context', async () => {
    const harness = createHarness();

    const events: HarnessEvent[] = [];
    harness.subscribe(event => events.push(event));

    // Real harness request context — wires emitEvent -> harness.emit, the
    // display-only bridge the agnostic task tools call when present.
    const requestContext: RequestContext = await (harness as any).buildRequestContext();

    // Storage with the always-wired threadState domain so the tool can persist.
    const storage = new InMemoryStore();

    const result = await (taskWriteTool as any).execute(
      { tasks: [{ content: 'Write tests', status: 'pending', activeForm: 'Writing tests' }] },
      {
        requestContext,
        mastra: { getStorage: () => storage },
        // Memory-backed agent context so the tool is not gated to a no-op.
        agent: { threadId: 'thread-1', resourceId: 'resource-1', messages: [] },
      },
    );

    expect(result.isError).toBe(false);

    const taskUpdated = events.filter(event => event.type === 'task_updated');
    expect(taskUpdated).toHaveLength(1);
    expect((taskUpdated[0] as Extract<HarnessEvent, { type: 'task_updated' }>).tasks).toEqual([
      { id: 'task_write_tests', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' },
    ]);

    // The harness display snapshot tracks the emitted task list (display-only;
    // the task list itself lives on the agent state-signal lane, not in state).
    expect(harness.getDisplayState().tasks).toEqual([
      { id: 'task_write_tests', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' },
    ]);

    // Tasks are no longer mirrored into harness session state.
    expect(harness.getState().tasks).toBeUndefined();
  });
});
