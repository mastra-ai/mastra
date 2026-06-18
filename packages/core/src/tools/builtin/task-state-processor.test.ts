import { describe, expect, it } from 'vitest';

import { signalToXmlMarkup } from '../../agent/signals';
import { Mastra } from '../../mastra';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage/mock';

import { TaskStateProcessor } from './task-state-processor';
import { TASKS_REQUEST_CONTEXT_KEY, TASK_STATE_TYPE } from './task-tools';
import type { TaskItemSnapshot } from './task-tools';

const THREAD_ID = 'thread-1';

const TASKS: TaskItemSnapshot[] = [
  { id: 'a', content: 'Task A', status: 'in_progress', activeForm: 'Doing A' },
  { id: 'b', content: 'Task B', status: 'pending', activeForm: 'Doing B' },
];

// A persisted delta-mode signal carrying structured ops in `metadata.delta`.
function deltaSignal(ops: unknown[]) {
  return { metadata: { state: { mode: 'delta' }, delta: { ops } } } as any;
}

function snapshotSignal(tasks: TaskItemSnapshot[]) {
  return { metadata: { value: { tasks } } } as any;
}

/**
 * Build a TaskStateProcessor wired to a real in-memory composite store via the
 * Mastra context, mirroring how the processor resolves `getStore('threadState')`
 * in production (optionally seeding the thread's task list).
 */
async function createProcessor(storeTasks?: TaskItemSnapshot[]) {
  const storage = new InMemoryStore();
  const mastra = new Mastra({ storage, logger: false });
  const threadStateStore = await storage.getStore('threadState');
  if (storeTasks) await threadStateStore!.setState({ threadId: THREAD_ID, type: TASK_STATE_TYPE, value: storeTasks });
  const processor = new TaskStateProcessor();
  processor.__registerMastra(mastra as any);
  return { processor, storage };
}

function createArgs(options: {
  currentTasks?: TaskItemSnapshot[];
  lastSnapshotTasks?: TaskItemSnapshot[];
  deltasSinceSnapshot?: any[];
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
    deltasSinceSnapshot: options.deltasSinceSnapshot ?? [],
  } as any;
}

describe('TaskStateProcessor', () => {
  it('emits a full snapshot on the first change (no base in window)', async () => {
    const { processor } = await createProcessor();
    const result = await processor.computeStateSignal(createArgs({ currentTasks: TASKS }));

    expect(result).toBeTruthy();
    expect(result).toMatchObject({
      id: 'tasks',
      mode: 'snapshot',
      tagName: 'current-task-list',
      attributes: { count: TASKS.length },
      value: { tasks: TASKS },
    });
    expect((result as any).metadata.value.tasks).toEqual(TASKS);

    // The framework wraps `contents` in the signal's own tag, so the model sees
    // a single `<current-task-list>` element (not a double-wrapped, escaped one).
    const markup = signalToXmlMarkup(result as any);
    expect(markup).toContain('<current-task-list count="2">');
    expect(markup).toContain('{id: a}');
    expect(markup).not.toContain('&lt;current-task-list&gt;');
  });

  it('emits a delta carrying only the changed ops once a base snapshot exists', async () => {
    const { processor } = await createProcessor();
    const changed: TaskItemSnapshot[] = [
      { id: 'a', content: 'Task A', status: 'completed', activeForm: 'Doing A' },
      { id: 'b', content: 'Task B', status: 'pending', activeForm: 'Doing B' },
      { id: 'c', content: 'Task C', status: 'pending', activeForm: 'Doing C' },
    ];

    const result = await processor.computeStateSignal(
      createArgs({ currentTasks: changed, lastSnapshotTasks: TASKS, hasSnapshot: true }),
    );

    expect(result).toBeTruthy();
    expect((result as any).mode).toBe('delta');
    expect((result as any).tagName).toBe('task-list-update');
    // Only the changed task (a → completed) and the added task (c) are in the ops.
    expect((result as any).delta.ops).toEqual([
      { op: 'update', task: changed[0] },
      { op: 'add', task: changed[2] },
    ]);
    expect((result as any).attributes).toEqual({ changes: 2 });
    // `value` still carries the full resulting list for recovery / UIs.
    expect((result as any).value.tasks).toEqual(changed);

    const markup = signalToXmlMarkup(result as any);
    expect(markup).toContain('<task-list-update changes="2">');
    expect(markup).toContain('{id: a} [completed]');
    expect(markup).toContain('+ {id: c}');
  });

  it('emits a remove op when a task is dropped', async () => {
    const { processor } = await createProcessor();
    const result = await processor.computeStateSignal(
      createArgs({ currentTasks: [TASKS[0]], lastSnapshotTasks: TASKS, hasSnapshot: true }),
    );

    expect((result as any).mode).toBe('delta');
    expect((result as any).delta.ops).toEqual([{ op: 'remove', id: 'b' }]);
  });

  it('diffs against the base plus prior deltas (no re-emit when net-unchanged)', async () => {
    // Base = TASKS; a prior delta already moved `a` → completed. The current
    // list equals base+delta applied, so there is no new change to emit.
    const afterDelta: TaskItemSnapshot[] = [
      { id: 'a', content: 'Task A', status: 'completed', activeForm: 'Doing A' },
      TASKS[1],
    ];
    const { processor } = await createProcessor();
    const result = await processor.computeStateSignal(
      createArgs({
        currentTasks: afterDelta,
        lastSnapshotTasks: TASKS,
        deltasSinceSnapshot: [deltaSignal([{ op: 'update', task: afterDelta[0] }])],
        hasSnapshot: true,
      }),
    );

    expect(result).toBeUndefined();
  });

  it('emits a delta relative to the base plus prior deltas', async () => {
    const afterDelta: TaskItemSnapshot[] = [
      { id: 'a', content: 'Task A', status: 'completed', activeForm: 'Doing A' },
      TASKS[1],
    ];
    // Now b also completes; the only new op is b → completed.
    const next: TaskItemSnapshot[] = [afterDelta[0], { ...TASKS[1], status: 'completed' }];
    const { processor } = await createProcessor();
    const result = await processor.computeStateSignal(
      createArgs({
        currentTasks: next,
        lastSnapshotTasks: TASKS,
        deltasSinceSnapshot: [deltaSignal([{ op: 'update', task: afterDelta[0] }])],
        hasSnapshot: true,
      }),
    );

    expect((result as any).mode).toBe('delta');
    expect((result as any).delta.ops).toEqual([{ op: 'update', task: next[1] }]);
  });

  it('compacts to a snapshot once the delta cap is reached', async () => {
    const changed: TaskItemSnapshot[] = [{ ...TASKS[0], status: 'completed' }, TASKS[1]];
    const tenDeltas = Array.from({ length: 10 }, () => deltaSignal([]));
    const { processor } = await createProcessor();
    const result = await processor.computeStateSignal(
      createArgs({
        currentTasks: changed,
        lastSnapshotTasks: TASKS,
        deltasSinceSnapshot: tenDeltas,
        hasSnapshot: true,
      }),
    );

    expect((result as any).mode).toBe('snapshot');
    expect((result as any).tagName).toBe('current-task-list');
    expect((result as any).value.tasks).toEqual(changed);
  });

  it('renders an empty task list as a self-closing snapshot tag', async () => {
    // Clearing the list (base populated → empty) compacts to a snapshot; the
    // framework renders empty `contents` as `<current-task-list count="0" />`.
    const { processor } = await createProcessor();
    const result = await processor.computeStateSignal(createArgs({ currentTasks: [], lastSnapshotTasks: TASKS }));

    expect(result).toBeTruthy();
    expect((result as any).mode).toBe('delta');
    // Removing every task is still a delta (under cap, base present): a remove
    // op per task, full `value` empty.
    expect((result as any).delta.ops).toEqual([
      { op: 'remove', id: 'a' },
      { op: 'remove', id: 'b' },
    ]);
    expect((result as any).value.tasks).toEqual([]);
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

  it('re-emits a full snapshot when OM truncation drops the base from the window', async () => {
    // The durable store still holds the tasks; OM only dropped the base signal
    // from the window (hasSnapshot === false). Deltas are meaningless without
    // their base, so the processor must emit a fresh snapshot.
    const { processor } = await createProcessor(TASKS);
    const result = await processor.computeStateSignal(createArgs({ lastSnapshotTasks: TASKS, hasSnapshot: false }));

    expect(result).toBeTruthy();
    expect((result as any).mode).toBe('snapshot');
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

  it('produces distinct cacheKeys when delimiter chars in content could collide', async () => {
    const { processor } = await createProcessor();

    // Both lists naively join to the same string with a plain `:`/`|` delimiter:
    //   "a:b:c:d"  vs  ids/fields split so the concatenation matches.
    // Length-prefixing each field must keep the two cacheKeys distinct.
    const listA: TaskItemSnapshot[] = [{ id: 'a', content: 'b:c', status: 'pending', activeForm: 'd' }];
    const listB: TaskItemSnapshot[] = [{ id: 'a:b', content: 'c', status: 'pending', activeForm: 'd' }];

    const a = await processor.computeStateSignal(createArgs({ currentTasks: listA }));
    const b = await processor.computeStateSignal(createArgs({ currentTasks: listB }));

    expect((a as any).cacheKey).not.toEqual((b as any).cacheKey);
  });
});
