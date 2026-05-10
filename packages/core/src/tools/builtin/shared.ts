import { z } from 'zod';

/**
 * Stable tool IDs for the built-in Mastra tools. These are the discriminators
 * the Harness uses to route `ask_user` / `submit_plan` suspensions into
 * `pendingResume.kind = 'question' | 'plan-approval'`. Imported on both sides
 * (tool factories and harness session) so the contract lives in one place.
 */
export const ASK_USER_TOOL_ID = 'ask_user';
export const SUBMIT_PLAN_TOOL_ID = 'submit_plan';
export const TASK_WRITE_TOOL_ID = 'task_write';
export const TASK_CHECK_TOOL_ID = 'task_check';

/**
 * Key under which `taskWrite` persists the task list on a thread.
 * Tasks live at `thread.metadata.mastra.tasks` (nested under `mastra` to
 * avoid collisions with userland thread metadata).
 */
export const TASK_METADATA_NAMESPACE = 'mastra' as const;
export const TASK_METADATA_KEY = 'tasks' as const;

/** A single tracked task. Shape matches the legacy harness `TaskItem`. */
export const taskItemSchema = z.object({
  content: z.string().describe('Task description in imperative form'),
  status: z.enum(['pending', 'in_progress', 'completed']),
  activeForm: z.string().describe('Present-continuous form shown during execution'),
});

export type TaskItem = z.infer<typeof taskItemSchema>;

/** Question options surfaced by `askUser`. */
export const askUserOptionSchema = z.object({
  label: z.string(),
  description: z.string().optional(),
});

export type AskUserOption = z.infer<typeof askUserOptionSchema>;

export const askUserSelectionModeSchema = z.enum(['single_select', 'multi_select']);
export type AskUserSelectionMode = z.infer<typeof askUserSelectionModeSchema>;
