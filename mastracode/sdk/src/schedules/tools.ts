/**
 * Agent-facing tools for the process-local `/schedules` scheduler.
 *
 * Opt-in (experimental setting). Every tool is bound to the thread of the run
 * that calls it — the model never picks a thread or resource — and can only
 * see or manage schedules on that thread.
 */
import * as path from 'node:path';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { parseInterval, validateInterval } from './interval.js';
import { describeScheduleSource, shortScheduleId } from './scheduler.js';
import type { ScheduleFile, ThreadSchedule, ThreadScheduler } from './scheduler.js';

export const SCHEDULE_TOOL_IDS = {
  create: 'schedule_create',
  list: 'schedule_list',
  update: 'schedule_update',
  resume: 'schedule_resume',
  run: 'schedule_run',
} as const;

export type ScheduleFileOptions = {
  /** Directory relative paths resolve against (the project root). */
  cwd: string;
  homeDir?: string;
  fileExists: (absPath: string) => boolean;
};

export type ScheduleToolsOptions = {
  scheduler: ThreadScheduler;
  fileOptions: () => ScheduleFileOptions;
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
  .transform((value, ctx) => {
    const interval = parseInterval(value);
    if ('error' in interval) {
      ctx.addIssue({ code: 'custom', message: interval.error });
      return z.NEVER;
    }
    const check = validateInterval(interval);
    if ('error' in check) {
      const suggestion = check.suggestion ? ` Try ${check.suggestion}.` : '';
      ctx.addIssue({ code: 'custom', message: `${check.error}${suggestion}` });
      return z.NEVER;
    }
    return interval;
  })
  .describe('Cadence such as "5m", "2h", or "1d". Minute steps must divide 60, hour steps must divide 24.');

const triggerSchema = z
  .discriminatedUnion('kind', [
    z.object({
      kind: z.literal('every'),
      interval: intervalSchema,
    }),
  ])
  .describe('When the schedule fires. "every" repeats on wall-clock boundaries (5m fires at :00, :05, …).');

const idSchema = z.string().min(1).describe('Schedule id, or a unique prefix of it (the 8-character short id works).');

function threadOf(context: unknown): { threadId: string; resourceId: string } | undefined {
  const agent = (context as ToolRunContext | undefined)?.agent;
  return agent?.threadId && agent.resourceId ? { threadId: agent.threadId, resourceId: agent.resourceId } : undefined;
}

const NO_THREAD: ScheduleToolResult = { content: 'Schedules require a memory-backed thread.', isError: true };

function resolveFile(
  token: string,
  mode: ScheduleFile['mode'],
  options: ScheduleFileOptions,
): ScheduleFile | undefined {
  const expanded = token.startsWith('~/') && options.homeDir ? path.join(options.homeDir, token.slice(2)) : token;
  const absPath = path.resolve(options.cwd, expanded);
  return options.fileExists(absPath) ? { path: absPath, displayPath: token, mode } : undefined;
}

function formatSchedule(schedule: ThreadSchedule): string {
  const timing =
    schedule.status === 'paused' ? 'paused' : `next at ${new Date(schedule.nextFireAt).toLocaleTimeString()}`;
  return `${shortScheduleId(schedule.id)}  every ${schedule.trigger.interval.label}  ${timing}  ${describeScheduleSource(schedule)}  (created by ${schedule.createdBy})`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

Pass exactly one source: "prompt" (text sent each fire), "promptFile" (a file re-read and sent as the prompt each fire), or "script" (run each fire; its output is sent, followed by "extraPrompt" if given). Schedules live only until Mastra Code exits.`,
    inputSchema: z
      .object({
        trigger: triggerSchema,
        prompt: z.string().trim().min(1).optional().describe('Prompt text to send on every fire.'),
        promptFile: z.string().trim().min(1).optional().describe('Path to a file to re-read and send on every fire.'),
        script: z.string().trim().min(1).optional().describe('Path to a script to run on every fire.'),
        extraPrompt: z.string().trim().min(1).optional().describe('Text sent after the script output.'),
      })
      .refine(input => [input.prompt, input.promptFile, input.script].filter(Boolean).length === 1, {
        message: 'Provide exactly one of "prompt", "promptFile", or "script".',
      })
      .refine(input => !input.extraPrompt || input.script, {
        message: '"extraPrompt" only applies with "script".',
      }),
    outputSchema: resultSchema,
    execute: async (input, context): Promise<ScheduleToolResult> => {
      const target = threadOf(context);
      if (!target) return NO_THREAD;
      let schedule: ThreadSchedule;
      if (input.prompt) {
        schedule = scheduler.create({ trigger: input.trigger, prompt: input.prompt, createdBy: 'agent' }, target);
      } else {
        const token = (input.script ?? input.promptFile)!;
        const file = resolveFile(token, input.script ? 'script' : 'prompt', fileOptions());
        if (!file) return { content: `File not found: ${token}`, isError: true };
        schedule = scheduler.create(
          {
            trigger: input.trigger,
            file,
            ...(input.extraPrompt ? { extraPrompt: input.extraPrompt } : {}),
            createdBy: 'agent',
          },
          target,
        );
      }
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
    description: 'Pause or delete a schedule on this thread. Use schedule_resume to resume a paused one.',
    inputSchema: z.object({
      id: idSchema,
      action: z.enum(['pause', 'delete']),
    }),
    outputSchema: resultSchema,
    execute: async ({ id, action }, context): Promise<ScheduleToolResult> => {
      const target = threadOf(context);
      if (!target) return NO_THREAD;
      const found = findOne(scheduler, target.threadId, id);
      if (!('schedule' in found)) return found;
      scheduler[action](found.schedule.id);
      const verb = action === 'pause' ? 'Paused' : 'Deleted';
      return { content: `${verb} schedule ${shortScheduleId(found.schedule.id)}.` };
    },
  });

  // Separate from schedule_update: resuming lets the timer run the schedule's
  // script again, so it needs the same approval as creating or running one.
  const scheduleResumeTool = createTool({
    id: SCHEDULE_TOOL_IDS.resume,
    description: 'Resume a paused schedule on this thread. It fires again from the next clock boundary.',
    inputSchema: z.object({ id: idSchema }),
    outputSchema: resultSchema,
    execute: async ({ id }, context): Promise<ScheduleToolResult> => {
      const target = threadOf(context);
      if (!target) return NO_THREAD;
      const found = findOne(scheduler, target.threadId, id);
      if (!('schedule' in found)) return found;
      scheduler.resume(found.schedule.id);
      return { content: `Resumed schedule ${shortScheduleId(found.schedule.id)}.` };
    },
  });

  const scheduleRunTool = createTool({
    id: SCHEDULE_TOOL_IDS.run,
    description:
      'Fire a schedule on this thread once now, even if it is paused, without changing its cadence. Its prompt arrives as the next user turn.',
    inputSchema: z.object({ id: idSchema }),
    outputSchema: resultSchema,
    execute: async ({ id }, context): Promise<ScheduleToolResult> => {
      const target = threadOf(context);
      if (!target) return NO_THREAD;
      const found = findOne(scheduler, target.threadId, id);
      if (!('schedule' in found)) return found;
      const short = shortScheduleId(found.schedule.id);
      const result = await scheduler.run(found.schedule.id);
      switch (result.status) {
        case 'fired':
          return { content: `Triggered schedule ${short}; its prompt arrives as the next turn.` };
        case 'busy':
          return { content: `Schedule ${short} is already firing; skipped so its prompt isn't sent twice.` };
        case 'not-found':
          return { content: `Schedule ${short} was deleted before it fired.`, isError: true };
        case 'failed':
          return { content: `Schedule ${short} failed to fire: ${errorMessage(result.error)}`, isError: true };
      }
    },
  });

  return {
    [SCHEDULE_TOOL_IDS.create]: scheduleCreateTool,
    [SCHEDULE_TOOL_IDS.list]: scheduleListTool,
    [SCHEDULE_TOOL_IDS.update]: scheduleUpdateTool,
    [SCHEDULE_TOOL_IDS.resume]: scheduleResumeTool,
    [SCHEDULE_TOOL_IDS.run]: scheduleRunTool,
  };
}
