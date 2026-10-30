export interface SchedulePreset {
  id: Exclude<ScheduleChoice, 'off' | 'custom'>;
  label: string;
  cron: string;
}

export const SCHEDULE_PRESETS: readonly SchedulePreset[] = [
  { id: 'every-15-minutes', label: 'Every 15 minutes', cron: '*/15 * * * *' },
  { id: 'hourly', label: 'Hourly', cron: '0 * * * *' },
  { id: 'daily', label: 'Daily', cron: '0 3 * * *' },
];

const CRON_FIELD = /^[\d*,/-]+$/;
const NUMBER = /^\d+$/;
const STEP = /^\*\/(\d+)$/;

/** Shape check only — the server validates ranges and rejects anything it can't schedule. */
export function isFiveFieldCron(expression: string): boolean {
  const fields = expression.trim().split(/\s+/);
  return fields.length === 5 && fields.every(field => CRON_FIELD.test(field));
}

const plural = (count: string, unit: string) => (count === '1' ? `every ${unit}` : `every ${count} ${unit}s`);
const pad = (value: string) => value.padStart(2, '0');

/** "every 15 minutes", "daily at 03:00", … — falls back to the raw expression for anything unusual. */
export function describeCron(expression: string): string {
  if (!isFiveFieldCron(expression)) return `cron "${expression}"`;
  const [minute = '', hour = '', dayOfMonth, month, dayOfWeek] = expression.trim().split(/\s+/);
  if (dayOfMonth !== '*' || month !== '*') return `cron "${expression}"`;
  if (dayOfWeek !== '*') {
    const days = describeWeekdays(dayOfWeek ?? '');
    if (!days || !NUMBER.test(minute) || !NUMBER.test(hour)) return `cron "${expression}"`;
    return `${days} at ${pad(hour)}:${pad(minute)}`;
  }

  if (minute === '*' && hour === '*') return 'every minute';
  const minuteStep = STEP.exec(minute);
  if (minuteStep?.[1] && hour === '*') return plural(minuteStep[1], 'minute');
  if (!NUMBER.test(minute)) return `cron "${expression}"`;
  if (hour === '*') return minute === '0' ? 'every hour' : `every hour at :${pad(minute)}`;
  const hourStep = STEP.exec(hour);
  if (hourStep?.[1] && minute === '0') return plural(hourStep[1], 'hour');
  if (NUMBER.test(hour)) return `daily at ${pad(hour)}:${pad(minute)}`;
  return `cron "${expression}"`;
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function describeWeekdays(field: string): string | undefined {
  if (field === '1-5') return 'weekdays';
  if (field === '0,6' || field === '6,0') return 'weekends';
  if (!/^[0-7](,[0-7])*$/.test(field)) return undefined;
  const names = field.split(',').map(day => WEEKDAY_NAMES[Number(day) % 7]);
  return `every ${names.join(', ')}`;
}

/** Plain-words effective schedule; the server reports `null` when nothing will fire. */
export function describeEffectiveSchedule(effectiveSchedule: string | null): string {
  return effectiveSchedule === null ? 'paused' : describeCron(effectiveSchedule);
}

/** The one schedule control: Off, a preset, or a custom cron. */
export type ScheduleChoice = 'off' | 'every-15-minutes' | 'hourly' | 'daily' | 'custom';

export const SCHEDULE_CHOICES: readonly { value: ScheduleChoice; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'every-15-minutes', label: 'Every 15 min' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'custom', label: 'Custom' },
];

export const isScheduleChoice = (value: string): value is ScheduleChoice =>
  SCHEDULE_CHOICES.some(choice => choice.value === value);

export const presetForCron = (cron: string) => SCHEDULE_PRESETS.find(preset => preset.cron === cron.trim());

/** Short schedule words for one-line summaries: "Every 15 min", "Hourly", "Daily at 03:00". */
export function shortSchedule(cron: string): string {
  const preset = presetForCron(cron);
  if (preset?.id === 'every-15-minutes') return 'Every 15 min';
  if (preset?.id === 'hourly') return 'Hourly';
  const words = describeCron(cron);
  return words.startsWith('cron ') ? 'Custom schedule' : words.charAt(0).toUpperCase() + words.slice(1);
}

interface CronField {
  name: string;
  min: number;
  max: number;
}

const CRON_FIELDS: readonly CronField[] = [
  { name: 'Minute', min: 0, max: 59 },
  { name: 'Hour', min: 0, max: 23 },
  { name: 'Day of month', min: 1, max: 31 },
  { name: 'Month', min: 1, max: 12 },
  { name: 'Day of week', min: 0, max: 7 },
];

export interface ParsedCron {
  minutes: ReadonlySet<number>;
  hours: ReadonlySet<number>;
  daysOfMonth: ReadonlySet<number>;
  months: ReadonlySet<number>;
  daysOfWeek: ReadonlySet<number>;
  /** Cron ORs day-of-month and day-of-week when both are restricted. */
  dayOfMonthAny: boolean;
  dayOfWeekAny: boolean;
}

export type CronParseResult = { ok: true; cron: ParsedCron } | { ok: false; error: string };

const RANGE_PART = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/;

function parseField(text: string, field: CronField): Set<number> | string {
  const values = new Set<number>();
  for (const part of text.split(',')) {
    const match = RANGE_PART.exec(part);
    if (!match?.[1]) return `${field.name} "${part}" isn't a number, range, list or step.`;
    const step = match[2] === undefined ? 1 : Number(match[2]);
    if (step < 1) return `${field.name} step must be at least 1.`;
    const [from, to] =
      match[1] === '*'
        ? [field.min, field.max]
        : match[1].includes('-')
          ? match[1].split('-').map(Number)
          : [Number(match[1]), match[2] === undefined ? Number(match[1]) : field.max];
    if (from === undefined || to === undefined) return `${field.name} "${part}" isn't a valid range.`;
    for (const value of [from, to]) {
      if (value < field.min || value > field.max) {
        return `${field.name} must be ${field.min}–${field.max} (got ${value}).`;
      }
    }
    if (from > to) return `${field.name} range ${from}-${to} runs backwards.`;
    for (let value = from; value <= to; value += step) values.add(value);
  }
  return values;
}

/** Full five-field parse with range checks, so the form can explain a bad expression inline. */
export function parseCron(expression: string): CronParseResult {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5 || parts[0] === '') {
    return { ok: false, error: 'Use five fields — minute, hour, day of month, month, day of week. E.g. */15 * * * *' };
  }
  const sets: Set<number>[] = [];
  for (const [index, field] of CRON_FIELDS.entries()) {
    const parsed = parseField(parts[index] ?? '', field);
    if (typeof parsed === 'string') return { ok: false, error: parsed };
    sets.push(parsed);
  }
  const [minutes, hours, daysOfMonth, months, daysOfWeek] = sets;
  if (!minutes || !hours || !daysOfMonth || !months || !daysOfWeek) return { ok: false, error: 'Invalid cron.' };
  if (daysOfWeek.has(7)) daysOfWeek.add(0);
  return {
    ok: true,
    cron: {
      minutes,
      hours,
      daysOfMonth,
      months,
      daysOfWeek,
      dayOfMonthAny: parts[2] === '*',
      dayOfWeekAny: parts[4] === '*',
    },
  };
}

function matchesDay(cron: ParsedCron, date: Date): boolean {
  const dom = cron.daysOfMonth.has(date.getDate());
  const dow = cron.daysOfWeek.has(date.getDay());
  if (cron.dayOfMonthAny) return dow;
  if (cron.dayOfWeekAny) return dom;
  return dom || dow;
}

const MINUTES_IN_A_YEAR = 366 * 24 * 60;

/** The next `count` fire times after `from`, in local time. Empty when nothing fires within a year. */
export function nextRunTimes(cron: ParsedCron, from: Date, count: number): Date[] {
  const times: Date[] = [];
  const cursor = new Date(from);
  cursor.setSeconds(0, 0);
  for (let step = 0; step < MINUTES_IN_A_YEAR && times.length < count; step++) {
    cursor.setMinutes(cursor.getMinutes() + 1);
    if (
      cron.minutes.has(cursor.getMinutes()) &&
      cron.hours.has(cursor.getHours()) &&
      cron.months.has(cursor.getMonth() + 1) &&
      matchesDay(cron, cursor)
    ) {
      times.push(new Date(cursor));
    }
  }
  return times;
}

/** Which segment the schedule control shows. `customPinned` keeps "Custom" selected while the cron happens to match a preset. */
export function scheduleChoice(enabled: boolean, cron: string, customPinned: boolean): ScheduleChoice {
  if (!enabled) return 'off';
  if (customPinned) return 'custom';
  return presetForCron(cron)?.id ?? 'custom';
}

const capitalize = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);

/** "Every 15 minutes", "Daily at 03:00", … — sentence case for UI copy. */
export function describeSchedule(cron: string): string {
  const words = describeCron(cron);
  return words.startsWith('cron ') ? 'On a custom schedule' : capitalize(words);
}

const RUN_TIME_FORMAT: Intl.DateTimeFormatOptions = { weekday: 'short', hour: 'numeric', minute: '2-digit' };

export const formatRunTime = (date: Date) => date.toLocaleString(undefined, RUN_TIME_FORMAT);
