import { describe, expect, it } from 'vitest';

import { Mastra } from '../../mastra';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage/mock';

import { TaskStateProcessor } from './task-state-processor';
import { TASKS_REQUEST_CONTEXT_KEY } from './task-tools';
import type { TaskItemSnapshot } from './task-tools';

const THREAD_ID = 'thread-1';

const TASKS: TaskItemSnapshot[] = [
  { id: 'a', content: 'Task A', status: 'in_progress', activeForm: 'Doing A' },
  { id: 'b', content: 'Task B', status: 'pending', activeForm: 'Doing B' },
];

function snapshotSignal(tasks: TaskItemSnapshot[]) {
  return {
    metadata: { value: { tasks } },
  } as any;
}

/**
 * Build a TaskStateProcessor wired to a real in-memory composite store via the
 * Mastra context, mirroring how the processor resolves `getStore('tasks')` in
 * production (optionally seeding the thread's task list).
 */
async function createProcessor(storeTasks?: TaskItemSnapshot[]) {
  const storage = new InMemoryStore();
  const mastra = new Mastra({ storage, logger: false });
  const tasksStore = await storage.getStore('tasks');
  if (storeTasks) await tasksStore!.setTasks(THREAD_ID, storeTasks);
  const processor = new TaskStateProcessor();
  processor.__registerMastra(mastra as any);
  return { processor, storage };
}

function createArgs(options: {
  currentTasks?: TaskItemSnapshot[];
  lastSnapshotTasks?: TaskItemSnapshot[];
  hasSnapshot?: boolean;
}) {
  const requestContext = new RequestContext();
  if (options.currentTasks) {
    requestContext.set(TASKS_REQUEST_CONTEXT_KEY, options.currentTasks);
  }
  return {
    threadId: THREAD_ID,
    resourceId: 'resource-1',
    messages: [],
    requestContext,
    contextWindow: { hasSnapshot: options.hasSnapshot ?? true },
    lastSnapshot: options.lastSnapshotTasks ? snapshotSignal(options.lastSnapshotTasks) : undefined,
    activeStateSignals: [],
    deltasSinceSnapshot: [],
  } as any;
}

describe('TaskStateProcessor', () => {
  it('emits a snapshot when the task list changes', async () => {
    const { processor } = await createProcessor();
    const result = await processor.computeStateSignal(createArgs({ currentTasks: TASKS }));

    expect(result).toBeTruthy();
    expect(result).toMatchObject({
      id: 'tasks',
      mode: 'snapshot',
      tagName: 'state',
      value: { tasks: TASKS },
    });
    expect((result as any).metadata.value.tasks).toEqual(TASKS);
    expect((result as any).contents).toContain('<current-task-list>');
    expect((result as any).contents).toContain('{id: a}');
  });

  it('reads the current list from the store when no task tool ran this turn', async () => {
    // No within-turn RequestContext carry; the processor falls back to the store.
    const { processor } = await createProcessor(TASKS);
    const result = await processor.computeStateSignal(createArgs({}));

    expect(result).toBeTruthy();
    expect((result as any).value.tasks).toEqual(TASKS);
  });

  it('returns undefined when the list is unchanged and the window still has the snapshot', async () => {
    const { processor } = await createProcessor(TASKS);
    const result = await processor.computeStateSignal(
      createArgs({ currentTasks: TASKS, lastSnapshotTasks: TASKS, hasSnapshot: true }),
    );

    expect(result).toBeUndefined();
  });

  it('re-emits the snapshot when OM truncation drops it from the window', async () => {
    // The durable store still holds the tasks; OM only dropped the signal
    // message from the window (hasSnapshot === false), so the processor must
    // re-emit so the agent never loses its task list.
    const { processor } = await createProcessor(TASKS);
    const result = await processor.computeStateSignal(
      // No working list this turn (no task tool ran), prior snapshot exists but
      // the window no longer contains it.
      createArgs({ lastSnapshotTasks: TASKS, hasSnapshot: false }),
    );

    expect(result).toBeTruthy();
    expect((result as any).value.tasks).toEqual(TASKS);
  });

  it('returns undefined when there are no tasks at all', async () => {
    const { processor } = await createProcessor();
    const result = await processor.computeStateSignal(createArgs({}));

    expect(result).toBeUndefined();
  });

  it('uses a cacheKey that supersedes by task content/status', async () => {
    const { processor } = await createProcessor();
    const first = await processor.computeStateSignal(createArgs({ currentTasks: TASKS }));

    const changed: TaskItemSnapshot[] = [
      { id: 'a', content: 'Task A', status: 'completed', activeForm: 'Doing A' },
      { id: 'b', content: 'Task B', status: 'in_progress', activeForm: 'Doing B' },
    ];
    const second = await processor.computeStateSignal(
      createArgs({ currentTasks: changed, lastSnapshotTasks: TASKS, hasSnapshot: true }),
    );

    expect((first as any).cacheKey).not.toEqual((second as any).cacheKey);
    expect(second).toBeTruthy();
    expect((second as any).value.tasks).toEqual(changed);
  });
});
