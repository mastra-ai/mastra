import * as fs from 'node:fs';
import * as os from 'node:os';
import { describeScheduleSource, parseScheduleCreateArgs, shortScheduleId } from '@mastra/code-sdk/schedules';
import type { ScheduleCreateSpec, ThreadSchedule, ThreadScheduler } from '@mastra/code-sdk/schedules';
import type { SlashCommandContext } from './types.js';

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

  const [subcommand, ...rest] = args;
  const sub = subcommand?.toLowerCase();
  if (sub && !['create', 'delete', 'pause', 'resume', 'run'].includes(sub)) {
    ctx.showError(`Unknown subcommand "${subcommand}". ${USAGE}`);
    return;
  }

  if (sub === 'create') {
    const parsed = parseCreateArgs(ctx, rest);
    if ('error' in parsed) {
      ctx.showError(`${parsed.error}\n${USAGE}`);
      return;
    }
    // After /new the session still reports the previous thread's id until the
    // new thread is created, so create it now rather than binding the schedule
    // to the thread the user just left.
    if (ctx.state.pendingNewThread || !ctx.state.session.thread.getId()) {
      await ctx.state.session.thread.create();
      ctx.state.pendingNewThread = false;
    }
    const target = await resolveThread(ctx);
    if (!target.threadId || !target.resourceId) {
      ctx.showError('Schedules need an active thread. Send a message first, then try again.');
      return;
    }
    createSchedule(ctx, scheduler, parsed, { threadId: target.threadId, resourceId: target.resourceId });
    return;
  }

  // A pending /new thread has no schedules yet; don't show the old thread's.
  const { threadId } = ctx.state.pendingNewThread ? {} : await resolveThread(ctx);
  if (!sub) {
    const schedules = threadId ? scheduler.list({ threadId }) : [];
    ctx.showInfo(
      schedules.length === 0
        ? 'No schedules on this thread. Use /schedules create <interval> <prompt|file>.'
        : formatList(schedules),
    );
    return;
  }
  manageSchedule(ctx, scheduler, sub as 'delete' | 'pause' | 'resume' | 'run', rest[0], threadId);
}

function parseCreateArgs(ctx: SlashCommandContext, args: string[]): ReturnType<typeof parseScheduleCreateArgs> {
  return parseScheduleCreateArgs(args, {
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
}

function createSchedule(
  ctx: SlashCommandContext,
  scheduler: ThreadScheduler,
  parsed: ScheduleCreateSpec,
  target: { threadId: string; resourceId: string },
): void {
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
  threadId: string | undefined,
): void {
  const schedules = threadId ? scheduler.list({ threadId }) : [];
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
  } else if (schedules.length === 1) {
    targets = schedules;
  } else {
    ctx.showError(
      `Several schedules on this thread; specify an id: /schedules ${action} <id>\n${formatList(schedules)}`,
    );
    return;
  }

  const schedule = targets[0]!;
  const id = shortScheduleId(schedule.id);
  if (action === 'run') {
    if (scheduler.isFiring(schedule.id)) {
      ctx.showInfo(`Schedule ${id} is already firing; skipped so its prompt isn't sent twice.`);
      return;
    }
    // `run` resolves after the prompt is assembled and handed to the agent
    // (scripts can take up to a minute); fire failures are reported by the
    // scheduler, so don't hold the command open for it.
    void scheduler.run(schedule.id);
    ctx.showInfo(`Triggered schedule ${id}`);
    return;
  }
  scheduler[action](schedule.id);
  const verbs = { delete: 'Deleted', pause: 'Paused', resume: 'Resumed' } as const;
  ctx.showInfo(`${verbs[action]} schedule ${id}`);
}
