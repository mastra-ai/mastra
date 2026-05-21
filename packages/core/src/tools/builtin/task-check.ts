import { z } from 'zod';
import { createTool } from '../tool';
import { TASK_CHECK_TOOL_ID, TASK_METADATA_KEY, TASK_METADATA_NAMESPACE, taskItemSchema } from './shared';
import type { TaskItem } from './shared';

const inputSchema = z.object({});

const outputSchema = z.object({
  total: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  inProgress: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  allComplete: z.boolean(),
  tasks: z.array(taskItemSchema),
});

function summarize(tasks: TaskItem[]) {
  let pending = 0;
  let inProgress = 0;
  let completed = 0;
  for (const t of tasks) {
    if (t.status === 'pending') pending++;
    else if (t.status === 'in_progress') inProgress++;
    else if (t.status === 'completed') completed++;
  }
  return {
    total: tasks.length,
    pending,
    inProgress,
    completed,
    allComplete: tasks.length > 0 && completed === tasks.length,
    tasks,
  };
}

/**
 * `taskCheck` — read the current task list for the active conversation
 * thread (mirror of `taskWrite`). Returns counts plus the raw task array.
 *
 * Use before deciding to wrap up complex work to verify all tracked items
 * are completed. Gracefully returns empty counts when no `threadId` is
 * present in the agent context or no memory storage is configured.
 */
export const taskCheck = createTool({
  id: TASK_CHECK_TOOL_ID,
  description: 'Check the completion status of the current task list. Returns counts and tasks.',
  inputSchema,
  outputSchema,
  execute: async (_input, ctx) => {
    const threadId = ctx.agent?.threadId;
    const storage = ctx.mastra?.getStorage?.();
    if (!threadId || !storage) return summarize([]);

    const memory = await storage.getStore('memory');
    if (!memory) return summarize([]);

    const thread = await memory.getThreadById({ threadId });
    const metadata = (thread?.metadata ?? {}) as Record<string, unknown>;
    const namespace = (metadata[TASK_METADATA_NAMESPACE] ?? {}) as Record<string, unknown>;
    const raw = namespace[TASK_METADATA_KEY];

    const parsed = z.array(taskItemSchema).safeParse(raw);
    const tasks = parsed.success ? parsed.data : [];
    return summarize(tasks);
  },
});
