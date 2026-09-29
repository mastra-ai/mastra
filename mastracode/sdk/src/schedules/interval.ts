/**
 * Interval parsing and fire-time math for `/schedules`.
 *
 * Users type `5m`, `2h`, `1 day`. Schedules fire on local wall-clock
 * boundaries (5m fires at :00, :05, ...), so only intervals that divide the
 * hour (minutes) or the day (hours) give a stable cadence; anything else is
 * rejected with the nearest valid suggestion instead of silently drifting.
 */

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export type ParsedInterval = { ms: number; label: string };
export type IntervalError = { error: string };

const UNIT_MS: Record<string, { ms: number; short: string }> = {
  s: { ms: SECOND_MS, short: 's' },
  sec: { ms: SECOND_MS, short: 's' },
  secs: { ms: SECOND_MS, short: 's' },
  second: { ms: SECOND_MS, short: 's' },
  seconds: { ms: SECOND_MS, short: 's' },
  m: { ms: MINUTE_MS, short: 'm' },
  min: { ms: MINUTE_MS, short: 'm' },
  mins: { ms: MINUTE_MS, short: 'm' },
  minute: { ms: MINUTE_MS, short: 'm' },
  minutes: { ms: MINUTE_MS, short: 'm' },
  h: { ms: HOUR_MS, short: 'h' },
  hr: { ms: HOUR_MS, short: 'h' },
  hrs: { ms: HOUR_MS, short: 'h' },
  hour: { ms: HOUR_MS, short: 'h' },
  hours: { ms: HOUR_MS, short: 'h' },
  d: { ms: DAY_MS, short: 'd' },
  day: { ms: DAY_MS, short: 'd' },
  days: { ms: DAY_MS, short: 'd' },
};

const INTERVAL_RE = /^(\d+)\s*([a-z]+)$/i;

/** Parse `5m`, `2h`, `1 day`, `90 minutes` into milliseconds plus a normalized label. */
export function parseInterval(text: string): ParsedInterval | IntervalError {
  const match = INTERVAL_RE.exec(text.trim());
  if (!match) {
    return { error: `Invalid interval "${text}". Use a number followed by a unit, e.g. 5m, 2h, 1d.` };
  }
  const value = Number(match[1]);
  const unit = UNIT_MS[match[2]!.toLowerCase()];
  if (!unit) {
    return { error: `Unknown interval unit "${match[2]}". Use s, m, h, or d.` };
  }
  if (value <= 0) {
    return { error: 'Interval must be greater than zero.' };
  }
  return { ms: value * unit.ms, label: `${value}${unit.short}` };
}

export type IntervalCheck = { ok: true } | { error: string; suggestion?: string };

const MINUTE_DIVISORS = [1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30, 60];
const HOUR_DIVISORS = [1, 2, 3, 4, 6, 8, 12, 24];

function nearest(candidates: number[], target: number): number {
  return candidates.reduce((best, candidate) =>
    Math.abs(candidate - target) < Math.abs(best - target) ? candidate : best,
  );
}

/**
 * Check that an interval fires on stable clock boundaries: whole minutes that
 * divide the hour, whole hours that divide the day, or exactly one day.
 */
export function validateInterval({ ms }: { ms: number }): IntervalCheck {
  if (ms < MINUTE_MS) {
    return { error: 'Schedules fire at most once per minute.', suggestion: '1m' };
  }
  if (ms % MINUTE_MS !== 0) {
    const minutes = Math.round(ms / MINUTE_MS);
    return {
      error: 'Interval must be a whole number of minutes.',
      suggestion: `${Math.max(1, nearest(MINUTE_DIVISORS, minutes))}m`,
    };
  }
  const minutes = ms / MINUTE_MS;
  if (minutes < 60) {
    if (60 % minutes === 0) {
      return { ok: true };
    }
    return {
      error: `${minutes}m does not divide an hour evenly.`,
      suggestion: `${nearest(MINUTE_DIVISORS, minutes)}m`,
    };
  }
  if (minutes % 60 !== 0) {
    const hours = Math.round(minutes / 60);
    return {
      error: `${minutes}m is not a whole number of hours.`,
      suggestion: hours < 24 ? `${nearest(HOUR_DIVISORS, hours)}h` : '1d',
    };
  }
  const hours = minutes / 60;
  if (hours < 24) {
    if (24 % hours === 0) {
      return { ok: true };
    }
    return {
      error: `${hours}h does not divide a day evenly.`,
      suggestion: `${nearest(HOUR_DIVISORS, hours)}h`,
    };
  }
  if (hours === 24) {
    return { ok: true };
  }
  return {
    error: 'Intervals longer than one day are not supported.',
    suggestion: '1d',
  };
}

/** Hour-and-longer cadences: which local wall-clock slot a minute belongs to. */
function hourSlotKey(date: Date, stepHours: number): number {
  return (
    ((date.getFullYear() * 12 + date.getMonth()) * 31 + date.getDate()) * 24 +
    Math.floor(date.getHours() / stepHours) * stepHours
  );
}

/**
 * The first boundary strictly after `after`, on the local wall clock
 * (5m → :00, :05, ...; 2h → 00:00, 02:00, ...; 1d → midnight). `intervalMs`
 * must pass {@link validateInterval}.
 *
 * Around daylight-saving changes this behaves like cron:
 * - Sub-hour cadences follow the minute hand, so they keep firing every N real
 *   minutes through both the skipped and the repeated hour.
 * - Hourly and daily cadences fire once per wall-clock slot. A boundary that
 *   falls in a skipped hour fires at the first minute after the jump (02:00 →
 *   03:00), and a repeated hour does not fire a second time.
 *
 * Computing from `after` rather than from the previous fire means a late
 * timer (sleep, busy event loop) skips missed boundaries instead of bursting
 * to catch up.
 */
export function nextFireTime(intervalMs: number, after: number): number {
  const cursor = new Date(after);
  cursor.setSeconds(0, 0);
  const stepMinutes = intervalMs / MINUTE_MS;
  // Walk minute by minute: at most an hour for sub-hour cadences, ~a day otherwise.
  if (stepMinutes < 60) {
    do cursor.setTime(cursor.getTime() + MINUTE_MS);
    while (cursor.getMinutes() % stepMinutes !== 0);
    return cursor.getTime();
  }
  const stepHours = stepMinutes / 60;
  const startSlot = hourSlotKey(new Date(after), stepHours);
  do cursor.setTime(cursor.getTime() + MINUTE_MS);
  while (hourSlotKey(cursor, stepHours) <= startSlot);
  return cursor.getTime();
}
