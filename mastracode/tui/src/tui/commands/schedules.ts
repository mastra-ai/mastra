import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describeScheduleSource, parseInterval, shortScheduleId, validateInterval } from '@mastra/code-sdk/schedules';
import type {
  ScheduleFile,
  ScheduleTrigger,
  ThreadSchedule,
  ThreadScheduler,
  ThreadScheduleSource,
} from '@mastra/code-sdk/schedules';
import { askModalQuestion } from '../modal-question.js';
import type { SlashCommandContext } from './types.js';

const CREATE_LABEL = 'Create schedule';

const SOURCE_OPTIONS = [
  { label: 'Prompt', description: 'Send the same text every time' },
  { label: 'Prompt file', description: 'Re-read a file and send its contents every time' },
  { label: 'Script', description: 'Run a script and send its output every time' },
] as const;
type SourceKind = (typeof SOURCE_OPTIONS)[number]['label'];

const CADENCE_OPTIONS = [
  { label: '1m', description: 'every minute' },
  { label: '5m', description: 'at :00, :05, :10, …' },
  { label: '10m', description: 'at :00, :10, :20, …' },
  { label: '15m', description: 'at :00, :15, :30, :45' },
  { label: '30m', description: 'at :00 and :30' },
  { label: '1h', description: 'on the hour' },
  { label: '2h', description: 'at 00:00, 02:00, 04:00, …' },
  { label: '6h', description: 'at 00:00, 06:00, 12:00, 18:00' },
  { label: '12h', description: 'at midnight and noon' },
  { label: '1d', description: 'at midnight' },
];

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

function scheduleLabel(schedule: ThreadSchedule): string {
  const timing = schedule.status === 'paused' ? 'paused' : `next in ${formatNextFire(schedule.nextFireAt)}`;
  return `${shortScheduleId(schedule.id)}  every ${schedule.trigger.interval.label} · ${timing}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** `/schedules`: a picker to create a schedule or manage the ones on this thread. */
export async function handleSchedulesCommand(ctx: SlashCommandContext, args: string[] = []): Promise<void> {
  const scheduler = ctx.threadScheduler;
  if (!scheduler) {
    ctx.showError('Schedules are unavailable in this session.');
    return;
  }
  if (args.length > 0) {
    ctx.showError('/schedules takes no arguments; it opens a menu to create and manage schedules.');
    return;
  }

  // A pending /new thread has no schedules yet; don't show the old thread's.
  const { threadId } = ctx.state.pendingNewThread ? {} : await resolveThread(ctx);
  const schedules = threadId ? scheduler.list({ threadId }) : [];
  const rows = new Map(schedules.map(schedule => [scheduleLabel(schedule), schedule]));

  const picked = await askModalQuestion(ctx.state.ui, {
    question:
      schedules.length === 0 ? 'No schedules on this thread yet.' : `Schedules on this thread (${schedules.length}):`,
    options: [
      { label: CREATE_LABEL, description: 'Send a prompt on a recurring cadence' },
      ...[...rows].map(([label, schedule]) => ({ label, description: describeScheduleSource(schedule) })),
    ],
    allowCustomResponse: false,
  });
  if (!picked) return;
  if (picked === CREATE_LABEL) {
    await createScheduleFlow(ctx, scheduler);
    return;
  }
  const schedule = rows.get(picked);
  if (schedule) await manageScheduleFlow(ctx, scheduler, schedule);
}

async function createScheduleFlow(ctx: SlashCommandContext, scheduler: ThreadScheduler): Promise<void> {
  const kind = (await askModalQuestion(ctx.state.ui, {
    question: 'What should each fire send?',
    options: [...SOURCE_OPTIONS],
    allowCustomResponse: false,
  })) as SourceKind | null;
  if (!kind) return;

  const source = await askSource(ctx, kind);
  if (!source) return;

  const trigger = await askTrigger(ctx);
  if (!trigger) return;

  const summary = `every ${trigger.interval.label} — ${describeScheduleSource(source)}`;
  const confirm = await askModalQuestion(ctx.state.ui, {
    question: `Create schedule ${summary}?\nIt fires on clock boundaries and lasts until this Mastra Code session exits.`,
    options: [{ label: 'Create' }, { label: 'Cancel' }],
    allowCustomResponse: false,
  });
  if (confirm !== 'Create') return;

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
  const schedule = scheduler.create(
    { ...source, trigger },
    { threadId: target.threadId, resourceId: target.resourceId },
  );
  ctx.showInfo(
    `Created schedule ${shortScheduleId(schedule.id)}: ${summary}, next in ${formatNextFire(schedule.nextFireAt)}.`,
  );
}

async function askSource(ctx: SlashCommandContext, kind: SourceKind): Promise<ThreadScheduleSource | null> {
  if (kind === 'Prompt') {
    const prompt = await askModalQuestion(ctx.state.ui, { question: 'Prompt to send on every fire:' });
    return prompt?.trim() ? { prompt: prompt.trim() } : null;
  }

  const file = await askFile(ctx, kind === 'Script' ? 'script' : 'prompt');
  if (!file) return null;
  if (kind === 'Prompt file') return { file };

  const extra = await askModalQuestion(ctx.state.ui, {
    question: 'Prompt to send after the script output (optional, Enter to skip):',
    allowEmptyInput: true,
  });
  if (extra === null) return null;
  return extra.trim() ? { file, extraPrompt: extra.trim() } : { file };
}

async function askFile(ctx: SlashCommandContext, mode: ScheduleFile['mode']): Promise<ScheduleFile | null> {
  const cwd = ctx.state.projectInfo.rootPath;
  const noun = mode === 'script' ? 'script to run' : 'file to send';
  let problem = '';
  for (;;) {
    const answer = await askModalQuestion(ctx.state.ui, {
      question: `${problem}Path to the ${noun} (relative to ${cwd}):`,
    });
    const token = answer?.trim();
    if (!token) return null;
    const expanded = token.startsWith('~/') ? path.join(os.homedir(), token.slice(2)) : token;
    const absPath = path.resolve(cwd, expanded);
    if (isFile(absPath)) return { path: absPath, displayPath: token, mode };
    problem = `No file at ${absPath}.\n`;
  }
}

function isFile(absPath: string): boolean {
  try {
    return fs.statSync(absPath).isFile();
  } catch {
    return false;
  }
}

async function askTrigger(ctx: SlashCommandContext): Promise<ScheduleTrigger | null> {
  let problem = '';
  for (;;) {
    const answer = await askModalQuestion(ctx.state.ui, {
      question: `${problem}How often? Minute steps must divide an hour; hour steps must divide a day.`,
      options: CADENCE_OPTIONS,
      allowCustomResponse: true,
    });
    if (!answer) return null;
    const interval = parseInterval(answer);
    if ('error' in interval) {
      problem = `${interval.error}\n`;
      continue;
    }
    const check = validateInterval(interval);
    if ('error' in check) {
      problem = `${check.error}${check.suggestion ? ` Try ${check.suggestion}.` : ''}\n`;
      continue;
    }
    return { kind: 'every', interval };
  }
}

async function manageScheduleFlow(
  ctx: SlashCommandContext,
  scheduler: ThreadScheduler,
  schedule: ThreadSchedule,
): Promise<void> {
  const id = shortScheduleId(schedule.id);
  const action = await askModalQuestion(ctx.state.ui, {
    question: `Schedule ${id}: every ${schedule.trigger.interval.label} — ${describeScheduleSource(schedule)}`,
    options: [
      schedule.status === 'paused'
        ? { label: 'Resume', description: 'Fire again from the next clock boundary' }
        : { label: 'Pause', description: 'Stop firing until resumed' },
      { label: 'Run now', description: 'Fire once now without changing the cadence' },
      { label: 'Delete', description: 'Remove this schedule' },
    ],
    allowCustomResponse: false,
  });

  switch (action) {
    case 'Pause':
      scheduler.pause(schedule.id);
      ctx.showInfo(`Paused schedule ${id}.`);
      return;
    case 'Resume':
      scheduler.resume(schedule.id);
      ctx.showInfo(`Resumed schedule ${id}.`);
      return;
    case 'Run now':
      if (scheduler.isFiring(schedule.id)) {
        ctx.showInfo(`Schedule ${id} is already firing; skipped so its prompt isn't sent twice.`);
        return;
      }
      // Scripts can run for up to a minute; report the outcome when it lands
      // instead of holding the command open.
      void scheduler.run(schedule.id).then(result => {
        if (result.status === 'failed') {
          ctx.showError(`Schedule ${id} failed to fire: ${errorMessage(result.error)}`);
        }
      });
      ctx.showInfo(`Triggered schedule ${id}.`);
      return;
    case 'Delete': {
      const confirm = await askModalQuestion(ctx.state.ui, {
        question: `Delete schedule ${id}?`,
        options: [{ label: 'Delete' }, { label: 'Cancel' }],
        allowCustomResponse: false,
      });
      if (confirm !== 'Delete') return;
      scheduler.delete(schedule.id);
      ctx.showInfo(`Deleted schedule ${id}.`);
      return;
    }
  }
}
