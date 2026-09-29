/**
 * Agent-facing tools for the process-local `/schedules` scheduler.
 *
 * Opt-in (experimental setting). Every tool is bound to the thread of the run
 * that calls it — the model never picks a thread or resource — and can only
 * see or manage schedules on that thread.
 */
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { resolveScheduleFile } from './args.js';
import type { ScheduleCreateArgsOptions } from './args.js';
import { parseInterval, validateInterval } from './interval.js';
import { describeScheduleSource, shortScheduleId } from './scheduler.js';
import type { ThreadSchedule, ThreadScheduler } from './scheduler.js';

export const SCHEDULE_TOOL_IDS = {
  create: 'schedule_create',
  list: 'schedule_list',
  update: 'schedule_update',
  run: 'schedule_run',
} as const;

export type ScheduleToolsOptions = {
  scheduler: ThreadScheduler;
  /** Resolves relative file paths, like `/schedules create` does. */
  fileOptions: () => ScheduleCreateArgsOptions;
};

type ToolRunContext = { agent?: { threadId?: string; resourceId?: string } };

const resultSchema = z.object({
  content: z.string(),
  isError: z.boolean().optional(),
});
type ScheduleToolResult = z.infer<typeof resultSchema>;

const intervalSchema = z
  .string()
  .min(1)
  .superRefine((value, ctx) => {
    const interval = parseInterval(value);
    if ('error' in interval) {
      ctx.addIssue({ code: 'custom', message: interval.error });
      return;
    }
    const check = validateInterval(interval);
    if ('error' in check) {
      const suggestion = check.suggestion ? ` Try ${check.suggestion}.` : '';
      ctx.addIssue({ code: 'custom', message: `${check.error}${suggestion}` });
    }
  })
  .describe('Cadence such as "5m", "2h", or "1d". Minute steps must divide 60, hour steps must divide 24.');

const idSchema = z.string().min(1).describe('Schedule id, or a unique prefix of it (the 8-character short id works).');

function threadOf(context: unknown): { threadId: string; resourceId: string } | undefined {
  const agent = (context as ToolRunContext | undefined)?.agent;
  return agent?.threadId && agent.resourceId ? { threadId: agent.threadId, resourceId: agent.resourceId } : undefined;
}

const NO_THREAD: ScheduleToolResult = { content: 'Schedules require a memory-backed thread.', isError: true };

function formatSchedule(schedule: ThreadSchedule): string {
  const timing =
    schedule.status === 'paused' ? 'paused' : `next at ${new Date(schedule.nextFireAt).toLocaleTimeString()}`;
  return `${shortScheduleId(schedule.id)}  every ${schedule.interval.label}  ${timing}  ${describeScheduleSource(schedule)}  (created by ${schedule.createdBy})`;
}

function findOne(
  scheduler: ThreadScheduler,
  threadId: string,
  id: string,
): { schedule: ThreadSchedule } | ScheduleToolResult {
  const needle = id.toLowerCase();
  const matches = scheduler.list({ threadId }).filter(schedule => schedule.id.toLowerCase().startsWith(needle));
  if (matches.length === 1) return { schedule: matches[0]! };
  return {
    content: matches.length === 0 ? `No schedule "${id}" on this thread.` : `"${id}" matches several schedules.`,
    isError: true,
  };
}

export function createScheduleTools({ scheduler, fileOptions }: ScheduleToolsOptions) {
  const scheduleCreateTool = createTool({
    id: SCHEDULE_TOOL_IDS.create,
    description: `Schedule a recurring prompt on this thread. Each fire arrives as a new user turn labelled "schedule".

Pass either "prompt" (text sent each fire) or "file". A script file (executable, or .sh/.js/.mjs/.cjs/.ts/.py) runs each fire and its output is sent; any other file is re-read and sent as the prompt. "extraPrompt" is appended after the file's output. Schedules fire on wall-clock boundaries (5m fires at :00, :05, …) and live only until Mastra Code exits.`,
    inputSchema: z
      .object({
        interval: intervalSchema,
        prompt: z.string().trim().min(1).optional().describe('Prompt text to send on every fire.'),
        file: z.string().trim().min(1).optional().describe('Path to a script to run, or a file to send as the prompt.'),
        extraPrompt: z.string().trim().min(1).optional().describe('Text appended after the file output.'),
      })
      .refine(input => Boolean(input.prompt) !== Boolean(input.file), {
        message: 'Provide exactly one of "prompt" or "file".',
      })
      .refine(input => !input.extraPrompt || input.file, {
        message: '"extraPrompt" only applies with "file".',
      }),
    outputSchema: resultSchema,
    execute: async (input, context): Promise<ScheduleToolResult> => {
      const target = threadOf(context);
      if (!target) return NO_THREAD;
      const interval = parseInterval(input.interval);
      if ('error' in interval) return { content: interval.error, isError: true };
      let file: ReturnType<typeof resolveScheduleFile>;
      if (input.file) {
        file = resolveScheduleFile(input.file, fileOptions());
        if (!file) return { content: `File not found: ${input.file}`, isError: true };
      }
      const schedule = scheduler.create(
        {
          interval,
          ...(file ? { file, ...(input.extraPrompt ? { extraPrompt: input.extraPrompt } : {}) } : {}),
          ...(input.prompt ? { prompt: input.prompt } : {}),
          createdBy: 'agent',
        },
        target,
      );
      return { content: `Created schedule ${formatSchedule(schedule)}` };
    },
  });

  const scheduleListTool = createTool({
    id: SCHEDULE_TOOL_IDS.list,
    description: 'List the recurring prompt schedules on this thread, including ones the user created with /schedules.',
    inputSchema: z.object({}),
    outputSchema: resultSchema,
    execute: async (_input, context): Promise<ScheduleToolResult> => {
      const target = threadOf(context);
      if (!target) return NO_THREAD;
      const schedules = scheduler.list({ threadId: target.threadId });
      if (schedules.length === 0) return { content: 'No schedules on this thread.' };
      return {
        content: [`Schedules on this thread (${schedules.length}):`, ...schedules.map(formatSchedule)].join('\n'),
      };
    },
  });

  const scheduleUpdateTool = createTool({
    id: SCHEDULE_TOOL_IDS.update,
    description: 'Pause, resume, or delete a schedule on this thread.',
    inputSchema: z.object({
      id: idSchema,
      action: z.enum(['pause', 'resume', 'delete']),
    }),
    outputSchema: resultSchema,
    execute: async ({ id, action }, context): Promise<ScheduleToolResult> => {
      const target = threadOf(context);
      if (!target) return NO_THREAD;
      const found = findOne(scheduler, target.threadId, id);
      if (!('schedule' in found)) return found;
      scheduler[action](found.schedule.id);
      const verb = { pause: 'Paused', resume: 'Resumed', delete: 'Deleted' }[action];
      return { content: `${verb} schedule ${shortScheduleId(found.schedule.id)}.` };
    },
  });

  const scheduleRunTool = createTool({
    id: SCHEDULE_TOOL_IDS.run,
    description:
      'Fire a schedule on this thread once now, without changing its cadence. Its prompt arrives as the next user turn.',
    inputSchema: z.object({ id: idSchema }),
    outputSchema: resultSchema,
    execute: async ({ id }, context): Promise<ScheduleToolResult> => {
      const target = threadOf(context);
      if (!target) return NO_THREAD;
      const found = findOne(scheduler, target.threadId, id);
      if (!('schedule' in found)) return found;
      const short = shortScheduleId(found.schedule.id);
      if (scheduler.isFiring(found.schedule.id)) {
        return { content: `Schedule ${short} is already firing; skipped so its prompt isn't sent twice.` };
      }
      // Don't hold the tool call open for a script that may run up to a minute.
      void scheduler.run(found.schedule.id);
      return { content: `Triggered schedule ${short}; its prompt arrives as the next turn.` };
    },
  });

  return {
    [SCHEDULE_TOOL_IDS.create]: scheduleCreateTool,
    [SCHEDULE_TOOL_IDS.list]: scheduleListTool,
    [SCHEDULE_TOOL_IDS.update]: scheduleUpdateTool,
    [SCHEDULE_TOOL_IDS.run]: scheduleRunTool,
  };
}
