import type { Mastra } from '../../mastra';
import type { ComputeStateSignalArgs, ComputeStateSignalResult } from '../../processors/index';
import type { TaskRecord } from '../../storage/domains/tasks/base';
import { getTasksFromRequestContext, TASKS_STATE_ID } from './task-tools';
import type { TaskItemSnapshot } from './task-tools';

// Typed in terms of the storage domain's `TaskRecord` (see the matching note in
// task-tools.ts): the processor reads the durable list and projects it as
// `TaskItemSnapshot`, so this assignment enforces that the two shapes stay
// structurally identical.
type ResolvedTaskStore = {
  getTasks(threadId: string): Promise<TaskRecord[]>;
};

function isTaskStore(value: unknown): value is ResolvedTaskStore {
  return !!value && typeof (value as ResolvedTaskStore).getTasks === 'function';
}

// =============================================================================
// Task state processor
// =============================================================================
//
// Carries the agent's task list on the agent state-signal lane (`stateId:
// 'tasks'`). This keeps the task list:
//
//  - **cache-aware**: the snapshot supersedes by cacheKey rather than being
//    appended to the cached system-prompt prefix, so task updates do not
//    invalidate the prompt cache prefix.
//  - **OM-aware**: when observational-memory truncation drops the snapshot from
//    the window (`contextWindow.hasSnapshot === false`), the snapshot is
//    re-emitted so the agent never loses track of its tasks.
//
// The task list itself lives in the thread-scoped `tasks` storage domain (the
// TaskStore); this processor projects it onto the model context. State signals
// require a memory-backed thread; the runtime enforces this. The task tools
// no-op when the run is not memory backed, so the processor only ever sees task
// state on memory-backed runs.

// Renders the inner lines of the task list. The state-signal framework wraps
// (and XML-escapes) this string inside the signal's `tagName`
// (`current-task-list`), so this returns only the body — wrapping it in the tag
// here would double-wrap and escape the markup the model sees. An empty list
// returns an empty string so the framework emits `<current-task-list count="0" />`.
function renderTaskList(tasks: TaskItemSnapshot[]): string {
  if (tasks.length === 0) return '';
  const lines = tasks.map(task => {
    const icon = task.status === 'completed' ? '✓' : task.status === 'in_progress' ? '▸' : '○';
    return `  ${icon} [${task.status}] {id: ${task.id}} ${task.content}`;
  });
  return `\n${lines.join('\n')}\n`;
}

function getTasksFromSnapshot(snapshot: ComputeStateSignalArgs['lastSnapshot']): TaskItemSnapshot[] {
  const value = snapshot?.metadata?.value as { tasks?: unknown } | undefined;
  const tasks = value?.tasks;
  if (Array.isArray(tasks)) return tasks as TaskItemSnapshot[];
  return [];
}

function stableTasksCacheKey(tasks: TaskItemSnapshot[]): string {
  const fingerprint = tasks.map(t => `${t.id}:${t.status}:${t.content}:${t.activeForm}`).join('|');
  return `tasks:${fingerprint}`;
}

function tasksEqual(a: TaskItemSnapshot[], b: TaskItemSnapshot[]): boolean {
  return stableTasksCacheKey(a) === stableTasksCacheKey(b);
}

/**
 * Input processor that publishes the agent's task list as a state signal.
 *
 * Add it to an agent's `inputProcessors` alongside the task tools so the task
 * list is carried across turns and survives observational-memory truncation.
 */
export class TaskStateProcessor {
  readonly id = 'task-state';
  readonly stateId = TASKS_STATE_ID;

  /**
   * The Mastra instance this processor is registered with, used to resolve the
   * thread-scoped task store. Set by the agent/Mastra runtime via
   * `__registerMastra`.
   *
   * We implement this hook inline rather than extending `BaseProcessor`: a
   * *value* import of `BaseProcessor` from `processors/index` pulls that module's
   * runtime graph, which forms an initialization cycle through this tools module.
   * At the test entry point that surfaces as `TypeError: Class extends value
   * undefined` (BaseProcessor is not yet initialized when this class evaluates).
   * Implementing the (structurally trivial) hook here keeps all imports from
   * `processors/index` type-only, so there is no runtime edge and no cycle.
   */
  protected mastra?: Mastra<any, any, any, any, any, any, any, any, any, any>;

  __registerMastra(mastra: Mastra<any, any, any, any, any, any, any, any, any, any>): void {
    this.mastra = mastra;
  }

  private async resolveTaskStore(): Promise<ResolvedTaskStore | undefined> {
    const store = await this.mastra?.getStorage?.()?.getStore('tasks');
    return isTaskStore(store) ? store : undefined;
  }

  async computeStateSignal(args: ComputeStateSignalArgs): Promise<ComputeStateSignalResult> {
    const previousTasks = getTasksFromSnapshot(args.lastSnapshot);

    // Current task list for this turn: the working list a task tool surfaced on
    // the shared RequestContext this step (reflects the latest mutation), else
    // the durable TaskStore for the thread, else the last snapshot.
    const carried = getTasksFromRequestContext(args.requestContext);
    let currentTasks = carried;
    if (currentTasks === undefined) {
      const store = await this.resolveTaskStore();
      currentTasks = store ? await store.getTasks(args.threadId) : previousTasks;
    }

    // Nothing to track yet.
    if (currentTasks.length === 0 && previousTasks.length === 0) return;

    const snapshotMissing = Boolean(args.lastSnapshot) && !args.contextWindow.hasSnapshot;
    const changed = !tasksEqual(previousTasks, currentTasks);

    // No change and the window still has the snapshot: emit nothing so the
    // cached prefix and the active window stay stable.
    if (!changed && !snapshotMissing && args.contextWindow.hasSnapshot) return;

    return {
      id: TASKS_STATE_ID,
      cacheKey: stableTasksCacheKey(currentTasks),
      mode: 'snapshot',
      // `current-task-list` is the signal's own tag (mirroring the wrapper that
      // used to be injected into the system prompt). The framework wraps and
      // escapes `contents` inside this tag, so `renderTaskList` returns only the
      // inner lines — no inline tag here, or the model would see double-wrapped,
      // XML-escaped markup.
      tagName: 'current-task-list',
      contents: renderTaskList(currentTasks),
      value: { tasks: currentTasks },
      attributes: {
        count: currentTasks.length,
      },
      metadata: {
        value: { tasks: currentTasks },
      },
    };
  }
}
