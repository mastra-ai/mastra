/**
 * Process-local scheduler behind `/schedules`.
 *
 * Schedules live only in this process: timers fire them and they die with it.
 * Nothing is written to shared storage, so other Mastra Code processes on the
 * same database never see — or fire — this session's schedules.
 */
import { randomUUID } from 'node:crypto';
import type { ScheduleCreateSpec } from './args.js';
import { nextFireTime, validateInterval } from './interval.js';
import type { AssembledPrompt } from './prompt.js';

/** `source` attribute on fired signals; the TUI labels these turns `schedule`. */
export const SCHEDULE_SIGNAL_SOURCE = 'schedule';

export type ThreadSchedule = {
  id: string;
  threadId: string;
  resourceId: string;
  interval: { ms: number; label: string };
  prompt?: string;
  file?: ScheduleCreateSpec['file'];
  extraPrompt?: string;
  /** Who created it: the user via `/schedules`, or the agent via its schedule tools. */
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

export type ScheduleRunResult = 'fired' | 'busy' | 'not-found';

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

  /** Throws when the interval is not a supported wall-clock cadence (see `validateInterval`). */
  create(
    spec: Pick<ScheduleCreateSpec, 'interval' | 'prompt' | 'file' | 'extraPrompt'> & { createdBy?: 'user' | 'agent' },
    target: { threadId: string; resourceId: string },
  ): ThreadSchedule {
    const check = validateInterval(spec.interval);
    if ('error' in check) {
      throw new Error(
        `Invalid schedule interval: ${check.error}${check.suggestion ? ` Try ${check.suggestion}.` : ''}`,
      );
    }
    const now = this.#now();
    const schedule: ThreadSchedule = {
      id: randomUUID(),
      threadId: target.threadId,
      resourceId: target.resourceId,
      interval: spec.interval,
      ...(spec.file ? { file: spec.file } : { prompt: spec.prompt ?? '' }),
      ...(spec.extraPrompt ? { extraPrompt: spec.extraPrompt } : {}),
      createdBy: spec.createdBy ?? 'user',
      status: 'active',
      nextFireAt: nextFireTime(spec.interval.ms, now),
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
    entry.schedule.nextFireAt = nextFireTime(entry.schedule.interval.ms, this.#now());
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
   * script never runs twice at once. Resolves once the fire finished.
   */
  async run(id: string): Promise<ScheduleRunResult> {
    const entry = this.#entries.get(id);
    if (!entry) return 'not-found';
    if (entry.inFlight > 0) return 'busy';
    await this.#fire(entry);
    return 'fired';
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
        entry.schedule.nextFireAt = nextFireTime(entry.schedule.interval.ms, Math.max(now, scheduledAt));
        this.#arm(entry);
        // A timer that ran long after its boundary (machine asleep) is a missed fire, not a late one.
        if (now - scheduledAt > LATE_FIRE_GRACE_MS) return;
        // A slow script can outlast a short interval; don't stack fires.
        if (entry.inFlight === 0) void this.#fire(entry);
      },
      Math.max(0, scheduledAt - this.#now()),
    );
    entry.timer.unref?.();
  }

  async #fire(entry: Entry): Promise<void> {
    const schedule = { ...entry.schedule };
    entry.inFlight++;
    try {
      const assembled = await this.#options.assemblePrompt(schedule);
      if (this.#entries.get(schedule.id) !== entry) return; // deleted meanwhile
      await this.#options.deliver(schedule, assembled);
    } catch (error) {
      this.#options.onError?.(error, schedule);
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
  const verb = schedule.file.mode === 'exec' ? 'run' : 'read';
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
    scheduleCadence: schedule.interval.label,
    scheduleSource: describeScheduleSource(schedule),
    scheduleCreatedBy: schedule.createdBy,
    ...(assembled.outcome ? { scheduleOutcome: assembled.outcome } : {}),
  };
}
