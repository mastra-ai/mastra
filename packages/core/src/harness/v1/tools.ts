// ---------------------------------------------------------------------------
// Tool composition (v1).
//
// Combines an agent's tool surface with mode overrides, harness built-in
// tools, and permission-rule filtering. The Session/Harness layer never
// imports the legacy `buildToolsets` pipeline — this composer is the v1
// surface for "what tools does this request see?".
// ---------------------------------------------------------------------------

import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import type { ToolsInput } from '../../agent/types';
import { createTool } from '../../tools';
import type { ToolExecutionContext } from '../../tools';
import type { PermissionPolicy } from './permissions.types';
import type { HarnessRequestContext } from './request-context';
import type { Session } from './session';

type AnySession = Session<any>;

type HarnessTaskRecord = {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
};

type TaskState = { tasks?: HarnessTaskRecord[] };

export interface PermissionRules {
  /**
   * Per-tool override map. `'allow'` exposes the tool unconditionally,
   * `'deny'` strips it from the toolset, `'ask'` defers to the runtime gate.
   */
  tools?: Record<string, PermissionPolicy>;
}

export interface BuildSessionToolsetsOptions {
  /** Tools declared by the backing agent (already resolved for this request). */
  agentTools?: ToolsInput;
  /** Mode-level overrides. `tools` replaces; `additionalTools` augments. */
  modeOverrides?: { tools?: ToolsInput; additionalTools?: ToolsInput };
  /** Harness built-in tools (ask_user, submit_plan, task_*, subagent, etc). */
  builtInTools?: ToolsInput;
  /** Optional per-tool permission policy. `deny` filters the tool out. */
  permissionRules?: PermissionRules;
  /** Tool ids the caller has explicitly disabled. */
  disabledTools?: readonly string[];
}

const taskSchema = z.object({
  id: z.string().optional(),
  content: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed']),
  activeForm: z.string(),
});

const taskUpdateSchema = z.object({
  id: z.string(),
  content: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed']).optional(),
  activeForm: z.string().optional(),
});

function getHarnessContext(context: ToolExecutionContext): HarnessRequestContext {
  const harnessContext = context.requestContext?.get<'harness', HarnessRequestContext>('harness');
  if (!harnessContext) {
    throw new Error('Harness tool execution requires context.requestContext.get("harness")');
  }
  return harnessContext;
}

function assertOwningSession(session: AnySession, context: ToolExecutionContext): HarnessRequestContext {
  const harnessContext = getHarnessContext(context);
  if (harnessContext.sessionId !== session.id) {
    throw new Error(
      `Harness tool execution context belongs to session "${harnessContext.sessionId}", not "${session.id}"`,
    );
  }
  return harnessContext;
}

function recoverableError(error: unknown, code = 'harness.tool_failed') {
  return {
    isError: true,
    code,
    message: error instanceof Error ? error.message : String(error),
  };
}

function taskSummary(tasks: HarnessTaskRecord[]) {
  const completed = tasks.filter(task => task.status === 'completed').length;
  const inProgress = tasks.filter(task => task.status === 'in_progress').length;
  const pending = tasks.filter(task => task.status === 'pending').length;
  const incompleteTasks = tasks.filter(task => task.status !== 'completed');
  return {
    tasks,
    summary: {
      total: tasks.length,
      completed,
      inProgress,
      pending,
      incomplete: incompleteTasks.length,
      hasTasks: tasks.length > 0,
      allCompleted: tasks.length > 0 && incompleteTasks.length === 0,
    },
    incompleteTasks,
  };
}

/**
 * Format a task_check summary into the human-readable `content` string the
 * MastraCode TUI renders inline. Mirrors the legacy harness task_check output
 * so display parity holds when execution runs through the v1 session.
 */
function formatTaskCheck(summary: ReturnType<typeof taskSummary>): string {
  const s = summary.summary;
  if (!s.hasTasks) {
    return 'No tasks found. Consider using task_write to create a task list for complex work.';
  }

  const inProgressTasks = summary.tasks.filter(t => t.status === 'in_progress');
  const pendingTasks = summary.tasks.filter(t => t.status === 'pending');

  let response = `Task Status: [${s.completed}/${s.total} completed]\n`;
  response += `- Completed: ${s.completed}\n`;
  response += `- In Progress: ${s.inProgress}\n`;
  response += `- Pending: ${s.pending}\n`;
  response += `\nAll tasks completed: ${s.allCompleted ? 'YES' : 'NO'}`;

  if (!s.allCompleted) {
    response += '\n\nIncomplete tasks:';
    if (inProgressTasks.length > 0) {
      response += '\n\nIn Progress:';
      for (const t of inProgressTasks) response += `\n- ${t.id}: ${t.content}`;
    }
    if (pendingTasks.length > 0) {
      response += '\n\nPending:';
      for (const t of pendingTasks) response += `\n- ${t.id}: ${t.content}`;
    }
    response += '\n\nContinue working on these tasks before ending.';
  }

  return response;
}

function getTasks(session: AnySession): HarnessTaskRecord[] {
  const state = session.getState() as TaskState;
  return (state.tasks ?? []).map(task => ({ ...task }));
}

async function replaceTasks(session: AnySession, tasks: HarnessTaskRecord[]): Promise<HarnessTaskRecord[]> {
  return session.updateState(() => ({
    updates: { tasks: tasks.map(task => ({ ...task })) },
    result: tasks.map(task => ({ ...task })),
  }));
}

async function updateTask(
  session: AnySession,
  taskId: string,
  updates: Partial<Omit<HarnessTaskRecord, 'id'>>,
): Promise<HarnessTaskRecord[]> {
  return session.updateState((state: Readonly<TaskState>) => {
    const tasks = (state.tasks ?? []).map(task => ({ ...task }));
    const task = tasks.find(task => task.id === taskId);
    if (!task) {
      throw new Error(`Harness task "${taskId}" was not found on session "${session.id}"`);
    }
    Object.assign(task, updates);
    return { updates: { tasks }, result: tasks };
  });
}

export function buildHarnessBuiltInTools(session: AnySession): ToolsInput {
  return {
    task_write: createTool({
      id: 'task_write',
      description: 'Replace the task list for the current harness session.',
      // No `.min(1)`: an empty array is the documented way to clear the task
      // list (legacy product contract; the TUI renders a "Tasks cleared"
      // transition for it).
      inputSchema: z.object({ tasks: z.array(taskSchema) }),
      execute: async ({ tasks }, context) => {
        try {
          assertOwningSession(session, context);
          const savedTasks = await replaceTasks(
            session,
            tasks.map(task => ({ ...task, id: task.id ?? randomUUID() })),
          );
          return taskSummary(savedTasks);
        } catch (error) {
          return recoverableError(error);
        }
      },
    }),
    task_update: createTool({
      id: 'task_update',
      description: 'Update one task in the current harness session.',
      inputSchema: taskUpdateSchema,
      execute: async ({ id, ...updates }, context) => {
        try {
          assertOwningSession(session, context);
          return taskSummary(await updateTask(session, id, updates));
        } catch (error) {
          return recoverableError(error);
        }
      },
    }),
    task_complete: createTool({
      id: 'task_complete',
      description: 'Mark one task completed in the current harness session.',
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }, context) => {
        try {
          assertOwningSession(session, context);
          return taskSummary(await updateTask(session, id, { status: 'completed' }));
        } catch (error) {
          return recoverableError(error);
        }
      },
    }),
    task_check: createTool({
      id: 'task_check',
      description: 'Read the task completion state for the current harness session.',
      inputSchema: z.object({}).optional(),
      execute: async (_input, context) => {
        try {
          assertOwningSession(session, context);
          const summary = taskSummary(getTasks(session));
          return { content: formatTaskCheck(summary), ...summary };
        } catch (error) {
          return recoverableError(error);
        }
      },
    }),
    ask_user: createTool({
      id: 'ask_user',
      description: 'Register a pending question for the current harness session.',
      inputSchema: z.object({
        question: z.string(),
        options: z
          .array(z.object({ label: z.string(), description: z.string().nullable().optional() }))
          .min(2)
          .max(4)
          .optional()
          .nullable(),
        selectionMode: z.enum(['single_select', 'multi_select']).optional(),
      }),
      execute: async (input, context) => {
        try {
          assertOwningSession(session, context);
          const pending = await session.registerPendingItem({
            id: randomUUID(),
            kind: 'question',
            status: 'pending',
            runId: context.agent?.runId ?? context.workflow?.runId ?? null,
            traceId: context.traceId ?? null,
            payload: input,
          });
          return { isError: false, pendingItemId: pending.id, status: pending.status };
        } catch (error) {
          return recoverableError(error);
        }
      },
    }),
    submit_plan: createTool({
      id: 'submit_plan',
      description: 'Register a pending plan approval for the current harness session.',
      inputSchema: z.object({ title: z.string().nullable().optional(), plan: z.string() }),
      execute: async (input, context) => {
        try {
          assertOwningSession(session, context);
          const pending = await session.registerPendingItem({
            id: randomUUID(),
            kind: 'plan-approval',
            status: 'pending',
            runId: context.agent?.runId ?? context.workflow?.runId ?? null,
            traceId: context.traceId ?? null,
            payload: { ...input, transitionModeId: session.getMode().transitionsTo },
          });
          return { isError: false, pendingItemId: pending.id, status: pending.status };
        } catch (error) {
          return recoverableError(error);
        }
      },
    }),
    subagent: createTool({
      id: 'subagent',
      description: 'Create a durable child harness session for a configured subagent type.',
      inputSchema: z.object({
        agentType: z.string(),
        prompt: z.string(),
        modelId: z.string().optional().nullable(),
        forked: z.boolean().optional().nullable(),
      }),
      execute: async (input, context) => {
        try {
          assertOwningSession(session, context);
          return await session.spawnSubagentSession({
            agentType: input.agentType,
            prompt: input.prompt,
            ...(input.modelId ? { modelId: input.modelId } : {}),
            ...(input.forked !== undefined && input.forked !== null ? { forked: input.forked } : {}),
          });
        } catch (error) {
          return recoverableError(error);
        }
      },
    }),
    useSkill: createTool({
      id: 'useSkill',
      description: 'Activate a skill in the current harness session.',
      inputSchema: z.object({ ref: z.string() }),
      execute: async ({ ref }, context) => {
        try {
          assertOwningSession(session, context);
          return { instructions: await session.useSkill(ref) };
        } catch (error) {
          return recoverableError(error);
        }
      },
    }),
  } as ToolsInput;
}

/**
 * Produce the final toolset visible to the agent on this request. Pure
 * function — no IO, no side effects.
 *
 * Layering order:
 *  1. Agent tools (or mode `tools` replacement)
 *  2. Mode `additionalTools` (when not in replacement mode)
 *  3. Built-in harness tools (last so they cannot be shadowed)
 *  4. Apply `permissionRules.deny` + `disabledTools` filters
 */
export function buildSessionToolsets(opts: BuildSessionToolsetsOptions = {}): ToolsInput {
  const { agentTools, modeOverrides, builtInTools, permissionRules, disabledTools } = opts;

  const base: Record<string, unknown> = modeOverrides?.tools
    ? { ...(modeOverrides.tools as Record<string, unknown>) }
    : { ...(agentTools as Record<string, unknown> | undefined) };

  if (modeOverrides?.additionalTools && !modeOverrides.tools) {
    Object.assign(base, modeOverrides.additionalTools);
  }

  if (builtInTools) {
    Object.assign(base, builtInTools);
  }

  const denySet = new Set<string>(disabledTools ?? []);
  for (const [name, policy] of Object.entries(permissionRules?.tools ?? {})) {
    if (policy === 'deny') denySet.add(name);
  }

  for (const name of denySet) {
    delete base[name];
  }

  return base as ToolsInput;
}
