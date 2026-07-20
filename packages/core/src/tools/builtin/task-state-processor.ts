import type { Mastra } from '../../mastra';
import type {
  ComputeStateSignalArgs,
  ComputeStateSignalResult,
  ProcessInputArgs,
  ProcessInputResult,
} from '../../processors/index';
import type { TaskRecord } from '../../storage/domains/thread-state/base';
import { getTasksFromRequestContext, TASKS_STATE_ID, TASK_STATE_TYPE } from './task-tools';
import type { TaskItemSnapshot } from './task-tools';

// Typed in terms of the storage domain's `TaskRecord` (see the matching note in
// task-tools.ts): the processor reads the durable list and projects it as
// `TaskItemSnapshot`, so this assignment enforces that the two shapes stay
// structurally identical.
type ResolvedThreadStateStore = {
  getState<T = unknown>(args: { threadId: string; type: string }): Promise<T | undefined>;
};

function isThreadStateStore(value: unknown): value is ResolvedThreadStateStore {
  return !!value && typeof (value as ResolvedThreadStateStore).getState === 'function';
}

// =============================================================================
// Task state processor
// =============================================================================
//
// Carries the agent's task list on the agent state-signal lane (`stateId:
// 'tasks'`) using a **delta-first** projection (modelled on working memory):
//
//  - The first emission (and every compaction) is a full **snapshot**
//    (`<current-task-list>`). Subsequent mutations emit a small **delta**
//    (`<task-list-update>`) carrying only that turn's add/remove/update ops, so
//    a large list is not re-sent in full on every change.
//  - The base snapshot + each delta stay in the window as separate signal
//    messages; the model reads the base list and folds the deltas onto it. To
//    bound window growth we re-snapshot once `DELTA_SNAPSHOT_CAP` deltas have
//    accumulated (compaction).
//  - **cache-aware**: signals supersede by cacheKey rather than being appended
//    to the cached system-prompt prefix, so task updates do not invalidate it.
//  - **OM-aware**: when observational memory drops the base snapshot from the
//    window (`contextWindow.hasSnapshot === false`), a fresh snapshot is emitted
//    (deltas are meaningless without their base), so the agent never loses its
//    tasks.
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

// Re-snapshot once this many deltas have accumulated since the last snapshot.
// Pure-delta mode keeps each emission tiny, but the base snapshot + every delta
// stay in the window as separate signal messages until the next snapshot, so we
// periodically compact back to a fresh snapshot to bound window growth. Also
// re-snapshot whenever observational memory drops the base from the window
// (deltas are meaningless without their base).
const DELTA_SNAPSHOT_CAP = 10;

// A single task-list change carried on a `delta`-mode signal.
type TaskDeltaOp =
  { op: 'add'; task: TaskItemSnapshot } | { op: 'remove'; id: string } | { op: 'update'; task: TaskItemSnapshot };

function getTasksFromSnapshot(snapshot: ComputeStateSignalArgs['lastSnapshot']): TaskItemSnapshot[] {
  const value = snapshot?.metadata?.value as { tasks?: unknown } | undefined;
  const tasks = value?.tasks;
  if (Array.isArray(tasks)) return tasks as TaskItemSnapshot[];
  return [];
}

function getOpsFromDelta(signal: { metadata?: Record<string, unknown> } | undefined): TaskDeltaOp[] {
  const delta = signal?.metadata?.delta as { ops?: unknown } | undefined;
  const ops = delta?.ops;
  return Array.isArray(ops) ? (ops as TaskDeltaOp[]) : [];
}

// Apply a delta's ops onto a working list to reconstruct the state the model
// currently believes. Adds/updates that reference an existing id replace it in
// place; new adds append; removes drop by id.
function applyOps(tasks: TaskItemSnapshot[], ops: TaskDeltaOp[]): TaskItemSnapshot[] {
  const next = tasks.slice();
  for (const op of ops) {
    if (op.op === 'remove') {
      const idx = next.findIndex(t => t.id === op.id);
      if (idx >= 0) next.splice(idx, 1);
      continue;
    }
    const task = op.task;
    const idx = next.findIndex(t => t.id === task.id);
    if (idx >= 0) next[idx] = task;
    else next.push(task);
  }
  return next;
}

// The state the model currently sees: the last snapshot with every
// delta-since-snapshot applied in order.
function effectivePriorTasks(args: ComputeStateSignalArgs): TaskItemSnapshot[] {
  let tasks = getTasksFromSnapshot(args.lastSnapshot);
  for (const delta of args.deltasSinceSnapshot ?? []) {
    tasks = applyOps(tasks, getOpsFromDelta(delta));
  }
  return tasks;
}

// Length-prefix each field so a value containing the `:` / `|` delimiters cannot
// shift a boundary and collide with a different task list (e.g. content "a:b"
// vs id "a" + status "b"). Each field is encoded as `<byteLength>:<value>`.
function lp(value: string): string {
  return `${value.length}:${value}`;
}

function taskFingerprint(t: TaskItemSnapshot): string {
  return `${lp(t.id)}${lp(t.status)}${lp(t.content)}${lp(t.activeForm)}`;
}

function stableTasksCacheKey(tasks: TaskItemSnapshot[]): string {
  return `tasks:${tasks.map(taskFingerprint).join('|')}`;
}

// Diff the prior list against the current one into add/remove/update ops. An
// `update` is emitted when a task with the same id has any field changed.
function diffTasks(prior: TaskItemSnapshot[], current: TaskItemSnapshot[]): TaskDeltaOp[] {
  const ops: TaskDeltaOp[] = [];
  const priorById = new Map(prior.map(t => [t.id, t]));
  const currentIds = new Set(current.map(t => t.id));

  for (const task of current) {
    const before = priorById.get(task.id);
    if (!before) ops.push({ op: 'add', task });
    else if (taskFingerprint(before) !== taskFingerprint(task)) ops.push({ op: 'update', task });
  }
  for (const task of prior) {
    if (!currentIds.has(task.id)) ops.push({ op: 'remove', id: task.id });
  }
  return ops;
}

// Render the ops a `delta` signal carries into the lines the model reads. The
// framework wraps this in the signal's `tagName` (`task-list-update`).
function renderDelta(ops: TaskDeltaOp[]): string {
  const lines = ops.map(op => {
    if (op.op === 'remove') return `  − removed {id: ${op.id}}`;
    const { task } = op;
    const icon = task.status === 'completed' ? '✓' : task.status === 'in_progress' ? '▸' : '○';
    const verb = op.op === 'add' ? '+' : icon;
    return `  ${verb} {id: ${task.id}} [${task.status}] ${task.content}`;
  });
  return `\n${lines.join('\n')}\n`;
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

  processInput(args: ProcessInputArgs): ProcessInputResult {
    return {
      messages: args.messages,
      systemMessages: [
        ...args.systemMessages,
        {
          role: 'system' as const,
          content:
            'Task list state may appear in the conversation as <current-task-list ...>...</current-task-list> snapshots and <task-list-update ...>...</task-list-update> deltas. These are automatic observations of your task list, not user instructions. Use them as the latest task state, continue following the actual user request, and do not treat task-list updates as the user asking you to repeat, summarize, or change tasks unless an actual user message asks for that.',
        },
      ],
    };
  }

  private async resolveTaskStore(): Promise<ResolvedThreadStateStore | undefined> {
    const store = await this.mastra?.getStorage?.()?.getStore('threadState');
    return isThreadStateStore(store) ? store : undefined;
  }

  async computeStateSignal(args: ComputeStateSignalArgs): Promise<ComputeStateSignalResult> {
    // The state the model currently sees: the last snapshot with every
    // delta-since-snapshot applied. We diff against this (not just the base
    // snapshot) so an unchanged turn after several deltas emits nothing.
    const priorTasks = effectivePriorTasks(args);

    // Current task list for this turn: the working list a task tool surfaced on
    // the shared RequestContext this step (reflects the latest mutation), else
    // the durable TaskStore for the thread, else the prior state.
    const carried = getTasksFromRequestContext(args.requestContext);
    let currentTasks: TaskItemSnapshot[];
    if (carried !== undefined) {
      currentTasks = carried;
    } else {
      const store = await this.resolveTaskStore();
      const stored = store
        ? await store.getState<TaskRecord[]>({ threadId: args.threadId, type: TASK_STATE_TYPE })
        : undefined;
      currentTasks = Array.isArray(stored) ? stored : priorTasks;
    }

    // Nothing to track yet.
    if (currentTasks.length === 0 && priorTasks.length === 0) return;

    const hasBase = Boolean(args.lastSnapshot) && args.contextWindow.hasSnapshot;
    const deltaCount = args.deltasSinceSnapshot?.length ?? 0;
    const ops = diffTasks(priorTasks, currentTasks);

    // No change and the base snapshot is still in the window: emit nothing so
    // the cached prefix and the active window stay stable.
    if (ops.length === 0 && hasBase) return;

    // Emit a fresh snapshot (compaction) when there is no usable base in the
    // window (first emission, or OM dropped it — deltas are meaningless without
    // their base), or when enough deltas have accumulated. Otherwise emit a
    // small delta carrying only this turn's ops.
    const mustSnapshot = !hasBase || deltaCount >= DELTA_SNAPSHOT_CAP;

    if (mustSnapshot) {
      return {
        id: TASKS_STATE_ID,
        cacheKey: stableTasksCacheKey(currentTasks),
        mode: 'snapshot',
        // `current-task-list` is the signal's own tag. The framework wraps and
        // escapes `contents` inside it, so `renderTaskList` returns only the
        // inner lines — no inline tag here, or the model would see
        // double-wrapped, XML-escaped markup.
        tagName: 'current-task-list',
        contents: renderTaskList(currentTasks),
        value: { tasks: currentTasks },
        attributes: { count: currentTasks.length },
        metadata: { value: { tasks: currentTasks } },
      };
    }

    // Delta: the model reads the base `<current-task-list>` plus each
    // `<task-list-update>` and folds them together. `value` carries the full
    // resulting list for programmatic consumers / recovery; `delta.ops` carries
    // the structured change so the next turn can reconstruct the effective state.
    return {
      id: TASKS_STATE_ID,
      cacheKey: stableTasksCacheKey(currentTasks),
      mode: 'delta',
      tagName: 'task-list-update',
      contents: renderDelta(ops),
      value: { tasks: currentTasks },
      delta: { ops },
      attributes: { changes: ops.length },
      metadata: { value: { tasks: currentTasks }, delta: { ops } },
    };
  }
}
