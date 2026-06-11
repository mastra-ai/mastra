import { z } from 'zod/v4';

import type { MastraUnion } from '../../action';
import type { RequestContext } from '../../request-context';
import type { TaskRecord } from '../../storage/domains/thread-state/base';
import { createTool } from '../tool';

// =============================================================================
// Task Tools (agent-agnostic)
// =============================================================================
//
// The four task tools (`task_write`, `task_update`, `task_complete`,
// `task_check`) manage a structured task list for an agent run. They are
// agent-agnostic: they do not depend on the Harness. The task list is persisted
// through the agent **state-signal** lane (see `task-state-processor.ts`), which
// is cache-aware (the snapshot supersedes by cacheKey instead of accumulating)
// and OM-aware (re-emitted when observational-memory truncation drops it).
//
// The task list is held in the thread-scoped `threadState` storage domain under
// the `'task'` type, which is the source of truth. The task tools read/write it
// synchronously within a run, and the task state processor projects it onto the
// state-signal lane so the model sees it. With a durable `threadState` backend
// (e.g. `@mastra/libsql`), the list survives a process restart.
//
// State signals + the task store require a memory-backed thread. When the run is
// not memory backed (no threadId/resourceId), the tools no-op and tell the model
// that task tracking requires agent memory.
//
// Within a single turn each write also surfaces the new list on the shared
// `RequestContext` under `TASKS_REQUEST_CONTEXT_KEY`, so the state processor can
// build a snapshot that reflects the latest mutation in the same step.

/** RequestContext key under which the current working task list is surfaced within a turn. */
export const TASKS_REQUEST_CONTEXT_KEY = 'mastra:tasks';

/** State-signal lane id used for the task list. */
export const TASKS_STATE_ID = 'tasks';

/** `threadState` storage `type` namespace under which the task list is stored. */
export const TASK_STATE_TYPE = 'task';

const NO_MEMORY_MESSAGE =
  'Task tools require agent memory (a memory-backed thread). No task was recorded. Configure the agent with Memory to use the task list.';

const taskIdSchema = z
  .string()
  .min(1)
  .describe("Stable task identifier (for example, 'task_investigate_tests'). Keep this unchanged across updates.");

const taskItemInputSchema = z.object({
  id: taskIdSchema.optional(),
  content: z.string().min(1).describe("Task description in imperative form (e.g., 'Fix authentication bug')"),
  status: z.enum(['pending', 'in_progress', 'completed']).describe('Current task status'),
  activeForm: z
    .string()
    .min(1)
    .describe("Present continuous form shown during execution (e.g., 'Fixing authentication bug')"),
});

const taskItemSchema = taskItemInputSchema.extend({
  id: taskIdSchema,
});

export type TaskItemInput = z.infer<typeof taskItemInputSchema>;
export type TaskItem = z.infer<typeof taskItemSchema>;
export type TaskItemSnapshot = TaskItem;

const taskToolResultSchema = z.object({
  content: z.string(),
  tasks: z.array(taskItemSchema),
  isError: z.boolean(),
});

const taskCheckSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  inProgress: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  incomplete: z.number().int().nonnegative(),
  hasTasks: z.boolean(),
  allCompleted: z.boolean(),
});

const taskCheckResultSchema = taskToolResultSchema.extend({
  summary: taskCheckSummarySchema,
  incompleteTasks: z.array(taskItemSchema),
});

export type TaskCheckSummary = z.infer<typeof taskCheckSummarySchema>;
export type TaskCheckResult = z.infer<typeof taskCheckResultSchema>;
type TaskToolResult = z.infer<typeof taskToolResultSchema>;

const TASK_ID_SLUG_MAX_LENGTH = 48;

function slugifyTaskContent(content: string): string {
  let slug = '';
  let pendingSeparator = false;

  for (const char of content.toLowerCase()) {
    const code = char.charCodeAt(0);
    const isAsciiLetter = code >= 97 && code <= 122;
    const isDigit = code >= 48 && code <= 57;

    if (isAsciiLetter || isDigit) {
      if (pendingSeparator && slug.length > 0 && slug.length < TASK_ID_SLUG_MAX_LENGTH) {
        slug += '_';
      }
      if (slug.length >= TASK_ID_SLUG_MAX_LENGTH) break;
      slug += char;
      pendingSeparator = false;
      continue;
    }

    pendingSeparator = slug.length > 0;
  }

  return slug;
}

function createDeterministicTaskId(task: TaskItemInput, occurrence: number): string {
  const slug = slugifyTaskContent(task.content);
  const suffix = occurrence > 1 ? `_${occurrence}` : '';
  return `task_${slug || 'item'}${suffix}`;
}

function makeUniqueTaskId(id: string, usedIds: Set<string>, reservedIds: Set<string> = new Set()): string {
  if (!usedIds.has(id) && !reservedIds.has(id)) return id;

  let suffix = 2;
  let nextId = `${id}_${suffix}`;
  while (usedIds.has(nextId) || reservedIds.has(nextId)) {
    suffix += 1;
    nextId = `${id}_${suffix}`;
  }
  return nextId;
}

export function assignTaskIds(tasks: TaskItemInput[], previousTasks: TaskItemSnapshot[] = []): TaskItemSnapshot[] {
  const usedIds = new Set<string>();
  const contentOccurrences = new Map<string, number>();
  const omittedContentCounts = new Map<string, number>();
  const explicitTaskIds = new Set(tasks.map(task => task.id).filter((id): id is string => Boolean(id)));
  const reusablePreviousIds = new Map<number, string>();

  for (const task of tasks) {
    if (!task.id) {
      omittedContentCounts.set(task.content, (omittedContentCounts.get(task.content) ?? 0) + 1);
    }
  }

  tasks.forEach((task, index) => {
    if (task.id || omittedContentCounts.get(task.content) !== 1) return;

    const previousMatches = previousTasks.filter(
      previous => previous.content === task.content && !explicitTaskIds.has(previous.id),
    );
    if (previousMatches.length === 1) {
      reusablePreviousIds.set(index, previousMatches[0]!.id);
    }
  });

  const reservedIds = new Set([...explicitTaskIds, ...reusablePreviousIds.values()]);

  return tasks.map((task, index) => {
    const contentOccurrence = (contentOccurrences.get(task.content) ?? 0) + 1;
    contentOccurrences.set(task.content, contentOccurrence);

    const fallbackId = createDeterministicTaskId(task, contentOccurrence);
    const reusablePreviousId = reusablePreviousIds.get(index);

    // If the model repeats an explicit ID in the same write, keep the first one
    // and mint/reuse a stable fallback for the duplicate instead of failing the whole list.
    const requestedId = task.id && !usedIds.has(task.id) ? task.id : undefined;
    const id =
      requestedId ??
      (reusablePreviousId && !usedIds.has(reusablePreviousId)
        ? reusablePreviousId
        : makeUniqueTaskId(fallbackId, usedIds, reservedIds));
    usedIds.add(id);

    return {
      id,
      content: task.content,
      status: task.status,
      activeForm: task.activeForm,
    };
  });
}

export function formatTaskListResult(tasks: TaskItemSnapshot[]): string {
  const completed = tasks.filter(t => t.status === 'completed').length;
  const inProgress = tasks.find(t => t.status === 'in_progress');
  const total = tasks.length;

  let summary = `Tasks updated: [${completed}/${total} completed]`;
  if (inProgress) {
    summary += `\nCurrently: ${inProgress.activeForm} (${inProgress.id})`;
  }
  if (tasks.length > 0) {
    summary += `\nTask IDs:\n${tasks.map(t => `- ${t.id}: ${t.content} (${t.status})`).join('\n')}`;
  }

  return summary;
}

export function summarizeTaskCheck(tasks: TaskItemSnapshot[]): {
  summary: TaskCheckSummary;
  inProgressTasks: TaskItemSnapshot[];
  pendingTasks: TaskItemSnapshot[];
  incompleteTasks: TaskItemSnapshot[];
} {
  const completedTasks = tasks.filter(task => task.status === 'completed');
  const inProgressTasks = tasks.filter(task => task.status === 'in_progress');
  const pendingTasks = tasks.filter(task => task.status === 'pending');
  const incompleteTasks = [...inProgressTasks, ...pendingTasks];

  return {
    summary: {
      total: tasks.length,
      completed: completedTasks.length,
      inProgress: inProgressTasks.length,
      pending: pendingTasks.length,
      incomplete: incompleteTasks.length,
      hasTasks: tasks.length > 0,
      allCompleted: tasks.length > 0 && incompleteTasks.length === 0,
    },
    inProgressTasks,
    pendingTasks,
    incompleteTasks,
  };
}

function formatTaskCheckResult(taskCheck: ReturnType<typeof summarizeTaskCheck>): string {
  const { summary, inProgressTasks, pendingTasks } = taskCheck;

  if (!summary.hasTasks) {
    return 'No tasks found. Consider using task_write to create a task list for complex work.';
  }

  let response = `Task Status: [${summary.completed}/${summary.total} completed]\n`;
  response += `- Completed: ${summary.completed}\n`;
  response += `- In Progress: ${summary.inProgress}\n`;
  response += `- Pending: ${summary.pending}\n`;
  response += `\nAll tasks completed: ${summary.allCompleted ? 'YES' : 'NO'}`;

  if (!summary.allCompleted) {
    response += '\n\nIncomplete tasks:';
    if (inProgressTasks.length > 0) {
      response += '\n\nIn Progress:';
      inProgressTasks.forEach(t => {
        response += `\n- ${t.id}: ${t.content}`;
      });
    }
    if (pendingTasks.length > 0) {
      response += '\n\nPending:';
      pendingTasks.forEach(t => {
        response += `\n- ${t.id}: ${t.content}`;
      });
    }
    response += '\n\nContinue working on these tasks before ending.';
  }

  return response;
}

export function hasMultipleInProgress(tasks: TaskItemSnapshot[]): boolean {
  return tasks.filter(task => task.status === 'in_progress').length > 1;
}

function multipleInProgressError(tasks: TaskItemSnapshot[]): TaskToolResult {
  return {
    content: 'Only one task can be in_progress at a time.',
    tasks,
    isError: true,
  };
}

export function demoteExtraInProgress(tasks: TaskItemSnapshot[], preferredIndex?: number): TaskItemSnapshot[] {
  const inProgressIndices = tasks.reduce<number[]>((acc, t, i) => {
    if (t.status === 'in_progress') acc.push(i);
    return acc;
  }, []);
  if (inProgressIndices.length <= 1) return tasks;
  const keepIndex =
    preferredIndex !== undefined && inProgressIndices.includes(preferredIndex)
      ? preferredIndex
      : inProgressIndices[inProgressIndices.length - 1]!;
  return tasks.map((t, i) =>
    t.status === 'in_progress' && i !== keepIndex ? { ...t, status: 'pending' as const } : t,
  );
}

function formatAvailableTaskIds(tasks: TaskItemSnapshot[]): string {
  if (tasks.length === 0) return 'No tasks are currently tracked.';
  return `Available task IDs:\n${tasks.map(t => `- ${t.id}: ${t.content} (${t.status})`).join('\n')}`;
}

// -----------------------------------------------------------------------------
// Task list read/write through the thread-scoped `threadState` store
// -----------------------------------------------------------------------------
//
// The `tasks` storage domain is the source of truth for the task list. It is
// thread-scoped and read/written synchronously within a run, so a `task_update`
// observes exactly the tasks a prior `task_write` produced in the same turn
// (the store survives the per-step serialization that drops RequestContext
// mutations). The task state processor projects this list onto the state-signal
// lane so the model sees it (cache-aware, OM-safe). The processor reads the
// within-turn list from `RequestContext` (set on each write) so the snapshot
// reflects the latest mutation in the same step it is computed.

// Typed in terms of the storage domain's `TaskRecord` (the storage contract).
// The `threadState` domain deliberately defines its own `TaskRecord` so the
// storage layer does not depend on this tools package; the tools operate on
// `TaskItemSnapshot`. The two must stay structurally identical — typing the
// store methods with `TaskRecord` here means any drift between the shapes breaks
// the build at the read/write call sites below, rather than silently passing
// the duck-typed `isThreadStateStore` guard.
type ResolvedThreadStateStore = {
  getState<T = unknown>(args: { threadId: string; type: string }): Promise<T | undefined>;
  setState(args: { threadId: string; type: string; value: TaskRecord[] }): Promise<void>;
};

interface TaskToolAgentContext {
  threadId?: string;
  resourceId?: string;
}

interface TaskToolContext {
  agent?: TaskToolAgentContext;
  requestContext?: RequestContext;
  // The agent's Mastra instance, used to resolve the thread-scoped state store.
  mastra?: MastraUnion;
}

/** True when the run is memory-backed (state signals + the task store require a thread + resource). */
function isMemoryBacked(agent: TaskToolAgentContext | undefined): boolean {
  return Boolean(agent?.threadId && agent?.resourceId);
}

function isThreadStateStore(value: unknown): value is ResolvedThreadStateStore {
  return (
    !!value &&
    typeof (value as ResolvedThreadStateStore).getState === 'function' &&
    typeof (value as ResolvedThreadStateStore).setState === 'function'
  );
}

/** Resolve the thread-scoped state store from the agent's Mastra storage, if available. */
async function resolveTaskStore(context: TaskToolContext): Promise<ResolvedThreadStateStore | undefined> {
  const store = await context.mastra?.getStorage?.()?.getStore('threadState');
  return isThreadStateStore(store) ? store : undefined;
}

/**
 * Optional Harness display bridge. When the run carries a Harness request
 * context, emit a `task_updated` event so the Harness can update its display
 * state and any pinned task UI. This is display-only — the task list itself
 * lives in the `threadState` store + state-signal lane, not in Harness state.
 */
interface HarnessDisplayBridge {
  emitEvent?: (event: { type: 'task_updated'; tasks: TaskItemSnapshot[] }) => void;
}

function emitTaskDisplayUpdate(requestContext: RequestContext | undefined, tasks: TaskItemSnapshot[]): void {
  const harnessCtx = requestContext?.get('harness') as HarnessDisplayBridge | undefined;
  harnessCtx?.emitEvent?.({ type: 'task_updated', tasks });
}

function noMemoryResult(): TaskToolResult {
  return { content: NO_MEMORY_MESSAGE, tasks: [], isError: true };
}

function noMemoryCheckResult(): TaskCheckResult {
  const emptyCheck = summarizeTaskCheck([]);
  return {
    content: NO_MEMORY_MESSAGE,
    tasks: [],
    summary: emptyCheck.summary,
    incompleteTasks: emptyCheck.incompleteTasks,
    isError: true,
  };
}

/** Read the current task list for the thread from the store. */
async function readTaskStore(context: TaskToolContext): Promise<TaskItemSnapshot[]> {
  const store = await resolveTaskStore(context);
  const threadId = context.agent?.threadId;
  if (!store || !threadId) return [];
  const tasks = await store.getState<TaskRecord[]>({ threadId, type: TASK_STATE_TYPE });
  return Array.isArray(tasks) ? tasks : [];
}

/**
 * Apply a mutation to the current task list: read from the store, mutate,
 * persist back to the store, surface the list to the state processor via
 * `RequestContext`, and emit the Harness display update.
 */
async function applyTaskMutation(
  context: TaskToolContext,
  mutation: (currentTasks: TaskItemSnapshot[]) => TaskToolResult,
): Promise<TaskToolResult> {
  const store = await resolveTaskStore(context);
  const threadId = context.agent?.threadId;
  if (!store || !threadId) return noMemoryResult();

  const currentTasks = await readTaskStore(context);
  const result = mutation(currentTasks);
  if (!result.isError) {
    await store.setState({ threadId, type: TASK_STATE_TYPE, value: result.tasks });
    // Surface the new list to the task state processor for this step's snapshot.
    context.requestContext?.set(TASKS_REQUEST_CONTEXT_KEY, result.tasks);
    emitTaskDisplayUpdate(context.requestContext, result.tasks);
  }
  return result;
}

/**
 * Built-in, agent-agnostic tool: manage a structured task list for the run.
 * Full-replacement semantics: each call replaces the entire task list.
 * Prefer task_update or task_complete for changing existing tasks by ID.
 */
export const taskWriteTool = createTool({
  id: 'task_write',
  description: `Create and manage a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user.

Usage:
- Use this to create the initial task list or replace the whole list after replanning
- Pass the FULL task list each time this tool is called (replaces the previous list)
- Each task has: id (stable identifier), content (imperative), status (pending, in_progress, or completed), activeForm (present continuous)
- IDs must be unique. If duplicate explicit IDs are provided, the duplicate task is returned with a generated fallback ID
- Keep task IDs stable across updates. If omitted, IDs are generated and returned in the tool result
- When an ID is omitted while rewriting an existing list, one unambiguous matching task may reuse an existing ID
- Prefer single-task update tools when they are available
- Mark tasks in_progress BEFORE starting work (only ONE at a time)
- Mark tasks completed IMMEDIATELY after finishing
- Use this for multi-step tasks requiring 3+ distinct actions

States:
- pending: Not yet started
- in_progress: Currently working on (limit to ONE)
- completed: Finished successfully`,
  inputSchema: z.object({
    tasks: z.array(taskItemInputSchema).describe('The complete updated task list'),
  }),
  outputSchema: taskToolResultSchema,
  execute: async ({ tasks }, context) => {
    try {
      if (!isMemoryBacked(context?.agent)) return noMemoryResult();

      return applyTaskMutation(context, currentTasks => {
        const normalizedTasks = assignTaskIds(tasks, currentTasks);
        if (hasMultipleInProgress(normalizedTasks)) {
          return multipleInProgressError(currentTasks);
        }

        return {
          content: formatTaskListResult(normalizedTasks),
          tasks: normalizedTasks,
          isError: false,
        };
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: `Failed to update tasks: ${msg}`,
        tasks: [],
        isError: true,
      };
    }
  },
});

/**
 * Built-in, agent-agnostic tool: update one tracked task by stable ID.
 */
export const taskUpdateTool = createTool({
  id: 'task_update',
  description: `Update one task in the current task list by stable ID. Use this for targeted changes to one existing task.

Usage:
- Provide the task ID returned by the task-list tools
- Include only the fields that changed
- Use status to move a task between pending, in_progress, and completed
- Use task_complete when only marking a task completed
- If the ID is unknown, the tool returns an error with available task IDs`,
  inputSchema: z
    .object({
      id: taskIdSchema,
      content: z.string().min(1).optional().describe('New task description in imperative form'),
      status: z.enum(['pending', 'in_progress', 'completed']).optional().describe('New task status'),
      activeForm: z.string().min(1).optional().describe('New present continuous form shown during execution'),
    })
    .refine(input => input.content !== undefined || input.status !== undefined || input.activeForm !== undefined, {
      message: 'Provide at least one field to update.',
    }),
  outputSchema: taskToolResultSchema,
  execute: async ({ id, content, status, activeForm }, context) => {
    try {
      if (!isMemoryBacked(context?.agent)) return noMemoryResult();

      return applyTaskMutation(context, tasks => {
        const taskIndex = tasks.findIndex(task => task.id === id);
        if (taskIndex === -1) {
          return {
            content: `Task not found: ${id}\n\n${formatAvailableTaskIds(tasks)}`,
            tasks,
            isError: true,
          };
        }

        const updatedTasks = demoteExtraInProgress(
          tasks.map((task, index) =>
            index === taskIndex
              ? {
                  ...task,
                  ...(content !== undefined ? { content } : {}),
                  ...(status !== undefined ? { status } : {}),
                  ...(activeForm !== undefined ? { activeForm } : {}),
                }
              : task,
          ),
          taskIndex,
        );

        return {
          content: formatTaskListResult(updatedTasks),
          tasks: updatedTasks,
          isError: false,
        };
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: `Failed to update task: ${msg}`,
        tasks: [],
        isError: true,
      };
    }
  },
});

/**
 * Built-in, agent-agnostic tool: mark one tracked task completed by stable ID.
 */
export const taskCompleteTool = createTool({
  id: 'task_complete',
  description: `Mark one task completed by stable ID. Use this when one tracked task is finished.

Usage:
- Provide the task ID returned by the task-list tools
- If the ID is unknown, the tool returns an error with available task IDs`,
  inputSchema: z.object({
    id: taskIdSchema,
  }),
  outputSchema: taskToolResultSchema,
  execute: async ({ id }, context) => {
    try {
      if (!isMemoryBacked(context?.agent)) return noMemoryResult();

      return applyTaskMutation(context, tasks => {
        const taskIndex = tasks.findIndex(task => task.id === id);
        if (taskIndex === -1) {
          return {
            content: `Task not found: ${id}\n\n${formatAvailableTaskIds(tasks)}`,
            tasks,
            isError: true,
          };
        }

        const updatedTasks = tasks.map((task, index) =>
          index === taskIndex
            ? {
                ...task,
                status: 'completed' as const,
              }
            : task,
        );

        return {
          content: formatTaskListResult(updatedTasks),
          tasks: updatedTasks,
          isError: false,
        };
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: `Failed to complete task: ${msg}`,
        tasks: [],
        isError: true,
      };
    }
  },
});

/**
 * Built-in, agent-agnostic tool: check the completion status of the task list.
 * Helps the agent determine if all tasks are completed before ending work.
 */
export const taskCheckTool = createTool({
  id: 'task_check',
  description: `Check the completion status of your current task list. Use this before finishing tracked work to ensure all tasks are completed.

Returns:
- Human-readable content summary with task counts and incomplete task IDs
- Structured task list snapshot with stable IDs
- summary object with total, completed, inProgress, pending, incomplete, hasTasks, and allCompleted
- incompleteTasks array for tasks that still need work

summary.allCompleted is true only when at least one tracked task exists and every tracked task is completed. If no tasks exist, summary.hasTasks is false and summary.allCompleted is false.`,
  inputSchema: z.object({}), // No input needed
  outputSchema: taskCheckResultSchema,
  execute: async ({}, context) => {
    try {
      if (!isMemoryBacked(context?.agent)) return noMemoryCheckResult();

      const tasks = await readTaskStore(context);
      const taskCheck = summarizeTaskCheck(tasks);

      return {
        content: formatTaskCheckResult(taskCheck),
        tasks,
        summary: taskCheck.summary,
        incompleteTasks: taskCheck.incompleteTasks,
        isError: false,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      const emptyCheck = summarizeTaskCheck([]);
      return {
        content: `Failed to check tasks: ${msg}`,
        tasks: [],
        summary: emptyCheck.summary,
        incompleteTasks: emptyCheck.incompleteTasks,
        isError: true,
      };
    }
  },
});

function isTaskItemArray(value: unknown): value is TaskItemSnapshot[] {
  return (
    Array.isArray(value) &&
    value.every(
      item =>
        item &&
        typeof item === 'object' &&
        typeof (item as Record<string, unknown>).id === 'string' &&
        typeof (item as Record<string, unknown>).content === 'string' &&
        typeof (item as Record<string, unknown>).status === 'string' &&
        typeof (item as Record<string, unknown>).activeForm === 'string',
    )
  );
}

/**
 * Read the within-turn task list carried on the `RequestContext` by the task
 * tools (used by the task state processor to build the snapshot for the current
 * step). Returns `undefined` when no task tool ran this turn, so the processor
 * can fall back to the durable task store.
 */
export function getTasksFromRequestContext(requestContext: RequestContext | undefined): TaskItemSnapshot[] | undefined {
  const carried = requestContext?.get(TASKS_REQUEST_CONTEXT_KEY);
  return isTaskItemArray(carried) ? carried : undefined;
}
