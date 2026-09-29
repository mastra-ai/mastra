import * as fs from 'node:fs';
import * as os from 'node:os';
import { describeScheduleSource, parseScheduleCreateArgs, shortScheduleId } from '@mastra/code-sdk/schedules';
import type { ThreadSchedule, ThreadScheduler } from '@mastra/code-sdk/schedules';
import type { SlashCommandContext } from './types.js';

const MAX_SCHEDULES_PER_THREAD = 10;
const USAGE = 'Usage: /schedules [create <interval> <prompt|file [extra prompt]> | delete|pause|resume|run [id]]';

async function resolveThread(ctx: SlashCommandContext): Promise<{ threadId?: string; resourceId?: string }> {
  const session = ctx.state.session as unknown as {
    identity?: { getResourceId?: () => string | undefined };
    thread?: {
      getId?: () => string | undefined;
      list?: (input?: { allResources?: boolean }) => Promise<Array<{ id: string; resourceId?: string }>>;
    };
  };
  const threadId = session?.thread?.getId?.();
  if (!threadId) return {};
  const thread = (await session?.thread?.list?.({ allResources: true }))?.find(item => item.id === threadId);
  return { threadId, resourceId: thread?.resourceId ?? session?.identity?.getResourceId?.() };
}

function formatNextFire(nextFireAt: number): string {
  const deltaMs = nextFireAt - Date.now();
  if (deltaMs <= 0) return 'now';
  const minutes = Math.round(deltaMs / 60_000);
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function formatSchedule(schedule: ThreadSchedule): string {
  const timing = schedule.status === 'paused' ? 'paused' : `next in ${formatNextFire(schedule.nextFireAt)}`;
  return `  ${shortScheduleId(schedule.id)}  every ${schedule.interval.label}  ${timing}  ${describeScheduleSource(schedule)}`;
}

function formatList(schedules: ThreadSchedule[]): string {
  return [`Schedules on this thread (${schedules.length}):`, ...schedules.map(formatSchedule)].join('\n');
}

function matchById(schedules: ThreadSchedule[], idPrefix: string): ThreadSchedule[] {
  const needle = idPrefix.toLowerCase();
  return schedules.filter(schedule => schedule.id.toLowerCase().startsWith(needle));
}

export async function handleSchedulesCommand(ctx: SlashCommandContext, args: string[]): Promise<void> {
  const scheduler = ctx.threadScheduler;
  if (!scheduler) {
    ctx.showError('Schedules are unavailable in this session.');
    return;
  }

  const { threadId, resourceId } = await resolveThread(ctx);
  if (!threadId || !resourceId) {
    ctx.showError('Schedules need an active thread. Send a message first, then try again.');
    return;
  }

  const [subcommand, ...rest] = args;
  const sub = subcommand?.toLowerCase();

  if (!sub) {
    const schedules = scheduler.list({ threadId });
    ctx.showInfo(
      schedules.length === 0
        ? 'No schedules on this thread. Use /schedules create <interval> <prompt|file>.'
        : formatList(schedules),
    );
    return;
  }

  if (sub === 'create') {
    createSchedule(ctx, scheduler, rest, { threadId, resourceId });
    return;
  }

  if (sub === 'delete' || sub === 'pause' || sub === 'resume' || sub === 'run') {
    manageSchedule(ctx, scheduler, sub, rest[0], threadId);
    return;
  }

  ctx.showError(`Unknown subcommand "${subcommand}". ${USAGE}`);
}

function createSchedule(
  ctx: SlashCommandContext,
  scheduler: ThreadScheduler,
  args: string[],
  target: { threadId: string; resourceId: string },
): void {
  const parsed = parseScheduleCreateArgs(args, {
    cwd: ctx.state.projectInfo.rootPath,
    homeDir: os.homedir(),
    fileExists: absPath => {
      try {
        return fs.statSync(absPath).isFile();
      } catch {
        return false;
      }
    },
    isExecutable: absPath => {
      try {
        fs.accessSync(absPath, fs.constants.X_OK);
        return true;
      } catch {
        return false;
      }
    },
  });
  if ('error' in parsed) {
    ctx.showError(`${parsed.error}\n${USAGE}`);
    return;
  }

  if (scheduler.list({ threadId: target.threadId }).length >= MAX_SCHEDULES_PER_THREAD) {
    ctx.showError(
      `This thread already has ${MAX_SCHEDULES_PER_THREAD} schedules. Delete one with /schedules delete <id> first.`,
    );
    return;
  }

  const schedule = scheduler.create(parsed, target);
  const lines = [
    `Created schedule ${shortScheduleId(schedule.id)}: every ${schedule.interval.label}, next in ${formatNextFire(schedule.nextFireAt)} — ${describeScheduleSource(schedule)}`,
    'Fires on clock boundaries (e.g. 5m fires at :00, :05, ...) and lasts until this Mastra Code session exits.',
  ];
  if (parsed.warning) lines.push(`Note: ${parsed.warning}`);
  ctx.showInfo(lines.join('\n'));
}

function manageSchedule(
  ctx: SlashCommandContext,
  scheduler: ThreadScheduler,
  action: 'delete' | 'pause' | 'resume' | 'run',
  idPrefix: string | undefined,
  threadId: string,
): void {
  const schedules = scheduler.list({ threadId });
  if (schedules.length === 0) {
    ctx.showError('No schedules on this thread.');
    return;
  }

  let targets: ThreadSchedule[];
  if (idPrefix) {
    targets = matchById(schedules, idPrefix);
    if (targets.length === 0) {
      ctx.showError(`No schedule matching "${idPrefix}".\n${formatList(schedules)}`);
      return;
    }
    if (targets.length > 1) {
      ctx.showError(`"${idPrefix}" matches ${targets.length} schedules; give more of the id.\n${formatList(targets)}`);
      return;
    }
  } else if (schedules.length === 1 || action === 'delete') {
    targets = schedules;
  } else {
    ctx.showError(
      `Several schedules on this thread; specify an id: /schedules ${action} <id>\n${formatList(schedules)}`,
    );
    return;
  }

  for (const schedule of targets) {
    // `run` resolves after the prompt is assembled and handed to the agent
    // (scripts can take up to a minute); fire failures are reported by the
    // scheduler, so don't hold the command open for it.
    if (action === 'run') void scheduler.run(schedule.id);
    else scheduler[action](schedule.id);
  }
  const verbs = { delete: 'Deleted', pause: 'Paused', resume: 'Resumed', run: 'Triggered' } as const;
  const ids = targets.map(schedule => shortScheduleId(schedule.id)).join(', ');
  ctx.showInfo(`${verbs[action]} schedule${targets.length > 1 ? 's' : ''} ${ids}`);
}
