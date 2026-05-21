import { z } from 'zod';

import { createTool } from '../../tools/tool';

export const ASK_USER_TOOL_ID = 'ask_user';
export const SUBMIT_PLAN_TOOL_ID = 'submit_plan';
export const TASK_WRITE_TOOL_ID = 'task_write';
export const TASK_CHECK_TOOL_ID = 'task_check';

export const TASK_METADATA_NAMESPACE = 'mastra' as const;
export const TASK_METADATA_KEY = 'tasks' as const;

export const askUserOptionSchema = z.object({
  label: z.string(),
  description: z.string().optional(),
});

export type AskUserOption = z.infer<typeof askUserOptionSchema>;

export const askUserSelectionModeSchema = z.enum(['single_select', 'multi_select']);
export type AskUserSelectionMode = z.infer<typeof askUserSelectionModeSchema>;

export const taskItemSchema = z.object({
  content: z.string().describe('Task description in imperative form'),
  status: z.enum(['pending', 'in_progress', 'completed']),
  activeForm: z.string().describe('Present-continuous form shown during execution'),
});

export type TaskItem = z.infer<typeof taskItemSchema>;

const askUserInputSchema = z.object({
  question: z.string().describe('The question to ask the user. Should be clear and specific.'),
  options: z
    .array(askUserOptionSchema)
    .optional()
    .describe('Optional choices. If provided, shows a selection list. If omitted, shows a free-text input.'),
  selectionMode: askUserSelectionModeSchema
    .optional()
    .describe('Controls how many options the user can select. Defaults to single_select when options are provided.'),
});

const askUserOutputSchema = z.object({
  answer: z.unknown().describe("The user's response."),
});

export const askUser = createTool({
  id: ASK_USER_TOOL_ID,
  description: 'Ask the user a question and wait for their response. Use for clarification, validation, or decisions.',
  inputSchema: askUserInputSchema,
  outputSchema: askUserOutputSchema,
  suspendSchema: z.object({}),
  resumeSchema: askUserOutputSchema,
  execute: async (_input, ctx) => {
    const resumeData = ctx.agent?.resumeData as z.infer<typeof askUserOutputSchema> | undefined;
    if (resumeData !== undefined) return resumeData;

    if (!ctx.agent?.suspend) {
      throw new Error(`${ASK_USER_TOOL_ID} requires an agent execution context with suspend support.`);
    }

    await ctx.agent.suspend({});
    return { answer: undefined };
  },
});

const submitPlanInputSchema = z.object({
  title: z.string().optional().describe('Short title for the plan.'),
  plan: z.string().describe('The full plan content in markdown format.'),
});

const submitPlanOutputSchema = z.object({
  approved: z.boolean(),
  revision: z.string().optional().describe('Free-text revision notes supplied by the reviewer.'),
  transitionToMode: z.string().optional().describe('Mode id to switch to on approval.'),
});

export const submitPlan = createTool({
  id: SUBMIT_PLAN_TOOL_ID,
  description:
    'Submit a completed implementation plan for user review. The user can approve, reject, or request revisions.',
  inputSchema: submitPlanInputSchema,
  outputSchema: submitPlanOutputSchema,
  suspendSchema: submitPlanInputSchema,
  resumeSchema: submitPlanOutputSchema,
  execute: async (_input, ctx) => {
    const input = _input as z.infer<typeof submitPlanInputSchema>;
    const resumeData = ctx.agent?.resumeData as z.infer<typeof submitPlanOutputSchema> | undefined;
    if (resumeData !== undefined) return resumeData;

    if (!ctx.agent?.suspend) {
      throw new Error(`${SUBMIT_PLAN_TOOL_ID} requires an agent execution context with suspend support.`);
    }

    await ctx.agent.suspend(input);
    return { approved: false };
  },
});

const taskWriteInputSchema = z.object({
  tasks: z.array(taskItemSchema).describe('The complete updated task list.'),
});

const taskWriteOutputSchema = z.object({
  written: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  inProgress: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  summary: z.string(),
});

export const taskWrite = createTool({
  id: TASK_WRITE_TOOL_ID,
  description: 'Create and manage a structured task list for the current conversation.',
  inputSchema: taskWriteInputSchema,
  outputSchema: taskWriteOutputSchema,
  execute: async (input, ctx) => {
    const tasks = input.tasks ?? [];
    const counts = summarizeTasks(tasks);

    await ctx.writer?.custom({ type: 'data-task-updated', data: { tasks } });

    const threadId = ctx.agent?.threadId;
    const storage = ctx.mastra?.getStorage?.();
    if (!threadId || !storage) {
      return {
        ...counts,
        summary:
          counts.summary +
          (threadId
            ? ' (no memory storage configured - tasks not persisted)'
            : ' (no thread context - tasks not persisted)'),
      };
    }

    const memory = await storage.getStore('memory');
    if (!memory) return { ...counts, summary: counts.summary + ' (memory store unavailable - tasks not persisted)' };

    const existing = await memory.getThreadById({ threadId });
    if (!existing) return { ...counts, summary: counts.summary + ' (thread not found - tasks not persisted)' };

    const existingMetadata = (existing.metadata ?? {}) as Record<string, unknown>;
    const existingNamespace = (existingMetadata[TASK_METADATA_NAMESPACE] ?? {}) as Record<string, unknown>;
    await memory.updateThread({
      id: threadId,
      title: existing.title ?? '',
      metadata: {
        ...existingMetadata,
        [TASK_METADATA_NAMESPACE]: {
          ...existingNamespace,
          [TASK_METADATA_KEY]: tasks,
        },
      },
    });

    return counts;
  },
});

const taskCheckOutputSchema = z.object({
  total: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  inProgress: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  allComplete: z.boolean(),
  tasks: z.array(taskItemSchema),
});

export const taskCheck = createTool({
  id: TASK_CHECK_TOOL_ID,
  description: 'Check the completion status of the current task list. Returns counts and tasks.',
  inputSchema: z.object({}),
  outputSchema: taskCheckOutputSchema,
  execute: async (_input, ctx) => {
    const threadId = ctx.agent?.threadId;
    const storage = ctx.mastra?.getStorage?.();
    if (!threadId || !storage) return summarizeTaskCheck([]);

    const memory = await storage.getStore('memory');
    if (!memory) return summarizeTaskCheck([]);

    const thread = await memory.getThreadById({ threadId });
    const metadata = (thread?.metadata ?? {}) as Record<string, unknown>;
    const namespace = (metadata[TASK_METADATA_NAMESPACE] ?? {}) as Record<string, unknown>;
    const parsed = z.array(taskItemSchema).safeParse(namespace[TASK_METADATA_KEY]);
    return summarizeTaskCheck(parsed.success ? parsed.data : []);
  },
});

export const harnessBuiltInTools = {
  [ASK_USER_TOOL_ID]: askUser,
  [SUBMIT_PLAN_TOOL_ID]: submitPlan,
  [TASK_WRITE_TOOL_ID]: taskWrite,
  [TASK_CHECK_TOOL_ID]: taskCheck,
};

function summarizeTasks(tasks: TaskItem[]) {
  const counts = countTasks(tasks);
  return {
    written: tasks.length,
    ...counts,
    summary: `${tasks.length} task(s): ${counts.pending} pending, ${counts.inProgress} in progress, ${counts.completed} completed`,
  };
}

function summarizeTaskCheck(tasks: TaskItem[]) {
  const counts = countTasks(tasks);
  return {
    total: tasks.length,
    ...counts,
    allComplete: tasks.length > 0 && counts.completed === tasks.length,
    tasks,
  };
}

function countTasks(tasks: TaskItem[]) {
  let pending = 0;
  let inProgress = 0;
  let completed = 0;
  for (const task of tasks) {
    if (task.status === 'pending') pending += 1;
    if (task.status === 'in_progress') inProgress += 1;
    if (task.status === 'completed') completed += 1;
  }
  return { pending, inProgress, completed };
}
