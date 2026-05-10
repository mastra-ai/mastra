import { z } from 'zod';
import { createTool } from '../tool';
import { TASK_METADATA_KEY, TASK_METADATA_NAMESPACE, TASK_WRITE_TOOL_ID, taskItemSchema } from './shared';
import type { TaskItem } from './shared';

const inputSchema = z.object({
  tasks: z.array(taskItemSchema).describe('The complete updated task list (replaces previous list).'),
});

const outputSchema = z.object({
  written: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  inProgress: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  summary: z.string(),
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
    written: tasks.length,
    pending,
    inProgress,
    completed,
    summary: `${tasks.length} task(s): ${pending} pending, ${inProgress} in progress, ${completed} completed`,
  };
}

/**
 * `taskWrite` — persist a structured task list on the active conversation
 * thread. Tasks live at `thread.metadata.mastra.tasks` via
 * `MemoryStorage.updateThread`.
 *
 * Pass the full task list each call (it replaces the previous list). Mark
 * tasks `in_progress` before starting work and `completed` immediately after
 * finishing — only one task should be `in_progress` at a time.
 *
 * Gracefully degrades to a no-op when no `threadId` is in context or no
 * memory storage is configured; in that case the tool still reports counts.
 */
export const taskWrite = createTool({
  id: TASK_WRITE_TOOL_ID,
  description:
    'Create and manage a structured task list for the current conversation. Pass the FULL task list each time (replaces previous).',
  inputSchema,
  outputSchema,
  execute: async (input, ctx) => {
    const tasks = input.tasks ?? [];
    const counts = summarize(tasks);

    const threadId = ctx.agent?.threadId;
    const storage = ctx.mastra?.getStorage?.();

    if (!threadId || !storage) {
      return {
        ...counts,
        summary:
          counts.summary +
          (threadId
            ? ' (no memory storage configured — tasks not persisted)'
            : ' (no thread context — tasks not persisted)'),
      };
    }

    const memory = await storage.getStore('memory');
    if (!memory) {
      return {
        ...counts,
        summary: counts.summary + ' (memory store unavailable — tasks not persisted)',
      };
    }

    const existing = await memory.getThreadById({ threadId });
    const existingMetadata = (existing?.metadata ?? {}) as Record<string, unknown>;
    const existingNamespace = (existingMetadata[TASK_METADATA_NAMESPACE] ?? {}) as Record<string, unknown>;

    const nextMetadata = {
      ...existingMetadata,
      [TASK_METADATA_NAMESPACE]: {
        ...existingNamespace,
        [TASK_METADATA_KEY]: tasks,
      },
    } as Record<string, unknown>;

    await memory.updateThread({
      id: threadId,
      title: existing?.title ?? '',
      metadata: nextMetadata,
    });

    return counts;
  },
});
