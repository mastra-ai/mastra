import type { ComputeStateSignalArgs, ComputeStateSignalResult, InputProcessorOrWorkflow } from '../processors';

import { SignalProvider } from './signal-provider';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const TIME_STATE_ID = 'current-time';

/** Formats the time shown to the model. */
export type TimeSignalFormatter = (date: Date, options: { timeZone: string; locale: string }) => string;

export type TimeSignalProviderOptions = {
  /**
   * How often the time shown to the model moves on: `'minute'`, `'hour'`, `'day'`, or milliseconds.
   * With `align` (the default) a number must be whole minutes that divide a day. Defaults to `'minute'`.
   */
  interval?: 'minute' | 'hour' | 'day' | number;
  /** IANA time zone, e.g. `'America/Los_Angeles'`. Defaults to the host's time zone. */
  timeZone?: string;
  /** Locale for the default format. Defaults to `'en-US'`. */
  locale?: string;
  /**
   * Overrides the default text. The default shows as much as the interval resolves:
   * the date for a day, the hour for whole hours, the minute otherwise.
   */
  format?: Intl.DateTimeFormatOptions | TimeSignalFormatter;
  /**
   * `true` (default): the time moves on at wall-clock boundaries in `timeZone` (12:00, 12:15, ...).
   * `false`: it moves on once `interval` has passed since the last time the model was shown.
   */
  align?: boolean;
};

const NAMED_INTERVALS = { minute: MINUTE_MS, hour: HOUR_MS, day: DAY_MS } as const;

function resolveInterval(interval: TimeSignalProviderOptions['interval'], align: boolean): number {
  const ms = typeof interval === 'string' ? NAMED_INTERVALS[interval] : (interval ?? MINUTE_MS);
  if (!Number.isFinite(ms) || ms <= 0) {
    throw new Error(`TimeSignalProvider: interval must be a positive number of milliseconds, got ${String(interval)}`);
  }
  if (align) {
    if (ms % MINUTE_MS !== 0) {
      throw new Error(`TimeSignalProvider: an aligned interval must be whole minutes, got ${ms}ms`);
    }
    if (DAY_MS % ms !== 0) {
      throw new Error(
        `TimeSignalProvider: an aligned interval must divide a day evenly, got ${ms / MINUTE_MS} minutes`,
      );
    }
  }
  return ms;
}

function resolveTimeZone(timeZone: string | undefined): string {
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: zone }).resolvedOptions().timeZone;
  } catch {
    throw new Error(`TimeSignalProvider: unknown time zone ${JSON.stringify(zone)}`);
  }
}

const DATE_FIELDS: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };

function defaultFormatter(intervalMs: number): TimeSignalFormatter {
  if (intervalMs >= DAY_MS) {
    return (date, { timeZone, locale }) => {
      const day = new Intl.DateTimeFormat(locale, { ...DATE_FIELDS, timeZone }).format(date);
      const zone = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: 'short' })
        .formatToParts(date)
        .find(part => part.type === 'timeZoneName')?.value;
      return zone ? `${day} (${zone})` : day;
    };
  }
  const fields: Intl.DateTimeFormatOptions =
    intervalMs % HOUR_MS === 0
      ? { ...DATE_FIELDS, hour: 'numeric', timeZoneName: 'short' }
      : { ...DATE_FIELDS, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' };
  return (date, { timeZone, locale }) => new Intl.DateTimeFormat(locale, { ...fields, timeZone }).format(date);
}

/** The wall clock in `timeZone`: local date, milliseconds since local midnight, and UTC offset. */
function localClock(date: Date, timeZone: string): { date: string; msOfDay: number; offset: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'longOffset',
  }).formatToParts(date);
  const field = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? '';
  const offset = field('timeZoneName').replace(/^GMT/, '') || '+00:00';
  return {
    date: `${field('year')}-${field('month')}-${field('day')}`,
    msOfDay:
      Number(field('hour')) * HOUR_MS +
      Number(field('minute')) * MINUTE_MS +
      Number(field('second')) * 1000 +
      date.getUTCMilliseconds(),
    offset,
  };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Input processor that keeps a `<current-time>` state signal current. It reads the clock at each model
 * step and emits a snapshot only when the interval has moved on, or when the last snapshot left the
 * context window. It holds no per-thread state and no timers.
 */
export class TimeStateProcessor {
  readonly id = 'time-state';
  // The runner reads tracking under `stateId`; it must match the emitted lane id.
  readonly stateId = TIME_STATE_ID;

  readonly #intervalMs: number;
  readonly #timeZone: string;
  readonly #locale: string;
  readonly #align: boolean;
  readonly #format: TimeSignalFormatter;

  constructor(options: TimeSignalProviderOptions = {}) {
    this.#align = options.align ?? true;
    this.#intervalMs = resolveInterval(options.interval, this.#align);
    this.#timeZone = resolveTimeZone(options.timeZone);
    this.#locale = options.locale ?? 'en-US';
    const format = options.format;
    this.#format =
      typeof format === 'function'
        ? format
        : format
          ? (date, { timeZone, locale }) => new Intl.DateTimeFormat(locale, { ...format, timeZone }).format(date)
          : defaultFormatter(this.#intervalMs);
  }

  computeStateSignal(args: ComputeStateSignalArgs): ComputeStateSignalResult {
    const now = new Date();
    const inWindow = args.contextWindow.hasSnapshot;
    let cacheKey: string;

    if (this.#align) {
      // Key the bucket by its local wall-clock start, so buckets align to boundaries in any
      // offset. A day bucket is just the local date, so it holds across DST changes. Shorter
      // buckets add the UTC offset, so the two passes of a repeated fall-back hour differ.
      const clock = localClock(now, this.#timeZone);
      if (this.#intervalMs === DAY_MS) {
        cacheKey = `time:${clock.date}`;
      } else {
        const startMinutes = (clock.msOfDay - (clock.msOfDay % this.#intervalMs)) / MINUTE_MS;
        cacheKey = `time:${clock.date}T${pad(Math.floor(startMinutes / 60))}:${pad(startMinutes % 60)}${clock.offset}`;
      }
      if (inWindow && args.tracking?.currentCacheKey === cacheKey) return;
    } else {
      const last = args.tracking?.updatedAt ? Date.parse(args.tracking.updatedAt) : NaN;
      if (inWindow && now.getTime() - last < this.#intervalMs) return;
      cacheKey = `time:${now.toISOString()}`;
    }

    return {
      id: TIME_STATE_ID,
      tagName: TIME_STATE_ID,
      mode: 'snapshot',
      cacheKey,
      contents: this.#format(now, { timeZone: this.#timeZone, locale: this.#locale }),
      attributes: { timeZone: this.#timeZone },
      value: { iso: now.toISOString(), timeZone: this.#timeZone, interval: this.#intervalMs },
    };
  }
}

/**
 * Keeps the agent aware of the current time through a `<current-time>` state signal.
 *
 * The time is read at each model step and a new snapshot is added only when the configured
 * interval has moved on, so idle threads cost nothing and no timers run. Every snapshot is a
 * persisted signal row that stays in the prompt: a long run at `'minute'` carries one
 * `<current-time>` message per minute it spans. Requires agent memory, like every state lane.
 *
 * @example
 * ```ts
 * const agent = new Agent({
 *   // ...
 *   memory,
 *   signals: [new TimeSignalProvider({ interval: 'minute', timeZone: 'America/New_York' })],
 * });
 * ```
 */
export class TimeSignalProvider extends SignalProvider<'time-signals'> {
  readonly id = 'time-signals';

  readonly #processor: TimeStateProcessor;

  constructor(options: TimeSignalProviderOptions = {}) {
    super();
    this.#processor = new TimeStateProcessor(options);
  }

  getInputProcessors(): InputProcessorOrWorkflow[] {
    return [this.#processor];
  }
}
