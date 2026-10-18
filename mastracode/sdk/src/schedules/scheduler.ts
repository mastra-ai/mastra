/**
 * Process-local scheduler behind `/schedules`.
 *
 * Schedules live only in this process: timers fire them and they die with it.
 * Nothing is written to shared storage, so other Mastra Code processes on the
 * same database never see — or fire — this session's schedules.
 */
import { randomUUID } from 'node:crypto';
import { nextFireTime, validateInterval } from './interval.js';
import type { ParsedInterval } from './interval.js';
import type { AssembledPrompt } from './prompt.js';

/** `source` attribute on fired signals; the TUI labels these turns `schedule`. */
export const SCHEDULE_SIGNAL_SOURCE = 'schedule';

/** When a schedule fires. Only recurring `every` triggers exist today. */
export type ScheduleTrigger = { kind: 'every'; interval: ParsedInterval };

/** A file a schedule runs as a script, or re-reads and sends as the prompt, on every fire. */
export type ScheduleFile = { path: string; displayPath: string; mode: 'script' | 'prompt' };

/** What to send on each fire: `prompt` text, or a `file` (plus `extraPrompt` appended after it). */
export type ThreadScheduleSource = { prompt: string } | { file: ScheduleFile; extraPrompt?: string };

export type ThreadScheduleSpec = ThreadScheduleSource & {
  trigger: ScheduleTrigger;
  /** Who is creating it: the user via `/schedules`, or the agent via its schedule tools. Defaults to `user`. */
  createdBy?: 'user' | 'agent';
};

export type ThreadSchedule = {
  id: string;
  threadId: string;
  resourceId: string;
  trigger: ScheduleTrigger;
  prompt?: string;
  file?: ScheduleFile;
  extraPrompt?: string;
  createdBy: 'user' | 'agent';
  status: 'active' | 'paused';
  /** Next boundary this schedule fires at; only meaningful while active. */
  nextFireAt: number;
  createdAt: number;
};

export type ThreadSchedulerOptions = {
  /** Build the prompt for one fire (runs scripts / reads files). */
  assemblePrompt: (schedule: ThreadSchedule) => Promise<AssembledPrompt>;
  /** Hand the prompt to the agent for the schedule's thread. */
  deliver: (schedule: ThreadSchedule, assembled: AssembledPrompt) => Promise<void>;
  /** A fire failed before reaching the agent. */
  onError?: (error: unknown, schedule: ThreadSchedule) => void;
  now?: () => number;
};

/** How late a timer may run before its fire counts as missed (sleep, stalled event loop). */
export const LATE_FIRE_GRACE_MS = 60_000;

/**
 * Outcome of a manual `run()`. `failed` means nothing reached the agent: the
 * prompt could not be built or the agent refused it.
 */
export type ScheduleRunResult =
  | { status: 'fired' }
  | { status: 'failed'; error: unknown }
  | { status: 'busy' }
  | { status: 'not-found' };

type FireOutcome = { kind: 'delivered' } | { kind: 'deleted' } | { kind: 'failed'; error: unknown };

type Entry = { schedule: ThreadSchedule; timer?: ReturnType<typeof setTimeout>; inFlight: number };

export class ThreadScheduler {
  #entries = new Map<string, Entry>();
  #options: ThreadSchedulerOptions;

  constructor(options: ThreadSchedulerOptions) {
    this.#options = options;
  }

  #now(): number {
    return this.#options.now?.() ?? Date.now();
  }

  /** Throws when the interval is not a supported wall-clock cadence (see `validateInterval`) or the prompt is empty. */
  create(spec: ThreadScheduleSpec, target: { threadId: string; resourceId: string }): ThreadSchedule {
    const { interval } = spec.trigger;
    const check = validateInterval(interval);
    if ('error' in check) {
      throw new Error(
        `Invalid schedule interval: ${check.error}${check.suggestion ? ` Try ${check.suggestion}.` : ''}`,
      );
    }
    if ('prompt' in spec && !spec.prompt.trim()) throw new Error('Schedule prompt is empty.');
    const now = this.#now();
    const schedule: ThreadSchedule = {
      id: randomUUID(),
      threadId: target.threadId,
      resourceId: target.resourceId,
      trigger: { kind: 'every', interval: { ...interval } },
      ...('file' in spec
        ? { file: { ...spec.file }, ...(spec.extraPrompt ? { extraPrompt: spec.extraPrompt } : {}) }
        : { prompt: spec.prompt }),
      createdBy: spec.createdBy ?? 'user',
      status: 'active',
      nextFireAt: nextFireTime(interval.ms, now),
      createdAt: now,
    };
    const entry: Entry = { schedule, inFlight: 0 };
    this.#entries.set(schedule.id, entry);
    this.#arm(entry);
    return { ...schedule };
  }

  list(filter: { threadId?: string } = {}): ThreadSchedule[] {
    return [...this.#entries.values()]
      .map(entry => ({ ...entry.schedule }))
      .filter(schedule => !filter.threadId || schedule.threadId === filter.threadId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  delete(id: string): boolean {
    const entry = this.#entries.get(id);
    if (!entry) return false;
    clearTimeout(entry.timer);
    this.#entries.delete(id);
    return true;
  }

  pause(id: string): boolean {
    const entry = this.#entries.get(id);
    if (!entry) return false;
    clearTimeout(entry.timer);
    entry.timer = undefined;
    entry.schedule.status = 'paused';
    return true;
  }

  resume(id: string): boolean {
    const entry = this.#entries.get(id);
    if (!entry) return false;
    if (entry.schedule.status === 'active') return true;
    entry.schedule.status = 'active';
    entry.schedule.nextFireAt = nextFireTime(entry.schedule.trigger.interval.ms, this.#now());
    this.#arm(entry);
    return true;
  }

  /** Whether a fire of this schedule (timer or manual) is still assembling or delivering. */
  isFiring(id: string): boolean {
    return (this.#entries.get(id)?.inFlight ?? 0) > 0;
  }

  /**
   * Fire once now, outside the cadence. Returns `busy` without firing when a
   * fire of this schedule is still running (a slow script, say), so the same
   * script never runs twice at once. Resolves once the fire finished; a fire
   * that never reached the agent resolves `failed` instead of calling `onError`.
   */
  async run(id: string): Promise<ScheduleRunResult> {
    const entry = this.#entries.get(id);
    if (!entry) return { status: 'not-found' };
    if (entry.inFlight > 0) return { status: 'busy' };
    const result = await this.#fire(entry);
    if (result.kind === 'failed') return { status: 'failed', error: result.error };
    return result.kind === 'delivered' ? { status: 'fired' } : { status: 'not-found' };
  }

  /** Drop every schedule and timer (process shutdown). */
  stop(): void {
    for (const entry of this.#entries.values()) clearTimeout(entry.timer);
    this.#entries.clear();
  }

  #arm(entry: Entry): void {
    clearTimeout(entry.timer);
    const scheduledAt = entry.schedule.nextFireAt;
    entry.timer = setTimeout(
      () => {
        if (this.#entries.get(entry.schedule.id) !== entry || entry.schedule.status !== 'active') return;
        // Timers can fire a hair early; step from the later of now and the
        // intended boundary so the same boundary is never fired twice.
        const now = this.#now();
        entry.schedule.nextFireAt = nextFireTime(entry.schedule.trigger.interval.ms, Math.max(now, scheduledAt));
        this.#arm(entry);
        // A timer that ran long after its boundary (machine asleep) is a missed fire, not a late one.
        if (now - scheduledAt > LATE_FIRE_GRACE_MS) return;
        // A slow script can outlast a short interval; don't stack fires.
        if (entry.inFlight === 0) {
          void this.#fire(entry).then(result => {
            if (result.kind === 'failed') this.#options.onError?.(result.error, { ...entry.schedule });
          });
        }
      },
      Math.max(0, scheduledAt - this.#now()),
    );
    entry.timer.unref?.();
  }

  async #fire(entry: Entry): Promise<FireOutcome> {
    const schedule = { ...entry.schedule };
    entry.inFlight++;
    try {
      const assembled = await this.#options.assemblePrompt(schedule);
      // Deleted while its prompt was being built: drop the fire quietly.
      if (this.#entries.get(schedule.id) !== entry) return { kind: 'deleted' };
      await this.#options.deliver(schedule, assembled);
      return { kind: 'delivered' };
    } catch (error) {
      return { kind: 'failed', error };
    } finally {
      entry.inFlight--;
    }
  }
}

export function shortScheduleId(id: string): string {
  return id.slice(0, 8);
}

/** One-line human summary of what a schedule sends: `run ./check.sh + "extra"`, `read notes.md`, `"prompt"`. */
export function describeScheduleSource(schedule: Pick<ThreadSchedule, 'prompt' | 'file' | 'extraPrompt'>): string {
  if (!schedule.file) return `"${schedule.prompt ?? ''}"`;
  const verb = schedule.file.mode === 'script' ? 'run' : 'read';
  const extra = schedule.extraPrompt ? ` + "${schedule.extraPrompt}"` : '';
  return `${verb} ${schedule.file.displayPath}${extra}`;
}

/**
 * Attributes on a fired schedule signal. They carry everything the transcript
 * header needs, so reloaded history renders without the process-local entry.
 */
export function scheduleSignalAttributes(
  schedule: ThreadSchedule,
  assembled: Pick<AssembledPrompt, 'outcome'> = {},
): Record<string, string> {
  return {
    source: SCHEDULE_SIGNAL_SOURCE,
    scheduleId: schedule.id,
    scheduleCadence: schedule.trigger.interval.label,
    scheduleSource: describeScheduleSource(schedule),
    scheduleCreatedBy: schedule.createdBy,
    ...(assembled.outcome ? { scheduleOutcome: assembled.outcome } : {}),
  };
}
